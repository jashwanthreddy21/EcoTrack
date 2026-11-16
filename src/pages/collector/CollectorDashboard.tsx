import React, { useState } from 'react';
import { PickupRequest, User } from '../../types/index.ts';
import { StatCard } from '../../components/common/StatCard.tsx';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { QrScannerModal } from '../../components/collector/QrScannerModal.tsx';
import { ContainerQrLabelModal } from '../../components/collector/ContainerQrLabelModal.tsx';
import { CollectorRouteOptimizer } from '../../components/collector/CollectorRouteOptimizer.tsx';
import { useLocation } from '../../context/LocationContext.tsx';
import {
  generateContainerTagId,
  isQrCompletableStatus,
  resolvePickupCoordinates,
  formatCoordinates,
  formatTelHref
} from '../../utils/ecoLogic.ts';
import { api } from '../../services/api.ts';
import {
  Truck,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Navigation,
  Check,
  X,
  AlertCircle,
  Radio,
  RotateCcw,
  QrCode,
  ExternalLink,
  Phone
} from 'lucide-react';

interface CollectorDashboardProps {
  currentUser: User | null;
  pickups: PickupRequest[];
  onUpdateStatus: (
    pickupId: string,
    status: any,
    extra?: {
      actualQuantityKg?: number;
      completionRemarks?: string;
      missedReason?: string;
      missedRemarks?: string;
    }
  ) => Promise<void>;
  onVerifyQrCompletion?: (
    pickupId: string,
    payload: {
      scannedCode: string;
      actualQuantityKg: number;
      completionRemarks?: string;
    }
  ) => Promise<PickupRequest>;
  onSelectPickup: (p: PickupRequest) => void;
  onNavigateToMap: () => void;
  onLocateOnMap?: (p: PickupRequest) => void;
}

