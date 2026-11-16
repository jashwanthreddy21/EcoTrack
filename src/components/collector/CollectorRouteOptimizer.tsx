import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  APIProvider,
  Map as GoogleMap,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  useMapsLibrary
} from '@vis.gl/react-google-maps';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Navigation,
  RefreshCw,
  MapPin,
  Clock,
  Route as RouteIcon,
  Phone,
  QrCode,
  CheckCircle2,
  LocateFixed,
  AlertCircle
} from 'lucide-react';
import { api } from '../../services/api.ts';
import { PickupRequest } from '../../types/index.ts';
import {
  OptimizedAreaRouteResult,
  OptimizedRouteStop,
  formatTelHref,
  isQrCompletableStatus
} from '../../utils/ecoLogic.ts';
import { StatusBadge } from '../common/StatusBadge.tsx';

interface CollectorRouteOptimizerProps {
  collectorId: string;
  serviceArea: string;
  gpsCoordinates: { lat: number; lng: number } | null;
  pickups: PickupRequest[];
  onQuickScanPickup?: (pickupId: string) => void;
  onSelectStopOnEcoMap?: (pickupId: string) => void;
}

interface SdkRouteUpdate {
  provider: 'google-routes-api';
  totalDistanceKm: number;
  totalDurationMin: number;
  stops: OptimizedRouteStop[];
}

function getFallbackMapboxTileUrl(): string {
  const token = (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN || '').trim();
  if (token) {
    return `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/256/{z}/{x}/{y}@2x?access_token=${token}`;
  }
  return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
}

/**
 * Child layer rendered inside <GoogleMap> using the modern Routes SDK library
 * (`useMapsLibrary('routes')` -> `Route.computeRoutes`). Handles polyline rendering,
 * viewport fitting, and clean fallback drawing when Routes SDK calls are restricted.
 */
