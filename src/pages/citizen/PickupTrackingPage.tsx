import React, { useState } from 'react';
import { PickupRequest, PickupStatus } from '../../types/index.ts';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx';
import { PickupLocationMapPicker } from '../../components/maps/PickupLocationMapPicker.tsx';
import { formatCoordinates, getAreaCenterCoordinates, isValidCoordinates } from '../../utils/ecoLogic.ts';
import {
  CheckCircle2,
  Clock,
  Truck,
  AlertTriangle,
  MapPin,
  XCircle,
  ArrowLeft,
  Navigation,
  Edit3
} from 'lucide-react';

interface PickupTrackingPageProps {
  pickups: PickupRequest[];
  selectedPickup: PickupRequest | null;
  onSelectPickup: (p: PickupRequest) => void;
  onCancelPickup: (id: string) => Promise<void>;
  onUpdatePickupLocation?: (
    id: string,
    payload: { latitude: number; longitude: number; pickupLocationNote?: string }
  ) => Promise<void>;
  onViewOnMap?: (p: PickupRequest) => void;
  onBack: () => void;
}

export const PickupTrackingPage: React.FC<PickupTrackingPageProps> = ({
  pickups,
  selectedPickup,
  onSelectPickup,
  onCancelPickup,
  onUpdatePickupLocation,
  onViewOnMap,
  onBack
}) => {
  const current = selectedPickup || pickups[0];
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [editLat, setEditLat] = useState<number>(0);
  const [editLng, setEditLng] = useState<number>(0);
  const [editNote, setEditNote] = useState<string>('');

  if (!current) {
    return (
      <div className="p-8 text-center text-slate-500 bg-white rounded-3xl border border-slate-200">
        <p className="text-sm">No pickup request selected to track.</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  // Canonical linear workflow for visual timeline
  const timelineSteps: PickupStatus[] = [
    'Submitted',
    'Pending Approval',
    'Approved',
    'Assigned',
    'Collector On The Way',
    'In Progress',
    'Completed'
  ];

  const getStepState = (step: PickupStatus, currentStatus: PickupStatus) => {
    if (currentStatus === 'Cancelled' || currentStatus === 'Rejected' || currentStatus === 'Missed') {
      if (step === 'Submitted') return 'completed';
      return 'disabled';
    }

    const currentIndex = timelineSteps.indexOf(currentStatus as PickupStatus);
    const stepIndex = timelineSteps.indexOf(step);

    if (stepIndex < currentIndex) return 'completed';
    if (stepIndex === currentIndex) return 'active';
    return 'upcoming';
  };

  const isCancellable = ['Submitted', 'Pending Approval', 'Approved', 'Scheduled', 'Assigned'].includes(current.status);

  return (
    <div className="space-y-6">
      {/* Header with back navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{current.requestNumber}</h1>
              <StatusBadge status={current.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Booked on {new Date(current.createdAt).toLocaleDateString()} &bull; {current.categoryName} ({current.quantityKg} kg)
            </p>
          </div>
        </div>

        {isCancellable && (
          <button
            type="button"
            onClick={() => setCancelConfirmOpen(true)}
            className="px-4 py-2 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-bold transition flex items-center gap-1.5 self-start sm:self-auto"
          >
            <XCircle className="w-4 h-4" />
            Cancel Request
          </button>
        )}
      </div>

      {/* Main Tracking Details Card */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-8">
        {/* Visual Progress Timeline (Horizontal / Stepper) */}
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">
            Live Collection Timeline
          </h3>

          <div className="relative">
            <div className="hidden md:flex items-center justify-between relative">
              {/* Connector line */}
              <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 -z-0" />

              {timelineSteps.map((step, idx) => {
                const state = getStepState(step, current.status);

                return (
                  <div key={step} className="flex flex-col items-center relative z-10 text-center max-w-[100px]">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all shadow-xs ${
                        state === 'completed'
                          ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                          : state === 'active'
                          ? 'bg-amber-500 text-white ring-4 ring-amber-100 animate-pulse'
                          : 'bg-slate-100 text-slate-400 border border-slate-300'
                      }`}
                    >
                      {state === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : state === 'active' ? (
                        <Clock className="w-5 h-5" />
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <span
                      className={`text-[11px] mt-2.5 font-semibold leading-tight ${
                        state === 'active'
                          ? 'text-amber-700 font-bold'
                          : state === 'completed'
                          ? 'text-emerald-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Mobile Vertical Stepper */}
            <div className="md:hidden space-y-4">
              {timelineSteps.map((step) => {
                const state = getStepState(step, current.status);
                return (
                  <div key={step} className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        state === 'completed'
                          ? 'bg-emerald-600 text-white'
                          : state === 'active'
                          ? 'bg-amber-500 text-white animate-pulse'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {state === 'completed' ? <CheckCircle2 className="w-4 h-4" /> : '•'}
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        state === 'active' ? 'text-amber-700' : state === 'completed' ? 'text-emerald-800' : 'text-slate-400'
                      }`}
                    >
                      {step}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Special Status Banner for Missed or Cancelled */}
        {current.status === 'Missed' && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-sm">Collection Marked Missed</p>
              <p className="mt-1">Reason reported: <span className="font-semibold">{current.missedReason}</span></p>
              {current.missedRemarks && <p className="mt-0.5 text-rose-700 italic">Collector remarks: &ldquo;{current.missedRemarks}&rdquo;</p>}
              <p className="mt-2 text-rose-900 font-medium">A supervisor will review and reschedule your pickup slot shortly.</p>
            </div>
          </div>
        )}

        {/* Details Summary Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-slate-100 text-xs">
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-slate-400">
              Pickup Information
            </h4>
            <div>
              <p className="text-slate-400">Waste Category</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5">{current.categoryName}</p>
            </div>
            <div>
              <p className="text-slate-400">Estimated Quantity</p>
              <p className="font-bold text-slate-800 mt-0.5">{current.quantityKg} kg</p>
            </div>
            {current.actualQuantityKg && (
              <div>
                <p className="text-slate-400">Actual Weighed Quantity</p>
                <p className="font-bold text-emerald-700 mt-0.5 tabular-nums">{current.actualQuantityKg} kg (Confirmed)</p>
              </div>
            )}
            {current.qrVerified && (
              <div>
                <p className="text-slate-400">Container Verification</p>
                <p className="font-semibold text-emerald-700 mt-0.5">
                  QR Label Verified &middot;{' '}
                  <span className="font-mono tabular-nums">{current.containerTagId || current.qrScannedCode}</span>
                </p>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-slate-400">
              Collection Logistics
            </h4>
            <div>
              <p className="text-slate-400">Assigned Collector</p>
              <p className="font-bold text-slate-800 text-sm mt-0.5 flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-emerald-600" />
                {current.assignedCollectorName || 'Unassigned'}
              </p>
            </div>
            <div>
              <p className="text-slate-400">Scheduled Date & Slot</p>
              <p className="font-semibold text-slate-800 mt-0.5">
                {current.scheduledDate || current.preferredDate} ({current.scheduledTimeSlot || current.preferredTimeSlot})
              </p>
            </div>
            <div>
              <p className="text-slate-400">Pickup Address</p>
              <p className="font-semibold text-slate-800 mt-0.5">{current.address}</p>
            </div>
            <div>
              <p className="text-slate-400">Pinned Collection Location</p>
              {isValidCoordinates(current.latitude, current.longitude) ? (
                <div className="mt-0.5 space-y-1">
                  <p className="font-mono tabular-nums font-bold text-emerald-800 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{formatCoordinates(Number(current.latitude), Number(current.longitude))}</span>
                  </p>
                  {current.pickupLocationNote && (
                    <p className="text-slate-600 italic">{current.pickupLocationNote}</p>
                  )}
                </div>
              ) : (
                <p className="text-slate-500 mt-0.5">Area center estimate ({current.area})</p>
              )}

              <div className="mt-2 flex flex-wrap items-center gap-2">
                {onViewOnMap && (
                  <button
                    type="button"
                    onClick={() => onViewOnMap(current)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-[11px] transition inline-flex items-center gap-1"
                  >
                    <Navigation className="w-3 h-3 text-emerald-600" />
                    <span>View on EcoMap</span>
                  </button>
                )}
                {onUpdatePickupLocation &&
                  !['Completed', 'Cancelled', 'Rejected'].includes(current.status) && (
                    <button
                      type="button"
                      onClick={() => {
                        const [fallbackLat, fallbackLng] = getAreaCenterCoordinates(current.area);
                        setEditLat(
                          isValidCoordinates(current.latitude, current.longitude)
                            ? Number(current.latitude)
                            : fallbackLat
                        );
                        setEditLng(
                          isValidCoordinates(current.latitude, current.longitude)
                            ? Number(current.longitude)
                            : fallbackLng
                        );
                        setEditNote(current.pickupLocationNote || '');
                        setIsEditingPin((prev) => !prev);
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold text-[11px] transition inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isEditingPin ? 'Close Map Pin Editor' : 'Adjust Map Pin'}</span>
                    </button>
                  )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px] text-slate-400">
              Status History Log
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {current.statusHistory.map((h, i) => (
                <div key={h.id || i} className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px]">
                  <div className="flex items-center justify-between font-bold text-slate-800">
                    <span>{h.newStatus}</span>
                    <span className="text-slate-400 font-normal">
                      {new Date(h.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {h.remarks && <p className="text-slate-600 mt-1 leading-snug">{h.remarks}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {isEditingPin && onUpdatePickupLocation && (
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <PickupLocationMapPicker
              latitude={editLat}
              longitude={editLng}
              pickupLocationNote={editNote}
              areaName={current.area}
              height="240px"
              label={`Refine Map Pin for ${current.requestNumber}`}
              onChange={({ latitude, longitude }) => {
                setEditLat(latitude);
                setEditLng(longitude);
              }}
              onNoteChange={setEditNote}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingPin(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingPin}
                onClick={async () => {
                  setIsSavingPin(true);
                  try {
                    await onUpdatePickupLocation(current.id, {
                      latitude: editLat,
                      longitude: editLng,
                      pickupLocationNote: editNote.trim() || undefined
                    });
                    setIsEditingPin(false);
                  } finally {
                    setIsSavingPin(false);
                  }
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {isSavingPin ? 'Saving Pin...' : 'Save Updated Location'}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        title="Cancel Waste Pickup Request?"
        description="Are you sure you want to cancel this pickup request? This action cannot be undone once confirmed."
        confirmLabel="Yes, Cancel Request"
        isDestructive
        onConfirm={async () => {
          await onCancelPickup(current.id);
          setCancelConfirmOpen(false);
        }}
        onCancel={() => setCancelConfirmOpen(false)}
      />
    </div>
  );
};