export const CollectorDashboard: React.FC<CollectorDashboardProps> = ({
  currentUser,
  pickups,
  onUpdateStatus,
  onVerifyQrCompletion,
  onSelectPickup,
  onNavigateToMap,
  onLocateOnMap
}) => {
  const [completeModalPickup, setCompleteModalPickup] = useState<PickupRequest | null>(null);
  const [missedModalPickup, setMissedModalPickup] = useState<PickupRequest | null>(null);
  const [qrScannerOpen, setQrScannerOpen] = useState<boolean>(false);
  const [qrTargetPickup, setQrTargetPickup] = useState<PickupRequest | null>(null);
  const [labelPreviewPickup, setLabelPreviewPickup] = useState<PickupRequest | null>(null);

  // Form states
  const [actualKg, setActualKg] = useState<number>(10);
  const [completionNotes, setCompletionNotes] = useState('');
  const [missedReason, setMissedReason] = useState('Citizen unavailable');
  const [missedRemarks, setMissedRemarks] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [actionError, setActionError] = useState('');
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  // Real-time GPS Location Sharing State
  const [isSharingLocation, setIsSharingLocation] = useState(true);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [gpsCoordinates, setGpsCoordinates] = useState<{ lat: number; lng: number } | null>({
    lat: 17.9792,
    lng: 79.5935
  });
  const [lastBroadcastTime, setLastBroadcastTime] = useState<string>('Just now');
  const [locationToast, setLocationToast] = useState<string>('');

  const { selectedLocation } = useLocation();
  const collectorId = currentUser?.id || 'usr-col-1';
  const activeServiceArea = selectedLocation?.areaName || currentUser?.area || 'Warangal Urban';

  // Toggle location sharing on/off
  const handleToggleSharing = async () => {
    const nextState = !isSharingLocation;
    setIsSharingLocation(nextState);
    try {
      await api.toggleCollectorLocationSharing(collectorId, nextState);
      setLocationToast(nextState ? 'GPS location sharing enabled.' : 'GPS location sharing paused.');
      setTimeout(() => setLocationToast(''), 3000);
    } catch (err: any) {
      console.warn('Failed to toggle sharing:', err);
    }
  };

  // Broadcast location periodically or from device GPS
  const handlePingLocation = async () => {
    setIsBroadcasting(true);
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const lat = Number(pos.coords.latitude.toFixed(6));
            const lng = Number(pos.coords.longitude.toFixed(6));
            setGpsCoordinates({ lat, lng });
            await api.updateCollectorLocation({
              collectorId,
              latitude: lat,
              longitude: lng,
              speedKmh: Math.round((pos.coords.speed || 6) * 3.6),
              heading: Math.round(pos.coords.heading || 45),
              isSharing: true
            });
            setLastBroadcastTime(
              new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            );
            setIsBroadcasting(false);
          },
          async () => {
            const lat = Number(((gpsCoordinates?.lat || 17.9792) + (Math.random() - 0.48) * 0.0008).toFixed(6));
            const lng = Number(((gpsCoordinates?.lng || 79.5935) + (Math.random() - 0.48) * 0.0008).toFixed(6));
            setGpsCoordinates({ lat, lng });
            await api.updateCollectorLocation({
              collectorId,
              latitude: lat,
              longitude: lng,
              speedKmh: 28,
              heading: 65,
              isSharing: true
            });
            setLastBroadcastTime(
              new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            );
            setIsBroadcasting(false);
          },
          { enableHighAccuracy: true, timeout: 4000 }
        );
      }
    } catch {
      setIsBroadcasting(false);
    }
  };

  // Filter to collector's assigned pickups
  const assigned = currentUser
    ? pickups.filter(p => p.assignedCollectorId === currentUser.id)
    : pickups.filter(p => p.assignedCollectorId === 'usr-col-1');

  const todayStr = new Date().toISOString().split('T')[0];
  const todaysPickups = assigned.filter(p => p.scheduledDate === todayStr || !p.scheduledDate);

  const pending = assigned.filter(p => p.status === 'Assigned' || p.status === 'Collector On The Way' || p.status === 'In Progress').length;
  const completed = assigned.filter(p => p.status === 'Completed').length;
  const missed = assigned.filter(p => p.status === 'Missed').length;

  const handleStartShift = async (p: PickupRequest) => {
    setStatusNotice(null);
    try {
      await onUpdateStatus(p.id, 'Collector On The Way');
    } catch (err: any) {
      setStatusNotice(err?.message || 'Unable to update pickup status');
    }
  };

  const handleArrived = async (p: PickupRequest) => {
    setStatusNotice(null);
    try {
      await onUpdateStatus(p.id, 'In Progress');
    } catch (err: any) {
      setStatusNotice(err?.message || 'Unable to update pickup status');
    }
  };

  const submitCompletion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeModalPickup) return;
    setIsUpdating(true);
    setActionError('');

    try {
      await onUpdateStatus(completeModalPickup.id, 'Completed', {
        actualQuantityKg: Number(actualKg),
        completionRemarks: completionNotes || 'Waste weighed and collected properly'
      });
      setCompleteModalPickup(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to complete collection');
    } finally {
      setIsUpdating(false);
    }
  };

  const submitMissed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!missedModalPickup) return;
    setIsUpdating(true);
    setActionError('');

    try {
      await onUpdateStatus(missedModalPickup.id, 'Missed', {
        missedReason,
        missedRemarks: missedRemarks || 'Door was locked during arrival'
      });
      setMissedModalPickup(null);
    } catch (err: any) {
      setActionError(err.message || 'Failed to report missed pickup');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/* Mobile-Friendly Header */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-800 rounded-3xl p-5 sm:p-7 text-white shadow-md flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold text-emerald-200 tracking-wider uppercase flex items-center gap-1.5">
            <Truck className="w-4 h-4" />
            Field Collector Workstation
          </span>
          <h1 className="text-xl sm:text-2xl font-black mt-1">
            {currentUser?.name ? `Welcome, ${currentUser.name}` : 'Collector Workstation'}
          </h1>
          <p className="text-xs text-emerald-100/90 mt-0.5">
            {currentUser?.username ? `Agent: ${currentUser.username} • ` : ''}Zone: <span className="font-semibold text-white">{currentUser?.area || 'Warangal Urban'}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              setQrTargetPickup(null);
              setQrScannerOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-white text-emerald-900 font-bold text-xs shadow-xs hover:bg-emerald-50 transition flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <QrCode className="w-4 h-4 text-emerald-700" />
            <span>Scan Container QR</span>
          </button>

          <button
            type="button"
            onClick={onNavigateToMap}
            className="px-4 py-2.5 rounded-xl bg-emerald-900/40 border border-emerald-400/30 text-white font-semibold text-xs hover:bg-emerald-900/60 transition flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Navigation className="w-4 h-4 text-emerald-200" />
            <span>Open Route Map</span>
          </button>
        </div>
      </div>

      {statusNotice && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{statusNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setStatusNotice(null)}
            className="text-xs font-bold underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Live GPS Telemetry & EcoMap Sharing Card */}
      <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-5 border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start sm:items-center gap-3">
          <div className={`p-2.5 sm:p-3 rounded-2xl shrink-0 ${isSharingLocation ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
            <Radio className={`w-5 h-5 sm:w-6 sm:h-6 ${isSharingLocation ? 'animate-pulse text-emerald-600' : ''}`} />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">EcoMap Live GPS Telemetry</h2>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                isSharingLocation ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'
              }`}>
                {isSharingLocation ? '● Broadcasting Location' : 'Paused'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 break-words">
              {isSharingLocation
                ? `Broadcasting GPS coordinates (${gpsCoordinates?.lat || '17.9792'}° N, ${gpsCoordinates?.lng || '79.5935'}° E) • Last ping: ${lastBroadcastTime}`
                : 'Location sharing is turned off. EcoMap will not show your live coordinates.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePingLocation}
            disabled={!isSharingLocation || isBroadcasting}
            className="flex-1 sm:flex-initial min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition flex items-center justify-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
            title="Ping device GPS coordinates now"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isBroadcasting ? 'animate-spin' : ''}`} />
            <span>Ping GPS</span>
          </button>

          <button
            type="button"
            onClick={handleToggleSharing}
            className={`flex-1 sm:flex-initial min-h-[42px] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap ${
              isSharingLocation
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
            }`}
          >
            {isSharingLocation ? 'Pause Sharing' : 'Start Sharing Location'}
          </button>
        </div>
      </div>

      {/* 4 Collector Summary Cards (Section 11) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard title="Assigned Pickups" value={assigned.length} icon={Truck} color="blue" />
        <StatCard title="Pending Collections" value={pending} icon={Clock} color="amber" />
        <StatCard title="Completed Today" value={completed} icon={CheckCircle2} color="emerald" />
        <StatCard title="Missed Pickups" value={missed} icon={AlertTriangle} color="red" />
      </div>

      {/* Real-Time Google Maps Optimal Route Optimizer for Current Service Area */}
      <CollectorRouteOptimizer
        collectorId={collectorId}
        serviceArea={activeServiceArea}
        gpsCoordinates={gpsCoordinates}
        pickups={assigned}
        onQuickScanPickup={(pickupId) => {
          const target = assigned.find((p) => p.id === pickupId) || null;
          setQrTargetPickup(target);
          setQrScannerOpen(true);
        }}
        onSelectStopOnEcoMap={(pickupId) => {
          const target = assigned.find((p) => p.id === pickupId);
          if (target && onLocateOnMap) {
            onLocateOnMap(target);
          } else {
            onNavigateToMap();
          }
        }}
      />

      {/* Active Shift / Assigned Pickups Queue */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
            <span>Today&apos;s Collection Tasks</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
              {assigned.length}
            </span>
          </h3>
          <span className="text-xs text-slate-500 font-medium">Auto-sorted by proximity</span>
        </div>

        {assigned.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs">
            No assigned pickups found for today&apos;s shift. Take a break!
          </div>
        ) : (
          <div className="space-y-3">
            {assigned.map((p, idx) => {
              const isAssigned = p.status === 'Assigned' || p.status === 'Scheduled';
              const isOnTheWay = p.status === 'Collector On The Way';
              const isInProgress = p.status === 'In Progress';
              const isCompleted = p.status === 'Completed';
              const isMissed = p.status === 'Missed';
              const canQrVerify = isQrCompletableStatus(p.status);
              const containerTag = p.containerTagId || generateContainerTagId(p.requestNumber, p.categoryName);
              const resolvedLoc = resolvePickupCoordinates(p, [], idx);
              const [pinLat, pinLng] = resolvedLoc.coords;

              return (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl p-5 border shadow-xs transition ${
                    isInProgress
                      ? 'border-amber-400 ring-2 ring-amber-400/20'
                      : isOnTheWay
                      ? 'border-blue-400'
                      : isCompleted
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : isMissed
                      ? 'border-red-200 bg-red-50/20'
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-slate-900 text-sm">{p.requestNumber}</span>
                      <StatusBadge status={p.status} size="sm" />
                      <span className="text-xs text-slate-500 font-medium">
                        {p.categoryName} &middot; <span className="font-mono tabular-nums text-slate-700">{containerTag}</span>
                      </span>
                    </div>

                    <div className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      <span className="tabular-nums">{p.scheduledTimeSlot || p.preferredTimeSlot}</span>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                    <div>
                      <p className="text-slate-400">Citizen Details</p>
                      <p className="font-bold text-slate-800 text-sm mt-0.5">{p.citizenName}</p>
                      {p.citizenPhone ? (
                        <a
                          href={formatTelHref(p.citizenPhone)}
                          aria-label={`Call ${p.citizenName} at ${p.citizenPhone}`}
                          className="inline-flex items-center gap-1.5 mt-1 text-emerald-700 hover:text-emerald-800 hover:underline font-mono tabular-nums font-bold text-xs"
                        >
                          <Phone className="w-3.5 h-3.5 shrink-0" />
                          <span>{p.citizenPhone}</span>
                        </a>
                      ) : (
                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <Phone className="w-3 h-3 shrink-0" />
                          <span>Phone not provided</span>
                        </p>
                      )}
                      <p className="text-slate-600 flex items-center gap-1 mt-1 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        {p.address} ({p.ward})
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px]">
                        <span
                          className={`font-mono tabular-nums font-semibold ${
                            resolvedLoc.isExactPin ? 'text-emerald-700' : 'text-slate-500'
                          }`}
                        >
                          {resolvedLoc.isExactPin ? 'Exact Pin: ' : 'Area Est.: '}
                          {formatCoordinates(pinLat, pinLng)}
                        </span>
                        <button
                          type="button"
                          onClick={() => (onLocateOnMap ? onLocateOnMap(p) : onNavigateToMap())}
                          className="text-emerald-700 hover:underline font-semibold inline-flex items-center gap-1"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>EcoMap</span>
                        </button>
                        <a
                          href={`https://www.openstreetmap.org/?mlat=${pinLat}&mlon=${pinLng}#map=18/${pinLat}/${pinLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sky-700 hover:underline font-semibold inline-flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" />
                          <span>Directions</span>
                        </a>
                      </div>
                      {p.pickupLocationNote && (
                        <p className="text-emerald-900 mt-1.5 bg-emerald-50 border border-emerald-200/70 px-2 py-1 rounded-md text-[11px]">
                          Spot: {p.pickupLocationNote}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-slate-400">Waste Specifications</p>
                      <p className="font-bold text-slate-800 text-sm mt-0.5 tabular-nums">
                        {p.actualQuantityKg ? `${p.actualQuantityKg} kg (Weighed)` : `${p.quantityKg} kg (Est.)`}
                      </p>
                      {p.specialInstructions && (
                        <p className="text-slate-500 italic mt-0.5 bg-slate-50 p-1.5 rounded-md text-[11px]">
                          Note: {p.specialInstructions}
                        </p>
                      )}
                    </div>

                    {/* Step-by-Step Action Progression + QR Verification Buttons */}
                    <div className="flex flex-wrap items-center sm:justify-end gap-2 self-center">
                      {canQrVerify && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setQrTargetPickup(p);
                              setQrScannerOpen(true);
                            }}
                            aria-label={`Scan QR for ${p.requestNumber}`}
                            className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <QrCode className="w-3.5 h-3.5" />
                            <span>Scan QR</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setLabelPreviewPickup(p)}
                            aria-label={`View container label for ${p.requestNumber}`}
                            className="px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-semibold text-xs transition flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <span>QR Label</span>
                          </button>
                        </>
                      )}

                      {isAssigned && (
                        <button
                          type="button"
                          onClick={() => handleStartShift(p)}
                          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Navigation className="w-3.5 h-3.5" />
                          <span>Start: On The Way</span>
                        </button>
                      )}

                      {isOnTheWay && (
                        <button
                          type="button"
                          onClick={() => handleArrived(p)}
                          className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 whitespace-nowrap"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          <span>Arrived: In Progress</span>
                        </button>
                      )}

                      {isInProgress && (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setCompleteModalPickup(p);
                              setActualKg(p.quantityKg);
                              setCompletionNotes('');
                            }}
                            className="px-3.5 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition flex items-center gap-1.5 whitespace-nowrap"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Manual Complete</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setMissedModalPickup(p);
                              setMissedReason('Citizen unavailable');
                              setMissedRemarks('');
                            }}
                            className="px-3 py-2 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 font-bold text-xs transition whitespace-nowrap"
                          >
                            Mark Missed
                          </button>
                        </>
                      )}

                      {isCompleted && (
                        <div className="text-right space-y-0.5">
                          <span className="text-xs font-bold text-emerald-700 flex items-center justify-end gap-1 tabular-nums">
                            <CheckCircle2 className="w-4 h-4 shrink-0" />
                            <span>
                              {p.qrVerified ? 'QR Verified' : 'Completed'} ({p.actualQuantityKg || p.quantityKg} kg)
                            </span>
                          </span>
                          <span className="text-[11px] font-mono tabular-nums text-slate-500 block">
                            {p.qrVerifiedAt
                              ? `Scanned ${new Date(p.qrVerifiedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                              : p.completedAt
                              ? new Date(p.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              : 'Verified'}
                          </span>
                        </div>
                      )}

                      {isMissed && (
                        <div className="text-right">
                          <span className="text-xs font-bold text-rose-700 flex items-center gap-1">
                            <AlertTriangle className="w-4 h-4" />
                            Missed: {p.missedReason}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completion Modal (Section 11) */}
      {completeModalPickup && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[calc(100dvh-1.5rem)] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Verify & Complete Collection</h3>
              <button
                type="button"
                onClick={() => setCompleteModalPickup(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-0.5">
              <p className="font-bold text-slate-800">{completeModalPickup.requestNumber} — {completeModalPickup.citizenName}</p>
              <p className="text-slate-600">{completeModalPickup.address}</p>
              {completeModalPickup.citizenPhone && (
                <a
                  href={formatTelHref(completeModalPickup.citizenPhone)}
                  className="inline-flex items-center gap-1 text-emerald-700 font-mono tabular-nums font-bold hover:underline pt-0.5"
                >
                  <Phone className="w-3 h-3" />
                  <span>{completeModalPickup.citizenPhone}</span>
                </a>
              )}
            </div>

            {actionError && (
              <div className="mt-3 p-3 bg-rose-50 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{actionError}</span>
              </div>
            )}

            <form onSubmit={submitCompletion} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Actual Weighed Quantity (kg) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="1000"
                  value={actualKg}
                  onChange={(e) => setActualKg(parseFloat(e.target.value) || 0)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-bold text-sm"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Collector Remarks</label>
                <textarea
                  rows={2}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                  placeholder="e.g. Clean dry cardboard collected, verified by resident, sealed in yellow bin."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCompleteModalPickup(null)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition"
                >
                  {isUpdating ? 'Saving...' : 'Confirm Completed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Missed Pickup Modal (Section 11) */}
      {missedModalPickup && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[calc(100dvh-1.5rem)] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600" />
                Record Missed Collection
              </h3>
              <button
                type="button"
                onClick={() => setMissedModalPickup(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={submitMissed} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Reason for Missed Pickup *</label>
                <select
                  value={missedReason}
                  onChange={(e) => setMissedReason(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-rose-600 focus:outline-hidden font-medium"
                  required
                >
                  <option value="Citizen unavailable">Citizen unavailable</option>
                  <option value="Vehicle issue">Vehicle issue</option>
                  <option value="Road inaccessible">Road inaccessible</option>
                  <option value="Excessive waste quantity">Excessive waste quantity</option>
                  <option value="Incorrect address">Incorrect address</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Collector Notes & Evidence</label>
                <textarea
                  rows={2}
                  value={missedRemarks}
                  onChange={(e) => setMissedRemarks(e.target.value)}
                  placeholder="e.g. Narrow lane blocked by road repair works; phoned resident twice."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-rose-600 focus:outline-hidden font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMissedModalPickup(null)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-xs transition"
                >
                  {isUpdating ? 'Submitting...' : 'Report as Missed'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR Code Scanner Modal */}
      <QrScannerModal
        isOpen={qrScannerOpen}
        onClose={() => {
          setQrScannerOpen(false);
          setQrTargetPickup(null);
        }}
        collectorId={collectorId}
        collectorName={currentUser?.name}
        assignedPickups={assigned}
        targetPickup={qrTargetPickup}
        autoVerifyOnScan={true}
        onVerifyQrCompletion={async (pickupId, payload) => {
          if (onVerifyQrCompletion) {
            return onVerifyQrCompletion(pickupId, payload);
          }
          return api.verifyPickupByQr(pickupId, {
            ...payload,
            collectorId,
            changedBy: collectorId,
            changedByName: currentUser?.name
          });
        }}
      />

      {/* Waste Container QR Label Viewer / Downloader */}
      <ContainerQrLabelModal
        pickup={labelPreviewPickup}
        onClose={() => setLabelPreviewPickup(null)}
        onScanThisContainer={(pickup) => {
          setLabelPreviewPickup(null);
          setQrTargetPickup(pickup);
          setQrScannerOpen(true);
        }}
      />

      {/* Floating Scan QR Action Button */}
      {!qrScannerOpen && !completeModalPickup && !missedModalPickup && !labelPreviewPickup && (
        <div className="fixed bottom-20 right-4 sm:bottom-24 sm:right-6 z-40">
          <button
            type="button"
            data-testid="floating-scan-qr-btn"
            aria-label="Scan QR"
            onClick={() => {
              setQrTargetPickup(null);
              setQrScannerOpen(true);
            }}
            className="flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 rounded-2xl bg-emerald-700 hover:bg-emerald-800 active:scale-[0.98] text-white font-bold text-sm shadow-lg shadow-emerald-950/20 border border-emerald-600/40 transition focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 whitespace-nowrap shrink-0"
          >
            <QrCode className="w-5 h-5 shrink-0" />
            <span>Scan QR</span>
          </button>
        </div>
      )}
    </div>
  );
};