const GoogleRoutesLayer: React.FC<{
  origin: { latitude: number; longitude: number };
  baseStops: OptimizedRouteStop[];
  fallbackPath: [number, number][];
  focusCoords: { lat: number; lng: number } | null;
  recalcNonce: number;
  onSdkRouteComputed: (update: SdkRouteUpdate) => void;
  onProviderError: () => void;
}> = ({
  origin,
  baseStops,
  fallbackPath,
  focusCoords,
  recalcNonce,
  onSdkRouteComputed,
  onProviderError
}) => {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<any[]>([]);
  const sdkRoutesDisabledRef = useRef<boolean>(false);
  const lastNonceRef = useRef<number>(recalcNonce);
  const onSdkRouteComputedRef = useRef(onSdkRouteComputed);
  const onProviderErrorRef = useRef(onProviderError);

  useEffect(() => {
    onSdkRouteComputedRef.current = onSdkRouteComputed;
  }, [onSdkRouteComputed]);

  useEffect(() => {
    onProviderErrorRef.current = onProviderError;
  }, [onProviderError]);

  // Allow manual Recalculate button to retry SDK Routes call
  useEffect(() => {
    if (recalcNonce !== lastNonceRef.current) {
      lastNonceRef.current = recalcNonce;
      sdkRoutesDisabledRef.current = false;
    }
  }, [recalcNonce]);

  // Center map if collector clicks Focus on a specific stop
  useEffect(() => {
    if (!map || !focusCoords) return;
    map.panTo(focusCoords);
    map.setZoom(15);
  }, [map, focusCoords]);

  const stopSignature = useMemo(
    () => baseStops.map((s) => `${s.id}:${s.latitude.toFixed(5)},${s.longitude.toFixed(5)}`).join('|'),
    [baseStops]
  );

  useEffect(() => {
    if (!map) return;

    const clearPolylines = () => {
      polylinesRef.current.forEach((poly) => poly?.setMap?.(null));
      polylinesRef.current = [];
    };

    clearPolylines();

    if (baseStops.length === 0) {
      map.panTo({ lat: origin.latitude, lng: origin.longitude });
      map.setZoom(13);
      return clearPolylines;
    }

    const drawPolylineCoordinates = (coords: { lat: number; lng: number }[], isRoadSnapped: boolean) => {
      clearPolylines();
      const gMaps = (window as any).google?.maps;
      if (!gMaps || coords.length < 2) return;
      const line = new gMaps.Polyline({
        path: coords,
        geodesic: true,
        strokeColor: isRoadSnapped ? '#059669' : '#0284c7',
        strokeOpacity: 0.9,
        strokeWeight: isRoadSnapped ? 5 : 4,
        map
      });
      polylinesRef.current = [line];

      if (gMaps.LatLngBounds) {
        const bounds = new gMaps.LatLngBounds();
        bounds.extend({ lat: origin.latitude, lng: origin.longitude });
        baseStops.forEach((s) => bounds.extend({ lat: s.latitude, lng: s.longitude }));
        coords.forEach((pt) => bounds.extend(pt));
        map.fitBounds(bounds, { top: 44, right: 44, bottom: 44, left: 44 });
      }
    };

    const fallbackLatLngs: { lat: number; lng: number }[] = fallbackPath.map(([lat, lng]) => ({ lat, lng }));

    if (sdkRoutesDisabledRef.current || !routesLib || !(routesLib as any).Route?.computeRoutes) {
      drawPolylineCoordinates(fallbackLatLngs, false);
      return clearPolylines;
    }

    let cancelled = false;
    const limitedStops = baseStops.slice(0, 26);
    const destinationStop = limitedStops[limitedStops.length - 1];
    const intermediates = limitedStops.slice(0, Math.max(0, limitedStops.length - 1));

    const request: Record<string, any> = {
      origin: { lat: origin.latitude, lng: origin.longitude },
      destination: { lat: destinationStop.latitude, lng: destinationStop.longitude },
      travelMode: 'DRIVING',
      fields: [
        'path',
        'distanceMeters',
        'durationMillis',
        'viewport',
        'legs',
        'optimizedIntermediateWaypointIndex'
      ]
    };

    if (intermediates.length > 0) {
      request.intermediates = intermediates.map((s) => ({
        location: { lat: s.latitude, lng: s.longitude }
      }));
      request.optimizeWaypointOrder = true;
    }

    (routesLib as any).Route.computeRoutes(request)
      .then(({ routes }: { routes: any[] }) => {
        if (cancelled) return;
        if (!routes || routes.length === 0) {
          drawPolylineCoordinates(fallbackLatLngs, false);
          return;
        }

        const primaryRoute = routes[0];
        if (typeof primaryRoute.createPolylines === 'function') {
          const sdkPolylines: any[] = primaryRoute.createPolylines();
          sdkPolylines.forEach((polyline) => {
            polyline.setOptions({
              strokeColor: '#059669',
              strokeOpacity: 0.92,
              strokeWeight: 5
            });
            polyline.setMap(map);
          });
          polylinesRef.current = sdkPolylines;
        } else if (Array.isArray(primaryRoute.path) && primaryRoute.path.length > 0) {
          drawPolylineCoordinates(primaryRoute.path, true);
        } else {
          drawPolylineCoordinates(fallbackLatLngs, false);
        }

        if (primaryRoute.viewport) {
          map.fitBounds(primaryRoute.viewport, { top: 44, right: 44, bottom: 44, left: 44 });
        }

        const optIndices: number[] = Array.isArray(primaryRoute.optimizedIntermediateWaypointIndex)
          ? primaryRoute.optimizedIntermediateWaypointIndex
          : intermediates.map((_, idx) => idx);

        const reorderedInputStops = [
          ...optIndices.map((idx) => intermediates[idx]).filter(Boolean),
          destinationStop
        ];

        const legs: any[] = Array.isArray(primaryRoute.legs) ? primaryRoute.legs : [];
        let cumulativeDistanceKm = 0;
        let cumulativeDurationMin = 0;

        const updatedStops: OptimizedRouteStop[] = reorderedInputStops.map((stop, idx) => {
          const leg = legs[idx];
          const legDistKm =
            typeof leg?.distanceMeters === 'number'
              ? Number((leg.distanceMeters / 1000).toFixed(2))
              : stop.legDistanceKm;
          const legMin =
            typeof leg?.durationMillis === 'number'
              ? Math.max(1, Math.round(leg.durationMillis / 60000))
              : stop.legDurationMin;

          cumulativeDistanceKm = Number((cumulativeDistanceKm + legDistKm).toFixed(2));
          cumulativeDurationMin += legMin;

          const firstStepInstruction =
            leg?.steps?.[0]?.instructions ||
            leg?.steps?.[0]?.navigationInstruction?.instructions ||
            stop.nextInstruction;

          return {
            ...stop,
            stopOrder: idx + 1,
            legDistanceKm: legDistKm,
            legDurationMin: legMin,
            cumulativeDistanceKm,
            cumulativeDurationMin,
            nextInstruction: firstStepInstruction
          };
        });

        const totalDistKm =
          typeof primaryRoute.distanceMeters === 'number'
            ? Number((primaryRoute.distanceMeters / 1000).toFixed(2))
            : cumulativeDistanceKm;

        const totalMin =
          typeof primaryRoute.durationMillis === 'number'
            ? Math.max(1, Math.round(primaryRoute.durationMillis / 60000))
            : cumulativeDurationMin;

        onSdkRouteComputedRef.current({
          provider: 'google-routes-api',
          totalDistanceKm: totalDistKm,
          totalDurationMin: totalMin,
          stops: updatedStops
        });
      })
      .catch((err: any) => {
        if (cancelled) return;
        sdkRoutesDisabledRef.current = true;
        drawPolylineCoordinates(fallbackLatLngs, false);
        if (String(err?.message || '').toLowerCase().includes('auth')) {
          onProviderErrorRef.current();
        }
      });

    return () => {
      cancelled = true;
      clearPolylines();
    };
  }, [
    map,
    routesLib,
    origin.latitude,
    origin.longitude,
    stopSignature,
    recalcNonce,
    baseStops,
    fallbackPath
  ]);

  return null;
};

