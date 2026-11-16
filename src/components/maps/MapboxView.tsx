import React, { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { PickupRequest, CollectorLiveLocation } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import {
  MapPin,
  Layers,
  Truck,
  Radio,
  RotateCcw,
  Play,
  Pause,
  Compass,
  Zap,
  Navigation,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Route
} from 'lucide-react';
import {
  AREA_CENTER_COORDINATES,
  findNextScheduledPickupForCollector,
  calculateHaversineDistanceKm,
  calculateEstimatedTransitMinutes,
  generateRealisticRouteWaypoints,
  resolvePickupCoordinates,
  formatCoordinates
} from '../../utils/ecoLogic.ts';

interface MapboxViewProps {
  pickups: PickupRequest[];
  selectedPickupId?: string;
  onSelectPickup?: (pickup: PickupRequest) => void;
  height?: string;
  interactive?: boolean;
}

export const MapboxView: React.FC<MapboxViewProps> = ({
  pickups,
  selectedPickupId,
  onSelectPickup,
  height = '520px',
  interactive = true
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const baseTileLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteLabelsGroupRef = useRef<L.LayerGroup | null>(null);
  const pickupsLayerRef = useRef<L.LayerGroup | null>(null);
  const collectorsLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);

  // Filter & Visual state
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'completed' | 'missed'>('all');
  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');

  // Real-time Collector Polling state
  const [collectorLocations, setCollectorLocations] = useState<CollectorLiveLocation[]>([]);
  const [pollingEnabled, setPollingEnabled] = useState<boolean>(true);
  const [pollingIntervalMs] = useState<number>(8000); // 8 seconds real-time polling
  const [isPolling, setIsPolling] = useState<boolean>(false);
  const [lastPollTime, setLastPollTime] = useState<Date | null>(null);
  const [pollCount, setPollCount] = useState<number>(0);
  const [showCollectors, setShowCollectors] = useState<boolean>(true);
  const [showRoutes, setShowRoutes] = useState<boolean>(true);
  const [focusedCollectorId, setFocusedCollectorId] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<'paths' | 'collectors'>('paths');

  const filteredPickups = pickups.filter((p) => {
    if (activeFilter === 'active') {
      return [
        'Submitted',
        'Pending Approval',
        'Approved',
        'Scheduled',
        'Assigned',
        'Collector On The Way',
        'In Progress'
      ].includes(p.status);
    }
    if (activeFilter === 'completed') return p.status === 'Completed';
    if (activeFilter === 'missed') return p.status === 'Missed';
    return true;
  });

  // Helper to resolve exact citizen map pin or fallback area coordinates for a pickup
  const getCoordinatesForPickup = (p: PickupRequest, index: number): [number, number] => {
    return resolvePickupCoordinates(p, [], index).coords;
  };

  // Helper to determine marker color by status
  const getMarkerColor = (status: string) => {
    switch (status) {
      case 'Completed':
        return '#16a34a'; // Green
      case 'Collector On The Way':
      case 'In Progress':
        return '#f59e0b'; // Amber
      case 'Assigned':
      case 'Scheduled':
        return '#0284c7'; // Sky Blue
      case 'Missed':
        return '#dc2626'; // Red
      default:
        return '#8b5cf6'; // Purple
    }
  };

  // -------------------------------------------------------------
  // REAL-TIME POLLING MECHANISM
  // -------------------------------------------------------------
  const pollLocations = useCallback(async () => {
    try {
      setIsPolling(true);
      const locs = await api.getCollectorLocations();
      setCollectorLocations(locs);
      setLastPollTime(new Date());
      setPollCount((prev) => prev + 1);
    } catch (err) {
      console.warn('Real-time collector polling error:', err);
    } finally {
      setIsPolling(false);
    }
  }, []);

  // Poll loop effect
  useEffect(() => {
    if (!pollingEnabled) return;

    // Immediate initial poll
    pollLocations();

    const intervalId = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      pollLocations();
    }, pollingIntervalMs);
    return () => clearInterval(intervalId);
  }, [pollingEnabled, pollingIntervalMs, pollLocations]);

  // -------------------------------------------------------------
  // MAP INITIALIZATION
  // -------------------------------------------------------------
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      // Centered on Warangal & Hanamkonda twin cities
      const map = L.map(mapContainerRef.current, {
        center: [18.005, 79.565],
        zoom: 12,
        zoomControl: false,
        dragging: interactive,
        scrollWheelZoom: interactive ? 'center' : false
      });

      const labelsPane = map.createPane('satelliteLabels');
      labelsPane.style.zIndex = '450';
      labelsPane.style.pointerEvents = 'none';

      if (interactive) {
        L.control.zoom({ position: 'bottomright' }).addTo(map);
      }

      const tileUrl =
        mapStyle === 'satellite'
          ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
          : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      baseTileLayerRef.current = L.tileLayer(tileUrl, {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
      }).addTo(map);

      satelliteLabelsGroupRef.current = L.layerGroup().addTo(map);

      // Layer groups for discrete rendering & smooth updating
      routesLayerRef.current = L.layerGroup().addTo(map);
      pickupsLayerRef.current = L.layerGroup().addTo(map);
      collectorsLayerRef.current = L.layerGroup().addTo(map);

      mapInstanceRef.current = map;
    }

    return () => {
      // Map cleanup
    };
  }, []);

  // -------------------------------------------------------------
  // MAP STYLE SWITCHER (Streets vs Satellite Hybrid with Labels)
  // -------------------------------------------------------------
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (baseTileLayerRef.current) {
      map.removeLayer(baseTileLayerRef.current);
      baseTileLayerRef.current = null;
    }
    if (satelliteLabelsGroupRef.current) {
      satelliteLabelsGroupRef.current.clearLayers();
    }

    const tileUrl =
      mapStyle === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    baseTileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 18
    }).addTo(map);

    if (mapStyle === 'satellite' && satelliteLabelsGroupRef.current) {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        {
          pane: 'satelliteLabels',
          opacity: 0.85,
          maxZoom: 18
        }
      ).addTo(satelliteLabelsGroupRef.current);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          pane: 'satelliteLabels',
          maxZoom: 18
        }
      ).addTo(satelliteLabelsGroupRef.current);

      Object.entries(AREA_CENTER_COORDINATES).forEach(([zoneName, [zLat, zLng]]) => {
        L.marker([zLat, zLng], {
          interactive: false,
          pane: 'satelliteLabels',
          icon: L.divIcon({
            className: 'ecotrack-sat-zone-pill',
            html: `
              <div style="
                display: inline-flex;
                align-items: center;
                gap: 4px;
                transform: translate(-50%, -50%);
                padding: 2px 7px;
                border-radius: 9999px;
                background: rgba(15, 23, 42, 0.84);
                border: 1px solid rgba(52, 211, 153, 0.55);
                color: #f8fafc;
                font-size: 10px;
                font-weight: 700;
                white-space: nowrap;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
                pointer-events: none;
              ">
                <span style="width: 5px; height: 5px; border-radius: 9999px; background: #34d399;"></span>
                <span>${zoneName}</span>
              </div>
            `,
            iconSize: [0, 0]
          })
        }).addTo(satelliteLabelsGroupRef.current!);
      });
    }
  }, [mapStyle]);

  // -------------------------------------------------------------
  // RENDER PICKUP REQUEST PINS
  // -------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current || !pickupsLayerRef.current) return;
    const group = pickupsLayerRef.current;
    group.clearLayers();

    filteredPickups.forEach((pickup, idx) => {
      const resolved = resolvePickupCoordinates(pickup, [], idx);
      const [lat, lng] = resolved.coords;
      const color = getMarkerColor(pickup.status);
      const isSelected = pickup.id === selectedPickupId;

      const customIcon = L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="
            background-color: ${color};
            width: ${isSelected ? '32px' : '26px'};
            height: ${isSelected ? '32px' : '26px'};
            border-radius: 50%;
            border: 3px solid ${resolved.isExactPin ? '#ecfdf5' : 'white'};
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 11px;
            font-weight: bold;
            transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'};
            transition: transform 0.2s;
          ">
            ${idx + 1}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker([lat, lng], { icon: customIcon }).addTo(group);

      const popupHtml = `
        <div style="min-width: 230px; font-family: sans-serif; font-size: 13px;">
          <div style="font-weight: 700; color: #1e293b; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
            <span>${pickup.requestNumber}</span>
            <span style="font-size: 10px; padding: 2px 6px; border-radius: 9999px; background: ${color}20; color: ${color}; font-weight: 600;">
              ${pickup.status}
            </span>
          </div>
          <div style="color: #475569; margin-bottom: 2px;"><strong>Citizen:</strong> ${pickup.citizenName}</div>
          ${
            pickup.citizenPhone
              ? `<div style="color: #047857; margin-bottom: 2px;"><strong>Phone:</strong> <a href="tel:${pickup.citizenPhone.replace(/[^0-9+]/g, '')}" style="color: #047857; font-family: monospace; font-weight: 700; text-decoration: none;">${pickup.citizenPhone}</a></div>`
              : ''
          }
          <div style="color: #475569; margin-bottom: 2px;"><strong>Address:</strong> ${pickup.address}</div>
          <div style="color: #475569; margin-bottom: 2px;"><strong>Waste:</strong> ${pickup.categoryName} (${pickup.quantityKg} kg)</div>
          <div style="color: ${resolved.isExactPin ? '#047857' : '#64748b'}; margin-bottom: 2px; font-size: 11px;">
            <strong>${resolved.isExactPin ? 'Exact Map Pin' : 'Area Estimate'}:</strong>
            <span style="font-family: monospace;">${formatCoordinates(lat, lng)}</span>
          </div>
          ${
            pickup.pickupLocationNote
              ? `<div style="color: #0f172a; background: #ecfdf5; padding: 4px 6px; border-radius: 6px; margin: 4px 0; font-size: 11px;"><strong>Spot Note:</strong> ${pickup.pickupLocationNote}</div>`
              : ''
          }
          ${
            pickup.assignedCollectorName
              ? `<div style="color: #0284c7; margin-bottom: 2px;"><strong>Collector:</strong> ${pickup.assignedCollectorName}</div>`
              : ''
          }
          <div style="margin-top: 6px; font-size: 11px; color: #64748b;">Area: ${pickup.area} (${pickup.ward})</div>
        </div>
      `;

      marker.bindPopup(popupHtml);

      marker.on('click', () => {
        if (onSelectPickup) {
          onSelectPickup(pickup);
        }
      });

      if (isSelected) {
        marker.openPopup();
        mapInstanceRef.current?.setView([lat, lng], 14, { animate: true });
      }
    });
  }, [filteredPickups, selectedPickupId]);

  // -------------------------------------------------------------
  // RENDER LIVE COLLECTOR VEHICLES & ROUTE LINES
  // -------------------------------------------------------------
  useEffect(() => {
    if (!mapInstanceRef.current || !collectorsLayerRef.current || !routesLayerRef.current) return;
    const collectorsGroup = collectorsLayerRef.current;
    const routesGroup = routesLayerRef.current;

    collectorsGroup.clearLayers();
    routesGroup.clearLayers();

    if (!showCollectors) return;

    // Filter to collectors who are actively sharing location
    const sharingCollectors = collectorLocations.filter((c) => c.isSharing);

    sharingCollectors.forEach((col) => {
      const isFocused = col.collectorId === focusedCollectorId;
      const headingDeg = col.heading || 0;
      const speed = col.speedKmh || 0;

      // Dynamic animated vehicle marker with radar wave and directional indicator
      const vehicleHtml = `
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          <!-- Radar Pulse Wave -->
          <div class="radar-ring" style="
            position: absolute;
            width: 38px;
            height: 38px;
            border-radius: 50%;
            background-color: rgba(16, 185, 129, 0.4);
            border: 2px solid rgba(16, 185, 129, 0.8);
            pointer-events: none;
          "></div>

          <!-- Vehicle Core Badge -->
          <div style="
            position: relative;
            z-index: 2;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: linear-gradient(135deg, #059669 0%, #047857 100%);
            border: 2.5px solid white;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            transform: ${isFocused ? 'scale(1.2)' : 'scale(1)'};
            transition: transform 0.3s ease;
          ">
            <!-- Truck Icon -->
            <svg style="width: 18px; height: 18px;" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/>
              <path d="M15 18H9"/>
              <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/>
              <circle cx="17" cy="18" r="2"/>
              <circle cx="7" cy="18" r="2"/>
            </svg>

            <!-- Heading Direction Needle -->
            <div style="
              position: absolute;
              top: -6px;
              width: 0;
              height: 0;
              border-left: 5px solid transparent;
              border-right: 5px solid transparent;
              border-bottom: 7px solid #10b981;
              transform: rotate(${headingDeg}deg);
              transform-origin: 50% 24px;
            "></div>
          </div>

          <!-- Collector Name & Speed Tag -->
          <div style="
            position: absolute;
            bottom: -16px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(15, 23, 42, 0.9);
            color: white;
            font-size: 9px;
            font-weight: 700;
            padding: 1px 6px;
            border-radius: 9999px;
            white-space: nowrap;
            box-shadow: 0 2px 4px rgba(0,0,0,0.25);
            pointer-events: none;
            display: flex;
            align-items: center;
            gap: 3px;
          ">
            <span>${col.collectorName.split(' ')[0]}</span>
            <span style="color: #34d399;">• ${speed} km/h</span>
          </div>
        </div>
      `;

      const vehicleIcon = L.divIcon({
        className: 'custom-collector-vehicle-marker',
        html: vehicleHtml,
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });

      const marker = L.marker([col.latitude, col.longitude], {
        icon: vehicleIcon,
        zIndexOffset: 1000
      }).addTo(collectorsGroup);

      // Detailed Collector Telemetry Popup
      const collectorPopupHtml = `
        <div style="min-width: 240px; font-family: sans-serif; font-size: 13px;">
          <div style="display: flex; items-center; justify-content: space-between; margin-bottom: 6px;">
            <span style="font-size: 11px; font-weight: 700; color: #059669; text-transform: uppercase; display: flex; align-items: center; gap: 4px;">
              🚛 Live Municipal Vehicle
            </span>
            <span style="font-size: 10px; background: #dcfce7; color: #166534; font-weight: 700; padding: 2px 6px; border-radius: 9999px;">
              GPS Sharing Active
            </span>
          </div>

          <div style="font-size: 15px; font-weight: 700; color: #0f172a;">${col.collectorName}</div>
          <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
            ${col.vehicleNumber || 'Municipal Waste Truck'} ${col.phone ? `• ${col.phone}` : ''}
          </div>

          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 8px; margin-bottom: 8px;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px;">
              <div>
                <span style="color: #64748b;">Live Speed:</span>
                <span style="font-weight: 700; color: #0f172a; margin-left: 4px;">${speed} km/h</span>
              </div>
              <div>
                <span style="color: #64748b;">Compass:</span>
                <span style="font-weight: 700; color: #0f172a; margin-left: 4px;">${headingDeg}°</span>
              </div>
              <div>
                <span style="color: #64748b;">Coordinates:</span>
                <span style="font-weight: 600; color: #0f172a; margin-left: 4px;">${col.latitude.toFixed(4)}, ${col.longitude.toFixed(4)}</span>
              </div>
              <div>
                <span style="color: #64748b;">Battery:</span>
                <span style="font-weight: 700; color: #059669; margin-left: 4px;">${col.batteryLevel || 90}%</span>
              </div>
            </div>
          </div>

          ${
            col.activePickupId
              ? `
            <div style="font-size: 11px; color: #334155; margin-bottom: 8px; border-left: 3px solid #0284c7; padding-left: 6px;">
              <strong style="color: #0284c7;">Active Task:</strong> ${col.activePickupId}
              <div style="color: #64748b; font-size: 10px;">${col.activePickupAddress || 'En route to household pickup address'}</div>
            </div>
          `
              : '<div style="font-size: 11px; color: #64748b; margin-bottom: 8px;">Currently patrolling municipal collection sector.</div>'
          }

          <div style="font-size: 10px; color: #94a3b8; display: flex; align-items: center; justify-content: space-between; border-top: 1px solid #f1f5f9; padding-top: 6px;">
            <span>Real-time polling: Every 3s</span>
            <span style="color: #10b981; font-weight: 600;">● Live Connected</span>
          </div>
        </div>
      `;

      marker.bindPopup(collectorPopupHtml);

      // -------------------------------------------------------------
      // MAPBOX POLYLINE DRAWING TO NEXT SCHEDULED PICKUP COORDINATE
      // -------------------------------------------------------------
      if (showRoutes && col.isSharing) {
        // Determine the next actionable scheduled/active pickup for this collector
        const nextPickup = findNextScheduledPickupForCollector(
          col.collectorId,
          col.collectorName,
          col.activePickupId,
          pickups
        );

        if (nextPickup) {
          const pickupIdx = pickups.findIndex((p) => p.id === nextPickup.id);
          const [destLat, destLng] = getCoordinatesForPickup(nextPickup, pickupIdx >= 0 ? pickupIdx : 0);

          const distKm = calculateHaversineDistanceKm(col.latitude, col.longitude, destLat, destLng);
          const etaMins = calculateEstimatedTransitMinutes(distKm, col.speedKmh);
          const isRouteFocused = isFocused || (selectedPickupId === nextPickup.id);

          // Generate realistic multi-segment waypoints with street-grid curvature
          const waypoints = generateRealisticRouteWaypoints(
            [col.latitude, col.longitude],
            [destLat, destLng]
          );

          // 1. Outer Glow / Route Casing Polyline for high visibility
          L.polyline(waypoints, {
            color: isRouteFocused ? '#10b981' : '#0284c7',
            weight: isRouteFocused ? 7 : 5,
            opacity: isRouteFocused ? 0.38 : 0.22,
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(routesGroup);

          // 2. Primary Collection Path Polyline (dashed transit line)
          const routeLine = L.polyline(waypoints, {
            color: isRouteFocused ? '#059669' : '#0284c7',
            weight: isRouteFocused ? 4 : 3.2,
            opacity: 0.95,
            dashArray: isRouteFocused ? '10, 6' : '7, 8',
            lineCap: 'round',
            lineJoin: 'round'
          }).addTo(routesGroup);

          // Tooltip on hover
          routeLine.bindTooltip(
            `
            <div style="font-family: sans-serif; font-size: 11px; padding: 3px 6px;">
              <div style="font-weight: 700; color: ${isRouteFocused ? '#059669' : '#0284c7'}; display: flex; align-items: center; gap: 4px;">
                <span>🚛 Collection Path</span>
                <span style="font-size: 10px; background: #e0f2fe; color: #0369a1; padding: 1px 5px; border-radius: 9999px;">${nextPickup.status}</span>
              </div>
              <div style="font-weight: 600; color: #0f172a; margin-top: 2px;">
                ${col.collectorName} ➔ ${nextPickup.requestNumber}
              </div>
              <div style="color: #64748b; font-size: 10px;">📍 ${nextPickup.address}</div>
              <div style="margin-top: 3px; font-weight: 700; color: #1e293b; border-top: 1px dashed #cbd5e1; padding-top: 2px;">
                Distance: <span style="color: #0284c7;">${distKm} km</span> • ETA: <span style="color: #059669;">~${etaMins} mins</span>
              </div>
            </div>
            `,
            { sticky: true, className: 'leaflet-route-tooltip' }
          );

          // Route click handler: focus collector and select pickup
          routeLine.on('click', () => {
            setFocusedCollectorId(col.collectorId);
            if (onSelectPickup) onSelectPickup(nextPickup);
            mapInstanceRef.current?.fitBounds(
              [
                [col.latitude, col.longitude],
                [destLat, destLng]
              ],
              { padding: [50, 50], maxZoom: 15 }
            );
          });

          // 3. Midpoint Waypoint Badge (shows real distance & ETA badge directly along polyline)
          const midCoord = waypoints[1] || [
            (col.latitude + destLat) / 2,
            (col.longitude + destLng) / 2
          ];

          const badgeHtml = `
            <div style="
              display: inline-flex;
              align-items: center;
              gap: 4px;
              background: ${isRouteFocused ? '#065f46' : 'rgba(15, 23, 42, 0.92)'};
              color: white;
              padding: 2px 8px;
              border-radius: 9999px;
              font-family: sans-serif;
              font-size: 10px;
              font-weight: 700;
              box-shadow: 0 2px 8px rgba(0,0,0,0.35);
              border: 1px solid ${isRouteFocused ? '#34d399' : 'rgba(255,255,255,0.2)'};
              white-space: nowrap;
              cursor: pointer;
              transform: translate(-50%, -50%);
              user-select: none;
            ">
              <span style="color: ${isRouteFocused ? '#a7f3d0' : '#38bdf8'}; font-weight: 800;">⚡ ${distKm} km</span>
              <span style="color: #94a3b8;">•</span>
              <span style="color: #fde047;">~${etaMins}m ETA</span>
            </div>
          `;

          const badgeMarker = L.marker(midCoord, {
            icon: L.divIcon({
              html: badgeHtml,
              className: 'route-midpoint-badge',
              iconSize: [0, 0]
            }),
            zIndexOffset: isRouteFocused ? 850 : 450
          }).addTo(routesGroup);

          badgeMarker.on('click', () => {
            setFocusedCollectorId(col.collectorId);
            if (onSelectPickup) onSelectPickup(nextPickup);
            mapInstanceRef.current?.fitBounds(
              [
                [col.latitude, col.longitude],
                [destLat, destLng]
              ],
              { padding: [50, 50], maxZoom: 15 }
            );
          });

          // 4. Target Destination Pulsing Ring at next scheduled pickup coordinate
          const targetRingHtml = `
            <div style="position: relative; width: 36px; height: 36px; pointer-events: none;">
              <div style="
                position: absolute;
                inset: 0;
                border-radius: 50%;
                border: 2px dashed ${isRouteFocused ? '#10b981' : '#0284c7'};
                animation: spin 8s linear infinite;
                opacity: 0.85;
              "></div>
            </div>
          `;

          L.marker([destLat, destLng], {
            icon: L.divIcon({
              html: targetRingHtml,
              className: 'route-target-ring',
              iconSize: [36, 36],
              iconAnchor: [18, 18]
            }),
            interactive: false,
            zIndexOffset: 150
          }).addTo(routesGroup);
        }
      }

      if (isFocused) {
        marker.openPopup();
        mapInstanceRef.current?.setView([col.latitude, col.longitude], 14, { animate: true });
      }
    });
  }, [collectorLocations, showCollectors, showRoutes, focusedCollectorId, pickups, selectedPickupId]);

  // Center map on a specific collector & route
  const handleFocusCollector = (
    col: CollectorLiveLocation,
    destCoords?: [number, number],
    pickup?: PickupRequest
  ) => {
    setFocusedCollectorId(col.collectorId);
    if (mapInstanceRef.current && destCoords) {
      mapInstanceRef.current.fitBounds(
        [
          [col.latitude, col.longitude],
          destCoords
        ],
        { padding: [60, 60], maxZoom: 15 }
      );
    } else if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([col.latitude, col.longitude], 15, { animate: true });
    }
    if (pickup && onSelectPickup) {
      onSelectPickup(pickup);
    }
  };

  const sharingCount = collectorLocations.filter((c) => c.isSharing).length;

  // Compute active routes for toolbar badge & inspection drawer
  const activeRoutes = collectorLocations
    .filter((col) => col.isSharing)
    .map((col) => {
      const nextPickup = findNextScheduledPickupForCollector(
        col.collectorId,
        col.collectorName,
        col.activePickupId,
        pickups
      );
      if (!nextPickup) return null;
      const pickupIdx = pickups.findIndex((p) => p.id === nextPickup.id);
      const [destLat, destLng] = getCoordinatesForPickup(nextPickup, pickupIdx >= 0 ? pickupIdx : 0);
      const distKm = calculateHaversineDistanceKm(col.latitude, col.longitude, destLat, destLng);
      const etaMins = calculateEstimatedTransitMinutes(distKm, col.speedKmh);
      return {
        collector: col,
        pickup: nextPickup,
        distKm,
        etaMins,
        destCoords: [destLat, destLng] as [number, number]
      };
    })
    .filter(Boolean) as {
      collector: CollectorLiveLocation;
      pickup: PickupRequest;
      distKm: number;
      etaMins: number;
      destCoords: [number, number];
    }[];

  const quickFocusDrawerContent = (
    <div className="bg-slate-900/95 backdrop-blur-md text-white p-2.5 rounded-2xl border border-slate-700/80 shadow-xl pointer-events-auto">
      {/* Header with Switcher Tabs */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setDrawerTab('paths')}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
              drawerTab === 'paths'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Route className="w-3 h-3" />
            <span>Paths ({activeRoutes.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setDrawerTab('collectors')}
            className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 ${
              drawerTab === 'collectors'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Truck className="w-3 h-3" />
            <span>Trucks ({sharingCount})</span>
          </button>
        </div>
        <span className="text-[10px] text-slate-400 font-medium">Tap to track</span>
      </div>

      {/* TAB CONTENT: Collection Paths */}
      {drawerTab === 'paths' && (
        <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {activeRoutes.length === 0 ? (
            <p className="text-[11px] text-slate-400 py-2 text-center">No active scheduled paths</p>
          ) : (
            activeRoutes.map((r) => {
              const isSelected =
                r.collector.collectorId === focusedCollectorId ||
                selectedPickupId === r.pickup.id;
              return (
                <button
                  key={r.collector.collectorId}
                  type="button"
                  onClick={() => handleFocusCollector(r.collector, r.destCoords, r.pickup)}
                  className={`w-full text-left p-2 rounded-xl text-[11px] transition border ${
                    isSelected
                      ? 'bg-emerald-950/80 border-emerald-500/80 text-white shadow-sm'
                      : 'bg-slate-800/80 border-slate-700/60 text-slate-200 hover:bg-slate-700/90'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <Truck className="w-3 h-3" />
                      {r.collector.collectorName}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-sky-950 text-sky-300 border border-sky-800/60 font-mono font-bold">
                      {r.distKm} km
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 mt-1 flex items-center justify-between">
                    <span className="truncate pr-1">
                      ➔ <b className="text-white">{r.pickup.requestNumber}</b> ({r.pickup.area})
                    </span>
                    <span className="text-amber-400 font-bold shrink-0">~{r.etaMins}m ETA</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}

      {/* TAB CONTENT: Collectors List */}
      {drawerTab === 'collectors' && (
        <div className="mt-2 space-y-1 max-h-44 overflow-y-auto pr-1">
          {collectorLocations.map((c) => (
            <button
              key={c.collectorId}
              type="button"
              onClick={() => handleFocusCollector(c)}
              className={`w-full text-left px-2 py-1.5 rounded-xl text-[11px] transition flex items-center justify-between ${
                c.collectorId === focusedCollectorId
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'bg-slate-800/90 text-slate-200 hover:bg-slate-700'
              }`}
            >
              <div className="truncate pr-2">
                <p className="font-semibold truncate">{c.collectorName}</p>
                <p className="text-[10px] text-slate-400 truncate">
                  {c.isSharing ? `${c.speedKmh || 0} km/h • ${c.vehicleNumber}` : 'Sharing Off'}
                </p>
              </div>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  c.isSharing ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="relative rounded-2xl sm:rounded-3xl overflow-hidden border border-slate-200 shadow-md bg-slate-900">
      <div className="relative">
        {/* Top Map Control Bar */}
        <div className="absolute top-2.5 left-2.5 right-2.5 sm:top-3 sm:left-3 sm:right-3 z-[1000] flex flex-wrap gap-1.5 sm:gap-2 items-center justify-between pointer-events-none">
          {/* Left: Branding & Status */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pointer-events-auto bg-white/95 backdrop-blur-md px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-sm text-xs max-w-full">
            <span className="font-bold text-slate-900 flex items-center gap-1 sm:gap-1.5 pr-2 border-r border-slate-200">
              <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600 shrink-0" />
              <span className="whitespace-nowrap">EcoMap Live</span>
            </span>

            {/* Real-time Polling Status Pill */}
            <div className="flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 bg-emerald-50 text-emerald-800 rounded-lg sm:rounded-xl border border-emerald-200/60 font-semibold text-[10px] sm:text-[11px] whitespace-nowrap">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${
                    pollingEnabled ? '' : 'hidden'
                  }`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    pollingEnabled ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                ></span>
              </span>
              <span>
                {pollingEnabled ? `Live (${pollingIntervalMs / 1000}s)` : 'Paused'}
              </span>
              {isPolling && <Radio className="w-3 h-3 text-emerald-600 animate-pulse" />}
            </div>

            {/* Pause / Resume Button */}
            <button
              type="button"
              onClick={() => setPollingEnabled(!pollingEnabled)}
              className={`p-1 rounded-lg border transition ${
                pollingEnabled
                  ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                  : 'bg-emerald-600 text-white border-emerald-700'
              }`}
              title={pollingEnabled ? 'Pause real-time polling' : 'Resume real-time polling'}
              aria-label={pollingEnabled ? 'Pause real-time polling' : 'Resume real-time polling'}
            >
              {pollingEnabled ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            {/* Manual Refresh Now */}
            <button
              type="button"
              onClick={pollLocations}
              className="p-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 transition"
              title="Poll locations now"
              aria-label="Poll locations now"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
            </button>

            {/* Filter Pills */}
            <div className="hidden sm:flex items-center gap-1 pl-1 border-l border-slate-200">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-2 py-0.5 rounded-lg font-medium transition ${
                  activeFilter === 'all'
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                All ({pickups.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('active')}
                className={`px-2 py-0.5 rounded-lg font-medium transition ${
                  activeFilter === 'active'
                    ? 'bg-amber-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Active
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('completed')}
                className={`px-2 py-0.5 rounded-lg font-medium transition ${
                  activeFilter === 'completed'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Done
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('missed')}
                className={`px-2 py-0.5 rounded-lg font-medium transition ${
                  activeFilter === 'missed'
                    ? 'bg-red-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Missed
              </button>
            </div>
          </div>

          {/* Right: Layers & Map Style */}
          <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pointer-events-auto bg-white/95 backdrop-blur-md px-2 py-1.5 sm:px-3 rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-sm text-[11px] sm:text-xs max-w-full">
            {/* Toggle Collector Trucks Layer */}
            <button
              type="button"
              onClick={() => setShowCollectors(!showCollectors)}
              className={`flex items-center gap-1 px-2 py-1 sm:px-2.5 rounded-lg sm:rounded-xl font-semibold border transition whitespace-nowrap ${
                showCollectors
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}
              title="Toggle live collector vehicles on map"
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Trucks ({sharingCount})</span>
            </button>

            {/* Toggle Collection Route Polylines */}
            <button
              type="button"
              onClick={() => setShowRoutes(!showRoutes)}
              className={`flex items-center gap-1 px-2 py-1 sm:px-2.5 rounded-lg sm:rounded-xl font-semibold border transition whitespace-nowrap ${
                showRoutes
                  ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                  : 'bg-slate-100 text-slate-600 border-slate-300'
              }`}
              title="Toggle collection path polylines between trucks and next scheduled pickups"
            >
              <Route className="w-3.5 h-3.5" />
              <span>Paths ({activeRoutes.length})</span>
            </button>

            {/* Style toggle */}
            <button
              type="button"
              onClick={() => setMapStyle(mapStyle === 'streets' ? 'satellite' : 'streets')}
              className="flex items-center gap-1 px-2 py-1 sm:px-2.5 rounded-lg sm:rounded-xl text-slate-700 hover:bg-slate-100 border border-slate-300 transition font-medium whitespace-nowrap"
            >
              <Layers className="w-3.5 h-3.5 text-slate-500" />
              <span>{mapStyle === 'streets' ? 'Satellite' : 'Streets'}</span>
            </button>
          </div>
        </div>

        {/* Desktop Floating Quick-Focus Drawer */}
        {showCollectors && collectorLocations.length > 0 && (
          <div className="hidden sm:flex absolute top-16 right-3 z-[1000] flex-col gap-1.5 max-w-sm pointer-events-none">
            {quickFocusDrawerContent}
          </div>
        )}

        {/* Bottom Map Legend Overlay */}
        <div className="absolute bottom-6 left-2.5 right-2.5 sm:right-auto sm:bottom-3 sm:left-3 z-[1000] bg-white/95 backdrop-blur-md px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl sm:rounded-2xl border border-slate-200 shadow-md text-[10px] sm:text-[11px] text-slate-700 flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:gap-3">
          <span className="font-bold text-slate-900 pr-1 border-r border-slate-200">Legend:</span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-600"></span> Done
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-amber-500"></span> Active
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-sky-600"></span> Assigned
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-red-600"></span> Missed
          </span>
          <span className="flex items-center gap-1 sm:pl-2 sm:border-l border-slate-200 text-emerald-800 font-semibold">
            <Truck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-600" /> Live Truck
          </span>
          <span className="flex items-center gap-1 sm:pl-2 sm:border-l border-slate-200 text-sky-800 font-semibold">
            <span className="w-4 sm:w-5 h-0.5 border-b-2 border-dashed border-sky-600 inline-block"></span> Route
          </span>
        </div>

        {/* Map Canvas Container */}
        <div ref={mapContainerRef} style={{ height, width: '100%' }} className="z-0 min-h-[340px] max-h-[60dvh] sm:max-h-none" />
      </div>

      {/* Mobile Below-Map Quick-Focus Drawer (unobstructed map canvas on < sm screens) */}
      {showCollectors && collectorLocations.length > 0 && (
        <div className="sm:hidden border-t border-slate-800 bg-slate-900 p-2.5">
          {quickFocusDrawerContent}
        </div>
      )}
    </div>
  );
};
