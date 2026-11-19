import React, { useState, useEffect, useMemo } from 'react';
import { UserLocationSelection } from '../../types/index.ts';
import { useTelanganaLocationHierarchy } from '../../hooks/useTelanganaLocationHierarchy.ts';
import {
  MapPin,
  X,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface LocationChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLocation: UserLocationSelection | null;
  onSave: (loc: UserLocationSelection) => void;
}

export const LocationChangeModal: React.FC<LocationChangeModalProps> = ({
  isOpen,
  onClose,
  currentLocation,
  onSave
}) => {
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [pincode, setPincode] = useState<string>('');

  const {
    districts,
    selectedDistrictObj,
    municipalAreas,
    isLoadingDistricts,
    isLoadingAreas
  } = useTelanganaLocationHierarchy({
    selectedDistrict,
    enabled: isOpen
  });

  // Prefer supported areas when available for the selected district
  const areas = useMemo(() => {
    const supported = municipalAreas.filter((a) => a.isSupported);
    return supported.length > 0 ? supported : municipalAreas;
  }, [municipalAreas]);

  // Pre-seed selected District when modal opens
  useEffect(() => {
    if (!isOpen) return;
    setSelectedDistrict(currentLocation?.districtName || currentLocation?.districtId || '');
    setSelectedAreaId(currentLocation?.areaId || '');
    setSelectedWard(currentLocation?.ward || '');
    setPincode(currentLocation?.pincode || '');
  }, [isOpen, currentLocation]);

  // Sync Municipal Area when district's areas finish fetching
  useEffect(() => {
    if (!isOpen || !selectedDistrict || isLoadingAreas) return;

    if (areas.length === 0) {
      setSelectedAreaId('');
      setSelectedWard('');
      setPincode('');
      return;
    }

    const matchedCurrent =
      areas.find((a) => a.id === selectedAreaId) ||
      (currentLocation?.areaName
        ? areas.find((a) => a.name.toLowerCase() === currentLocation.areaName.toLowerCase())
        : undefined);

    if (matchedCurrent) {
      if (matchedCurrent.id !== selectedAreaId) {
        setSelectedAreaId(matchedCurrent.id);
      }
    } else {
      setSelectedAreaId(areas[0].id);
    }
  }, [isOpen, selectedDistrict, isLoadingAreas, areas, currentLocation]);

  // Sync Ward & PIN when Area changes
  useEffect(() => {
    if (!selectedAreaId) return;
    const match = areas.find((a) => a.id === selectedAreaId);
    if (match) {
      setPincode(match.pincode);
      setSelectedWard((prev) =>
        match.wards.includes(prev) && selectedAreaId === currentLocation?.areaId
          ? prev
          : match.wards[0] || 'Ward 1'
      );
    }
  }, [selectedAreaId, areas, currentLocation]);

  if (!isOpen) return null;

  const currentArea = areas.find((a) => a.id === selectedAreaId);

  const handleDistrictChange = (districtName: string) => {
    if (districtName === selectedDistrict) return;
    setSelectedDistrict(districtName);
    setSelectedAreaId('');
    setSelectedWard('');
    setPincode('');
  };

  const handleConfirm = () => {
    if (!selectedDistrictObj || !currentArea) return;

    onSave({
      stateId: 'state-ts',
      stateName: 'Telangana',
      districtId: selectedDistrictObj.id,
      districtName: selectedDistrictObj.name,
      cityId: currentArea.cityId || `city-${selectedDistrictObj.id}`,
      cityName: currentArea.cityName || `${selectedDistrictObj.name} Municipality`,
      areaId: currentArea.id,
      areaName: currentArea.name,
      ward: selectedWard || currentArea.wards[0] || 'Ward 1',
      pincode: pincode || currentArea.pincode,
      isSupported: currentArea.isSupported,
      confirmedAt: new Date().toISOString()
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 flex flex-col overflow-hidden max-h-[calc(100dvh-1.25rem)] sm:max-h-[90dvh] my-auto">
        {/* Solid Non-Overlapping Header */}
        <div className="shrink-0 px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800 shrink-0">
              <MapPin className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-slate-900 truncate">Change Service Location</h3>
              <p className="text-xs text-slate-500 truncate">Select a Telangana district and municipal area</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Important Preservation Notice */}
          <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200/80 text-xs text-amber-900 flex items-start gap-2.5 leading-relaxed">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Existing Requests Preserved</p>
              <p className="text-amber-800 text-[11px] mt-0.5">
                Changing your service location updates your view of schedules, collectors, and new requests. Existing pending or completed pickup requests retain their original service address.
              </p>
            </div>
          </div>

          {currentLocation && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <span className="text-slate-500">Current active zone:</span>
              <span className="font-bold text-slate-900">
                {currentLocation.areaName}, {currentLocation.districtName || currentLocation.cityName}
              </span>
            </div>
          )}

          {/* Two-Step Telangana Hierarchy Form */}
          <div className="space-y-3">
            <div>
              <label htmlFor="change-loc-district" className="block text-xs font-bold text-slate-700 mb-1">
                1. District in Telangana {districts.length > 0 && <span className="text-slate-400 font-normal">({districts.length})</span>}
              </label>
              <select
                id="change-loc-district"
                value={selectedDistrict}
                onChange={(e) => handleDistrictChange(e.target.value)}
                disabled={isLoadingDistricts && districts.length === 0}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-white disabled:bg-slate-100"
              >
                <option value="">
                  {isLoadingDistricts && districts.length === 0 ? 'Loading Districts...' : '-- Select District in Telangana --'}
                </option>
                {districts.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="change-loc-area" className="block text-xs font-bold text-slate-700 mb-1">
                  2. Municipal Area / Locality {areas.length > 0 && <span className="text-slate-400 font-normal">({areas.length})</span>}
                </label>
                <select
                  id="change-loc-area"
                  value={selectedAreaId}
                  onChange={(e) => setSelectedAreaId(e.target.value)}
                  disabled={!selectedDistrict || isLoadingAreas || areas.length === 0}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-white disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">
                    {!selectedDistrict
                      ? 'Select District first'
                      : isLoadingAreas
                        ? 'Loading municipal areas...'
                        : areas.length === 0
                          ? 'No areas available'
                          : 'Select Municipal Area'}
                  </option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.zone})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="change-loc-ward" className="block text-xs font-bold text-slate-700 mb-1">
                  Ward
                </label>
                <select
                  id="change-loc-ward"
                  value={selectedWard}
                  onChange={(e) => setSelectedWard(e.target.value)}
                  disabled={!selectedAreaId || !currentArea?.wards}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-white disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {currentArea?.wards ? (
                    currentArea.wards.map((w) => (
                      <option key={w} value={w}>
                        {w}
                      </option>
                    ))
                  ) : (
                    <option value="">General</option>
                  )}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="change-loc-pincode" className="block text-xs font-bold text-slate-700 mb-1">
                PIN Code
              </label>
              <input
                id="change-loc-pincode"
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 506001"
                maxLength={6}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium"
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full sm:w-auto min-h-[42px] px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={!selectedDistrict || !selectedAreaId}
              className="w-full sm:w-auto min-h-[42px] px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-xs transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Update Location</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