/**
 * Interactive Leaflet fallback map rendered only if Google Maps JS key is absent or
 * browser authorization fails (`gm_authFailure`). Keeps exact height & numbered route pins.
 */
const LeafletFallbackRouteMap: React.FC<{
  origin: { latitude: number; longitude: number };
  stops: OptimizedRouteStop[];
  polylinePath: [number, number][];
  focusCoords: { lat: number; lng: number } | null;
  onSelectStop: (stop: OptimizedRouteStop) => void;
}> = ({ origin, stops, polylinePath, focusCoords, onSelectStop }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [origin.latitude, origin.longitude],
      zoom: 13,
      zoomControl: true
    });
    L.tileLayer(getFallbackMapboxTileUrl(), {
      maxZoom: 19,
      attribution: '&copy; Map contributors'
    }).addTo(map);
    const layerGroup = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerRef.current = layerGroup;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !focusCoords) return;
    mapRef.current.setView([focusCoords.lat, focusCoords.lng], 15, { animate: true });
  }, [focusCoords]);

  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();

    if (polylinePath.length >= 2) {
      L.polyline(polylinePath, {
        color: '#059669',
        weight: 4,
        opacity: 0.88,
        dashArray: '8 6'
      }).addTo(layer);
    }

    const collectorIcon = L.divIcon({
      className: 'ecotrack-collector-pin',
      html: `<div style="width:30px;height:30px;border-radius:9999px;background:#0f172a;color:#fff;border:3px solid #34d399;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:11px;box-shadow:0 4px 10px rgba(0,0,0,0.3);">GPS</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15]
    });

    L.marker([origin.latitude, origin.longitude], { icon: collectorIcon })
      .bindPopup('<strong>Collector Live GPS Origin</strong>')
      .addTo(layer);

    const bounds = L.latLngBounds([[origin.latitude, origin.longitude]]);
    stops.forEach((stop) => {
      const isActive = stop.status === 'In Progress' || stop.status === 'Collector On The Way';
      const bg = isActive ? '#d97706' : '#059669';
      const icon = L.divIcon({
        className: 'ecotrack-stop-pin',
        html: `<div style="width:28px;height:28px;border-radius:9999px;background:${bg};color:#fff;border:2px solid #fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:12px;box-shadow:0 3px 8px rgba(0,0,0,0.28);">${stop.stopOrder}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([stop.latitude, stop.longitude], { icon }).addTo(layer);
      marker.on('click', () => onSelectStop(stop));
      marker.bindTooltip(`#${stop.stopOrder} ${stop.citizenName} (${stop.legDistanceKm} km)`, {
        direction: 'top'
      });
      bounds.extend([stop.latitude, stop.longitude]);
    });

    if (stops.length > 0) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    } else {
      map.setView([origin.latitude, origin.longitude], 13);
    }
  }, [origin.latitude, origin.longitude, stops, polylinePath, onSelectStop]);

  return <div ref={containerRef} className="w-full h-full z-0" />;
};

