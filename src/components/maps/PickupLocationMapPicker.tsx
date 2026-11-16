import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  MapPin,
  Crosshair,
  RotateCcw,
  Layers,
  CheckCircle2,
  AlertCircle,
  SlidersHorizontal
} from 'lucide-react';
import {
  AREA_CENTER_COORDINATES,
  formatCoordinates,
  getAreaCenterCoordinates,
  isValidCoordinates
} from '../../utils/ecoLogic.ts';
import { api } from '../../services/api.ts';

interface PickupLocationMapPickerProps {
  latitude?: number;
  longitude?: number;
  pickupLocationNote?: string;
  areaName?: string;
  height?: string;
  showNoteInput?: boolean;
  label?: string;
  onChange: (coords: {
    latitude: number;
    longitude: number;
    detectedArea?: string;
    detectedWard?: string;
  }) => void;
  onNoteChange?: (note: string) => void;
}

export const PickupLocationMapPicker: React.FC<PickupLocationMapPickerProps> = ({
  latitude,
  longitude,
  pickupLocationNote = '',
  areaName,
  height = '230px',
  showNoteInput = true,
  label = 'Exact Waste Pickup Spot on Map',
  onChange,
  onNoteChange
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const satelliteOverlaysRef = useRef<L.LayerGroup | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const fallbackCenter = getAreaCenterCoordinates(areaName);
  const activeLat = isValidCoordinates(latitude, longitude) ? Number(latitude) : fallbackCenter[0];
  const activeLng = isValidCoordinates(latitude, longitude) ? Number(longitude) : fallbackCenter[1];

  const [mapStyle, setMapStyle] = useState<'streets' | 'satellite'>('streets');
  const [isLocating, setIsLocating] = useState(false);
  const [geoStatus, setGeoStatus] = useState<{ type: 'info' | 'error'; text: string } | null>(null);
  const [detectedLabel, setDetectedLabel] = useState<string>('');
  const [showManualCoords, setShowManualCoords] = useState(false);
  const [latDraft, setLatDraft] = useState<string>(activeLat.toFixed(5));
  const [lngDraft, setLngDraft] = useState<string>(activeLng.toFixed(5));

  const reverseLookup = async (lat: number, lng: number) => {
    try {
      const res = await api.reverseGeocodeLocation({ latitude: lat, longitude: lng });
      if (res.detected && res.location) {
        setDetectedLabel(`${res.location.areaName} (${res.location.ward || 'Ward 1'})`);
        return {
          detectedArea: res.location.areaName,
          detectedWard: res.location.ward
        };
      }
    } catch {
      // Optional enrichment; pin still works offline or outside known municipal polygons
    }
    setDetectedLabel('');
    return {};
  };

  const commitCoordinates = async (lat: number, lng: number, panMap: boolean = false) => {
    const cleanLat = Number(lat.toFixed(6));
    const cleanLng = Number(lng.toFixed(6));
    setLatDraft(cleanLat.toFixed(5));
    setLngDraft(cleanLng.toFixed(5));

    if (markerRef.current) {
      markerRef.current.setLatLng([cleanLat, cleanLng]);
    }
    if (panMap && mapRef.current) {
      mapRef.current.setView([cleanLat, cleanLng], Math.max(mapRef.current.getZoom(), 16), {
        animate: true
      });
    }

    onChangeRef.current({ latitude: cleanLat, longitude: cleanLng });
    const detected = await reverseLookup(cleanLat, cleanLng);
    if (detected.detectedArea) {
      onChangeRef.current({
        latitude: cleanLat,
        longitude: cleanLng,
        ...detected
      });
    }
  };

  // Initialize interactive Leaflet map
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container || mapRef.current) return;

    const map = L.map(container, {
      center: [activeLat, activeLng],
      zoom: 16,
      zoomControl: true,
      scrollWheelZoom: 'center'
    });

    const labelsPane = map.createPane('satelliteLabels');
    labelsPane.style.zIndex = '450';
    labelsPane.style.pointerEvents = 'none';

    const tileUrl =
      mapStyle === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(map);

    satelliteOverlaysRef.current = L.layerGroup().addTo(map);

    const pinIcon = L.divIcon({
      className: 'ecotrack-pickup-pin-icon',
      html: `
        <div style="position: relative; width: 34px; height: 42px; display: flex; flex-direction: column; align-items: center;">
          <div style="
            width: 30px;
            height: 30px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            background: #059669;
            border: 3px solid #ffffff;
            box-shadow: 0 4px 10px rgba(15, 23, 42, 0.35);
            display: flex;
            align-items: center;
            justify-content: center;
          ">
            <div style="width: 9px; height: 9px; border-radius: 50%; background: #ffffff; transform: rotate(45deg);"></div>
          </div>
          <div style="width: 10px; height: 4px; border-radius: 9999px; background: rgba(15, 23, 42, 0.28); margin-top: 2px;"></div>
        </div>
      `,
      iconSize: [34, 42],
      iconAnchor: [17, 38]
    });

    const marker = L.marker([activeLat, activeLng], {
      icon: pinIcon,
      draggable: true
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      setGeoStatus(null);
      void commitCoordinates(pos.lat, pos.lng, false);
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      setGeoStatus(null);
      void commitCoordinates(e.latlng.lat, e.latlng.lng, false);
    });

    mapRef.current = map;
    markerRef.current = marker;

    const rafId = requestAnimationFrame(() => {
      map.invalidateSize();
    });
    const timerId = window.setTimeout(() => {
      map.invalidateSize();
    }, 180);

    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(() => {
        map.invalidateSize();
      });
      observer.observe(container);
    }

    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timerId);
      if (observer) observer.disconnect();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      tileLayerRef.current = null;
      satelliteOverlaysRef.current = null;
    };
  }, []);

  // Sync map marker when parent updates coordinates externally (e.g., changing household)
  useEffect(() => {
    setLatDraft(activeLat.toFixed(5));
    setLngDraft(activeLng.toFixed(5));

    if (markerRef.current && mapRef.current) {
      const currentPos = markerRef.current.getLatLng();
      if (
        Math.abs(currentPos.lat - activeLat) > 0.00001 ||
        Math.abs(currentPos.lng - activeLng) > 0.00001
      ) {
        markerRef.current.setLatLng([activeLat, activeLng]);
        mapRef.current.setView([activeLat, activeLng], Math.max(mapRef.current.getZoom(), 15), {
          animate: true
        });
      }
    }
  }, [activeLat, activeLng]);

  // Switch tile imagery cleanly and add street + area labels on Satellite imagery
  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) {
      mapRef.current.removeLayer(tileLayerRef.current);
    }
    if (satelliteOverlaysRef.current) {
      satelliteOverlaysRef.current.clearLayers();
    }

    const tileUrl =
      mapStyle === 'satellite'
        ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(mapRef.current);

    if (mapStyle === 'satellite' && satelliteOverlaysRef.current) {
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
        {
          pane: 'satelliteLabels',
          opacity: 0.85,
          maxZoom: 19
        }
      ).addTo(satelliteOverlaysRef.current);

      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
        {
          pane: 'satelliteLabels',
          maxZoom: 19
        }
      ).addTo(satelliteOverlaysRef.current);

      Object.entries(AREA_CENTER_COORDINATES).forEach(([zoneName, [zLat, zLng]]) => {
        const isCurrent = Boolean(areaName && zoneName.toLowerCase() === areaName.trim().toLowerCase());
        L.marker([zLat, zLng], {
          interactive: false,
          pane: 'satelliteLabels',
          icon: L.divIcon({
            className: 'ecotrack-sat-area-label',
            html: `
              <div style="
                display: inline-flex;
                align-items: center;
                gap: 4px;
                transform: translate(-50%, 14px);
                padding: 2px 7px;
                border-radius: 9999px;
                background: ${isCurrent ? 'rgba(6, 78, 59, 0.92)' : 'rgba(15, 23, 42, 0.82)'};
                border: 1px solid ${isCurrent ? '#34d399' : 'rgba(255, 255, 255, 0.28)'};
                color: #f8fafc;
                font-size: 10px;
                font-weight: 700;
                letter-spacing: 0.01em;
                white-space: nowrap;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.45);
                pointer-events: none;
              ">
                <span style="width: 5px; height: 5px; border-radius: 9999px; background: ${isCurrent ? '#34d399' : '#94a3b8'};"></span>
                <span>${zoneName}</span>
              </div>
            `,
            iconSize: [0, 0]
          })
        }).addTo(satelliteOverlaysRef.current!);
      });
    }
  }, [mapStyle, areaName]);

  const handleUseCurrentGps = () => {
    setGeoStatus(null);
    if (!navigator.geolocation) {
      setGeoStatus({
        type: 'error',
        text: 'GPS geolocation is unavailable in this browser. Tap on the map to set your pickup spot.'
      });
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocating(false);
        setGeoStatus({
          type: 'info',
          text: `Locked GPS spot (±${Math.round(pos.coords.accuracy || 15)}m). Drag the green pin if your waste bin is at another gate.`
        });
        void commitCoordinates(pos.coords.latitude, pos.coords.longitude, true);
      },
      (err) => {
        setIsLocating(false);
        setGeoStatus({
          type: 'error',
          text:
            err.code === err.PERMISSION_DENIED
              ? 'Location permission was blocked. Tap anywhere on the map or drag the green pin to set the exact spot.'
              : 'Unable to acquire GPS signal right now. Tap on the map or drag the pin instead.'
        });
      },
      { enableHighAccuracy: true, timeout: 6000 }
    );
  };

  const handleCenterOnArea = () => {
    setGeoStatus(null);
    const [lat, lng] = getAreaCenterCoordinates(areaName);
    void commitCoordinates(lat, lng, true);
  };

  const handleApplyManualCoords = () => {
    const latNum = Number(latDraft);
    const lngNum = Number(lngDraft);
    if (!isValidCoordinates(latNum, lngNum)) {
      setGeoStatus({
        type: 'error',
        text: 'Enter valid coordinates (Latitude between -90 and 90, Longitude between -180 and 180).'
      });
      return;
    }
    setGeoStatus(null);
    void commitCoordinates(latNum, lngNum, true);
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-3">
      {/* Header & Quick Pin Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>{label}</span>
          </label>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Tap anywhere on the map or drag the green pin to the exact gate or bin spot.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleUseCurrentGps}
            disabled={isLocating}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition flex items-center gap-1.5 whitespace-nowrap disabled:opacity-60"
          >
            <Crosshair className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
            <span>{isLocating ? 'Locating...' : 'Use My GPS'}</span>
          </button>

          <button
            type="button"
            onClick={handleCenterOnArea}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold transition flex items-center gap-1 whitespace-nowrap"
            title={`Center map on ${areaName || 'selected area'}`}
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Area Center</span>
          </button>

          <button
            type="button"
            onClick={() => setMapStyle((s) => (s === 'streets' ? 'satellite' : 'streets'))}
            className="min-h-[38px] px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-semibold transition flex items-center gap-1 whitespace-nowrap"
            aria-label={`Switch map imagery to ${mapStyle === 'streets' ? 'Satellite' : 'Streets'}`}
          >
            <Layers className="w-3.5 h-3.5 text-slate-500" />
            <span>{mapStyle === 'streets' ? 'Satellite' : 'Streets'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Leaflet Map Canvas */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-200">
        <div
          ref={mapContainerRef}
          data-testid="pickup-location-map-canvas"
          style={{ height, width: '100%' }}
          className="z-0 min-h-[200px]"
        />
        {(detectedLabel || areaName) && mapStyle === 'satellite' && (
          <div
            data-testid="satellite-area-badge"
            className="absolute top-2 right-2 z-[400] bg-slate-900/90 backdrop-blur-xs border border-emerald-400/50 rounded-lg px-2.5 py-1 text-[11px] font-bold text-white shadow-sm pointer-events-none flex items-center gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span className="truncate max-w-[190px]">{detectedLabel || areaName}</span>
          </div>
        )}
        <div className="absolute bottom-2 left-2 z-[400] bg-white/95 backdrop-blur-xs border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-mono tabular-nums text-slate-800 shadow-xs pointer-events-none">
          {formatCoordinates(activeLat, activeLng)}
        </div>
      </div>

      {/* Inline Feedback Banner */}
      {geoStatus && (
        <div
          className={`p-2.5 rounded-xl border text-[11px] flex items-start gap-2 ${
            geoStatus.type === 'error'
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {geoStatus.type === 'error' ? (
            <AlertCircle className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
          )}
          <span>{geoStatus.text}</span>
        </div>
      )}

      {/* Coordinate Summary & Optional Numeric Adjustment */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] bg-white border border-slate-200 rounded-xl px-3 py-2">
        <div className="min-w-0 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-semibold text-slate-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            Pinned Coordinates:
          </span>
          <span
            data-testid="pinned-coordinates-readout"
            className="font-mono tabular-nums font-bold text-slate-900"
          >
            {formatCoordinates(activeLat, activeLng)}
          </span>
          {detectedLabel && (
            <span className="text-emerald-700 font-medium truncate">
              Near {detectedLabel}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setShowManualCoords((prev) => !prev)}
          className="text-slate-600 hover:text-emerald-700 font-semibold flex items-center gap-1 shrink-0"
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>{showManualCoords ? 'Hide Coordinates' : 'Edit Lat/Lng'}</span>
        </button>
      </div>

      {showManualCoords && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-white border border-slate-200 rounded-xl p-2.5 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Latitude
            </label>
            <input
              type="number"
              step="0.00001"
              value={latDraft}
              onChange={(e) => setLatDraft(e.target.value)}
              aria-label="Pickup latitude"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono tabular-nums text-xs focus:bg-white focus:border-emerald-600 focus:outline-hidden"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Longitude
            </label>
            <input
              type="number"
              step="0.00001"
              value={lngDraft}
              onChange={(e) => setLngDraft(e.target.value)}
              aria-label="Pickup longitude"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono tabular-nums text-xs focus:bg-white focus:border-emerald-600 focus:outline-hidden"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleApplyManualCoords}
              className="w-full min-h-[34px] px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition"
            >
              Update Pin
            </button>
          </div>
        </div>
      )}

      {/* Exact Spot / Gate Landmark Note */}
      {showNoteInput && onNoteChange && (
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1">
            Exact Collection Spot Note (Optional)
          </label>
          <input
            type="text"
            value={pickupLocationNote}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="e.g., Outside side gate, next to green transformer pole"
            className="w-full text-xs rounded-xl border border-slate-200 bg-white p-2.5 focus:border-emerald-600 focus:outline-hidden font-medium placeholder:text-slate-400"
          />
        </div>
      )}
    </div>
  );
};