export const CollectorRouteOptimizer: React.FC<CollectorRouteOptimizerProps> = ({
  collectorId,
  serviceArea,
  gpsCoordinates,
  pickups,
  onQuickScanPickup,
  onSelectStopOnEcoMap
}) => {
  const googleMapsApiKey = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '').trim();
  const [routeResult, setRouteResult] = useState<OptimizedAreaRouteResult | null>(null);
  const [sdkOverride, setSdkOverride] = useState<SdkRouteUpdate | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [fetchError, setFetchError] = useState<string>('');
  const [googleAuthFailed, setGoogleAuthFailed] = useState<boolean>(false);
  const [selectedStop, setSelectedStop] = useState<OptimizedRouteStop | null>(null);
  const [focusCoords, setFocusCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [recalcNonce, setRecalcNonce] = useState<number>(0);

  const isFetchingRef = useRef(false);

  // Listen for Google Maps auth errors so headless/restricted keys fail cleanly to Leaflet fallback
  useEffect(() => {
    const win = window as any;
    const prevHandler = win.gm_authFailure;
    win.gm_authFailure = () => {
      setGoogleAuthFailed(true);
      if (typeof prevHandler === 'function') {
        prevHandler();
      }
    };
    return () => {
      win.gm_authFailure = prevHandler;
    };
  }, []);

  const originLat = gpsCoordinates?.lat;
  const originLng = gpsCoordinates?.lng;

  const pickupsSignature = useMemo(
    () =>
      pickups
        .map((p) => `${p.id}:${p.status}:${p.latitude ?? ''}:${p.longitude ?? ''}`)
        .join('|'),
    [pickups]
  );

  const computeAreaRoute = useCallback(
    async (bumpNonce: boolean = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      setIsCalculating(true);
      setFetchError('');
      try {
        const result = await api.optimizeCollectorAreaRoute({
          collectorId,
          serviceArea,
          originLat,
          originLng
        });
        setRouteResult(result);
        setSdkOverride(null);
        if (bumpNonce) {
          setRecalcNonce((n) => n + 1);
        }
      } catch (err: any) {
        setFetchError(err?.message || 'Unable to compute service area route right now.');
      } finally {
        isFetchingRef.current = false;
        setIsCalculating(false);
      }
    },
    [collectorId, serviceArea, originLat, originLng]
  );

  // Recalculate immediately when collector GPS, service area, or pickup statuses change
  useEffect(() => {
    computeAreaRoute(false);
  }, [computeAreaRoute, pickupsSignature]);

  // Real-time periodic refresh every 10 seconds when visible to incorporate new citizen bookings or status updates
  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return;
      computeAreaRoute(false);
    }, 10000);
    return () => window.clearInterval(intervalId);
  }, [computeAreaRoute]);

  const effectiveStops = sdkOverride ? sdkOverride.stops : routeResult?.stops || [];
  const effectiveDistanceKm = sdkOverride ? sdkOverride.totalDistanceKm : routeResult?.totalDistanceKm ?? 0;
  const effectiveDurationMin = sdkOverride ? sdkOverride.totalDurationMin : routeResult?.totalDurationMin ?? 0;
  const effectiveProvider = sdkOverride
    ? sdkOverride.provider
    : routeResult?.provider || 'ecotrack-tsp-fallback';

  const originPoint = routeResult?.origin || {
    latitude: originLat || 17.9792,
    longitude: originLng || 79.5935
  };

  const canRenderGoogleMaps = Boolean(googleMapsApiKey) && !googleAuthFailed;

  const handleSdkRouteComputed = useCallback((update: SdkRouteUpdate) => {
    setSdkOverride(update);
  }, []);

  const lastUpdatedLabel = routeResult?.calculatedAt
    ? new Date(routeResult.calculatedAt).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
    : 'Syncing...';

  return (
    <section
      data-testid="collector-route-optimizer"
      className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden"
    >
      {/* Header Bar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700">
              <RouteIcon className="w-4 h-4" />
              <span>Real-Time Optimal Route</span>
            </span>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200">
              {routeResult?.serviceArea || serviceArea}
            </span>
            <span
              data-testid="route-provider-badge"
              className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-md border ${
                effectiveProvider === 'google-routes-api'
                  ? 'bg-sky-50 text-sky-800 border-sky-200'
                  : 'bg-slate-50 text-slate-700 border-slate-200'
              }`}
            >
              {effectiveProvider === 'google-routes-api' ? 'Google Routes API v2' : 'Google Maps + Live TSP'}
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Shortest dispatch sequence across all <span className="font-semibold text-slate-700">{effectiveStops.length}</span> pending pickups in this service area &middot; Updated <span className="font-mono tabular-nums">{lastUpdatedLabel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-4 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <div>
              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Stops</span>
              <span data-testid="route-total-stops" className="font-extrabold text-slate-900 tabular-nums">
                {effectiveStops.length}
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Total Dist</span>
              <span data-testid="route-total-distance" className="font-extrabold text-emerald-700 tabular-nums">
                {effectiveDistanceKm.toFixed(1)} km
              </span>
            </div>
            <div className="h-6 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px] font-semibold uppercase">Est. Drive</span>
              <span data-testid="route-total-duration" className="font-extrabold text-slate-900 tabular-nums">
                {effectiveDurationMin} min
              </span>
            </div>
          </div>

          <button
            type="button"
            data-testid="recalculate-route-btn"
            onClick={() => computeAreaRoute(true)}
            disabled={isCalculating}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin' : ''}`} />
            <span>{isCalculating ? 'Optimizing...' : 'Recalculate Route'}</span>
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="mx-4 sm:mx-5 mt-3 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Map + Ordered Stop Sequence Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Map Container (Explicit Fixed Height per CF2) */}
        <div className="lg:col-span-7 relative h-[340px] sm:h-[420px] bg-slate-100 border-b lg:border-b-0 lg:border-r border-slate-100">
          {canRenderGoogleMaps ? (
            <APIProvider apiKey={googleMapsApiKey} language="en" region="IN">
              <GoogleMap
                mapId="DEMO_MAP_ID"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                defaultCenter={{ lat: originPoint.latitude, lng: originPoint.longitude }}
                defaultZoom={13}
                gestureHandling="greedy"
                streetViewControl={false}
                mapTypeControl={false}
                className="w-full h-full"
              >
                <GoogleRoutesLayer
                  origin={originPoint}
                  baseStops={routeResult?.stops || []}
                  fallbackPath={routeResult?.polylinePath || []}
                  focusCoords={focusCoords}
                  recalcNonce={recalcNonce}
                  onSdkRouteComputed={handleSdkRouteComputed}
                  onProviderError={() => setGoogleAuthFailed(true)}
                />

                {/* Collector Live GPS Origin Marker */}
                <AdvancedMarker
                  position={{ lat: originPoint.latitude, lng: originPoint.longitude }}
                  title="Collector Live GPS Position"
                >
                  <Pin background="#0f172a" borderColor="#34d399" glyphColor="#ffffff" glyph="GPS" />
                </AdvancedMarker>

                {/* Numbered Pending Pickup Stop Markers */}
                {effectiveStops.map((stop) => {
                  const isPriority = stop.status === 'In Progress' || stop.status === 'Collector On The Way';
                  return (
                    <AdvancedMarker
                      key={stop.id}
                      position={{ lat: stop.latitude, lng: stop.longitude }}
                      title={`Stop #${stop.stopOrder}: ${stop.requestNumber} (${stop.citizenName})`}
                      onClick={() => setSelectedStop(stop)}
                    >
                      <Pin
                        background={isPriority ? '#d97706' : '#059669'}
                        borderColor="#ffffff"
                        glyphColor="#ffffff"
                        glyph={String(stop.stopOrder)}
                      />
                    </AdvancedMarker>
                  );
                })}

                {selectedStop && (
                  <InfoWindow
                    position={{ lat: selectedStop.latitude, lng: selectedStop.longitude }}
                    onCloseClick={() => setSelectedStop(null)}
                  >
                    <div className="p-1 max-w-[230px] text-xs space-y-1">
                      <p className="font-extrabold text-slate-900">
                        Stop #{selectedStop.stopOrder} &middot; {selectedStop.requestNumber}
                      </p>
                      <p className="font-semibold text-slate-800">{selectedStop.citizenName}</p>
                      {selectedStop.citizenPhone && (
                        <a
                          href={formatTelHref(selectedStop.citizenPhone)}
                          className="inline-flex items-center gap-1 text-emerald-700 font-mono font-bold hover:underline"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{selectedStop.citizenPhone}</span>
                        </a>
                      )}
                      <p className="text-slate-600">{selectedStop.address}</p>
                      <p className="text-slate-500 font-medium">
                        {selectedStop.categoryName} ({selectedStop.quantityKg} kg) &middot; {selectedStop.legDistanceKm} km ({selectedStop.legDurationMin} min)
                      </p>
                    </div>
                  </InfoWindow>
                )}
              </GoogleMap>
            </APIProvider>
          ) : (
            <LeafletFallbackRouteMap
              origin={originPoint}
              stops={effectiveStops}
              polylinePath={routeResult?.polylinePath || []}
              focusCoords={focusCoords}
              onSelectStop={setSelectedStop}
            />
          )}

          {/* Selected Stop Floating Banner for Quick Mobile/Fallback Inspection */}
          {selectedStop && (
            <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm bg-white/95 backdrop-blur-xs rounded-2xl p-3 border border-slate-200 shadow-lg z-10 text-xs flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-0.5">
                <p className="font-extrabold text-slate-900 truncate">
                  Stop #{selectedStop.stopOrder}: {selectedStop.requestNumber}
                </p>
                <p className="text-slate-700 font-semibold truncate">
                  {selectedStop.citizenName} &middot; {selectedStop.categoryName} ({selectedStop.quantityKg} kg)
                </p>
                <p className="text-slate-500 truncate">{selectedStop.address}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedStop(null)}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 shrink-0"
              >
                Close
              </button>
            </div>
          )}
        </div>

        {/* Ordered Stop Sequence List */}
        <div
          data-testid="optimized-route-stops"
          className="lg:col-span-5 max-h-[420px] overflow-y-auto divide-y divide-slate-100 bg-white"
        >
          {effectiveStops.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="font-bold text-slate-700">All pending pickups in {serviceArea} are cleared!</p>
              <p>New requests submitted by citizens in this zone will appear here automatically.</p>
            </div>
          ) : (
            effectiveStops.map((stop) => {
              const isOwnStop = !stop.assignedCollectorId || stop.assignedCollectorId === collectorId;
              const canScan = isOwnStop && isQrCompletableStatus(stop.status) && Boolean(onQuickScanPickup);

              return (
                <div
                  key={stop.id}
                  data-testid={`route-stop-${stop.stopOrder}`}
                  className={`p-3.5 sm:p-4 transition hover:bg-slate-50/80 ${
                    selectedStop?.id === stop.id ? 'bg-emerald-50/50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-7 h-7 rounded-xl font-extrabold text-xs flex items-center justify-center shrink-0 tabular-nums ${
                        stop.status === 'In Progress' || stop.status === 'Collector On The Way'
                          ? 'bg-amber-500 text-white'
                          : 'bg-emerald-700 text-white'
                      }`}
                    >
                      {stop.stopOrder}
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 text-xs">{stop.requestNumber}</span>
                          <StatusBadge status={stop.status} size="sm" />
                        </div>
                        <span className="text-[11px] font-bold text-emerald-700 tabular-nums flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            {stop.legDistanceKm} km &middot; {stop.legDurationMin} min
                          </span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                        <span className="font-semibold text-slate-800">{stop.citizenName}</span>
                        {stop.citizenPhone && (
                          <a
                            href={formatTelHref(stop.citizenPhone)}
                            className="inline-flex items-center gap-1 text-emerald-700 font-mono tabular-nums font-bold hover:underline"
                          >
                            <Phone className="w-3 h-3" />
                            <span>{stop.citizenPhone}</span>
                          </a>
                        )}
                      </div>

                      <p className="text-[11px] text-slate-600 flex items-start gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0 mt-0.5" />
                        <span>
                          {stop.address} ({stop.ward}) &middot; {stop.categoryName}, {stop.quantityKg} kg
                        </span>
                      </p>

                      {stop.nextInstruction && (
                        <p className="text-[11px] text-slate-500 flex items-center gap-1">
                          <Navigation className="w-3 h-3 text-sky-600 shrink-0" />
                          <span className="truncate">{stop.nextInstruction}</span>
                        </p>
                      )}

                      <div className="pt-1 flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedStop(stop);
                            setFocusCoords({ lat: stop.latitude, lng: stop.longitude });
                          }}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <LocateFixed className="w-3 h-3" />
                          <span>Focus Pin</span>
                        </button>

                        {canScan && (
                          <button
                            type="button"
                            onClick={() => onQuickScanPickup?.(stop.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold inline-flex items-center gap-1"
                          >
                            <QrCode className="w-3 h-3" />
                            <span>Scan QR</span>
                          </button>
                        )}

                        {onSelectStopOnEcoMap && (
                          <button
                            type="button"
                            onClick={() => onSelectStopOnEcoMap(stop.id)}
                            className="px-2 py-1 text-[11px] font-semibold text-sky-700 hover:underline"
                          >
                            Full EcoMap
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
};
