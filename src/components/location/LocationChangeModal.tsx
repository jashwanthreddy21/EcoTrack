import React, { useState, useEffect } from 'react';
import {
  StateLocation,
  DistrictLocation,
  CityLocation,
  AreaHierarchyLocation,
  UserLocationSelection
} from '../../types/index.ts';
import { api } from '../../services/api.ts';
import {
  MapPin,
  X,
  AlertTriangle,
  Building2,
  CheckCircle2,
  Info
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
  const [states, setStates] = useState<StateLocation[]>([]);
  const [districts, setDistricts] = useState<DistrictLocation[]>([]);
  const [cities, setCities] = useState<CityLocation[]>([]);
  const [areas, setAreas] = useState<AreaHierarchyLocation[]>([]);

  const [selectedStateId, setSelectedStateId] = useState<string>('');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('');
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [pincode, setPincode] = useState<string>('');

  const [isLoadingDistricts, setIsLoadingDistricts] = useState<boolean>(false);
  const [isLoadingCities, setIsLoadingCities] = useState<boolean>(false);
  const [isLoadingAreas, setIsLoadingAreas] = useState<boolean>(false);

  const statesRef = React.useRef<StateLocation[]>([]);
  statesRef.current = states;
  const districtsRef = React.useRef<DistrictLocation[]>([]);
  districtsRef.current = districts;
  const citiesRef = React.useRef<CityLocation[]>([]);
  citiesRef.current = cities;

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const fetchStates = async () => {
      try {
        const data = await api.getStates();
        if (!active) return;
        setStates(data);
        const matchedState =
          data.find((s) => s.id === currentLocation?.stateId) ||
          data.find((s) => currentLocation?.stateName && s.name.toLowerCase() === currentLocation.stateName.toLowerCase()) ||
          data[0];
        if (matchedState) {
          setSelectedStateId(matchedState.id);
        }
      } catch (err) {
        console.warn('Failed to load states:', err);
      }
    };
    fetchStates();
    return () => {
      active = false;
    };
  }, [isOpen, currentLocation]);

  useEffect(() => {
    if (!isOpen || !selectedStateId) {
      setDistricts([]);
      return;
    }
    let active = true;
    setIsLoadingDistricts(true);
    const fetchDistricts = async () => {
      try {
        const data = await api.getDistricts(selectedStateId);
        if (!active) return;
        setDistricts(data);
        const matchesCurrentState =
          selectedStateId === currentLocation?.stateId ||
          (currentLocation?.stateName &&
            statesRef.current.find((s) => s.id === selectedStateId)?.name.toLowerCase() ===
              currentLocation.stateName.toLowerCase());
        const matchedDistrict = matchesCurrentState
          ? data.find((d) => d.id === currentLocation?.districtId) ||
            data.find(
              (d) =>
                currentLocation?.districtName &&
                d.name.toLowerCase() === currentLocation.districtName.toLowerCase()
            )
          : undefined;

        if (matchedDistrict) {
          setSelectedDistrictId(matchedDistrict.id);
        } else {
          setSelectedDistrictId((prev) => (data.some((d) => d.id === prev) ? prev : ''));
        }
      } catch (err) {
        console.warn('Failed to load districts:', err);
      } finally {
        if (active) setIsLoadingDistricts(false);
      }
    };
    fetchDistricts();
    return () => {
      active = false;
    };
  }, [isOpen, selectedStateId, currentLocation]);

  useEffect(() => {
    if (!isOpen || !selectedDistrictId) {
      setCities([]);
      return;
    }
    let active = true;
    setIsLoadingCities(true);
    const fetchCities = async () => {
      try {
        const data = await api.getCities(selectedDistrictId);
        if (!active) return;
        setCities(data);
        const matchesCurrentDistrict =
          selectedDistrictId === currentLocation?.districtId ||
          (currentLocation?.districtName &&
            districtsRef.current.find((d) => d.id === selectedDistrictId)?.name.toLowerCase() ===
              currentLocation.districtName.toLowerCase());
        const matchedCity = matchesCurrentDistrict
          ? data.find((c) => c.id === currentLocation?.cityId) ||
            data.find(
              (c) =>
                currentLocation?.cityName &&
                c.name.toLowerCase() === currentLocation.cityName.toLowerCase()
            )
          : undefined;

        if (matchedCity) {
          setSelectedCityId(matchedCity.id);
        } else if (data.length > 0) {
          // Automatically select primary municipality for the newly picked district
          setSelectedCityId(data[0].id);
        } else {
          setSelectedCityId('');
        }
      } catch (err) {
        console.warn('Failed to load cities:', err);
      } finally {
        if (active) setIsLoadingCities(false);
      }
    };
    fetchCities();
    return () => {
      active = false;
    };
  }, [isOpen, selectedDistrictId, currentLocation]);

  useEffect(() => {
    if (!isOpen || !selectedCityId) {
      setAreas([]);
      return;
    }
    let active = true;
    setIsLoadingAreas(true);
    const fetchAreas = async () => {
      try {
        const allAreas = await api.getAreasHierarchy(selectedCityId);
        if (!active) return;
        const supported = allAreas.filter((a) => a.isSupported);
        const usableAreas = supported.length > 0 ? supported : allAreas;
        setAreas(usableAreas);

        const matchesCurrentCity =
          selectedCityId === currentLocation?.cityId ||
          (currentLocation?.cityName &&
            citiesRef.current.find((c) => c.id === selectedCityId)?.name.toLowerCase() ===
              currentLocation.cityName.toLowerCase());
        const matchedArea = matchesCurrentCity
          ? usableAreas.find((a) => a.id === currentLocation?.areaId) ||
            usableAreas.find(
              (a) =>
                currentLocation?.areaName &&
                a.name.toLowerCase() === currentLocation.areaName.toLowerCase()
            )
          : undefined;

        if (matchedArea) {
          setSelectedAreaId(matchedArea.id);
        } else if (usableAreas.length > 0) {
          setSelectedAreaId(usableAreas[0].id);
        } else {
          setSelectedAreaId('');
          setSelectedWard('');
          setPincode('');
        }
      } catch (err) {
        console.warn('Failed to load areas:', err);
      } finally {
        if (active) setIsLoadingAreas(false);
      }
    };
    fetchAreas();
    return () => {
      active = false;
    };
  }, [isOpen, selectedCityId, currentLocation]);

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

  const handleStateChange = (stateId: string) => {
    setSelectedStateId(stateId);
    setSelectedDistrictId('');
    setSelectedCityId('');
    setSelectedAreaId('');
    setSelectedWard('');
    setPincode('');
    setDistricts([]);
    setCities([]);
    setAreas([]);
  };

  const handleDistrictChange = (districtId: string) => {
    setSelectedDistrictId(districtId);
    setSelectedCityId('');
    setSelectedAreaId('');
    setSelectedWard('');
    setPincode('');
    setCities([]);
    setAreas([]);
  };

  const handleCityChange = (cityId: string) => {
    setSelectedCityId(cityId);
    setSelectedAreaId('');
    setSelectedWard('');
    setPincode('');
    setAreas([]);
  };

  const handleConfirm = () => {
    const s = states.find((x) => x.id === selectedStateId);
    const d = districts.find((x) => x.id === selectedDistrictId);
    const c = cities.find((x) => x.id === selectedCityId);
    const a = areas.find((x) => x.id === selectedAreaId);

    if (!s || !d || !c || !a) return;

    onSave({
      stateId: s.id,
      stateName: s.name,
      districtId: d.id,
      districtName: d.name,
      cityId: c.id,
      cityName: c.name,
      areaId: a.id,
      areaName: a.name,
      ward: selectedWard || a.wards[0] || 'Ward 1',
      pincode: pincode || a.pincode,
      isSupported: a.isSupported,
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
              <p className="text-xs text-slate-500 truncate">Update your default municipal service zone</p>
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
          {/* Important Preservation Notice (Section 1.5 requirement) */}
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
                {currentLocation.areaName}, {currentLocation.cityName}
              </span>
            </div>
          )}

          {/* Form */}
          <div className="space-y-3">
            <div>
              <label htmlFor="change-loc-state" className="block text-xs font-bold text-slate-700 mb-1">
                State
              </label>
              <select
                id="change-loc-state"
                value={selectedStateId}
                onChange={(e) => handleStateChange(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-white"
              >
                <option value="">-- Select State --</option>
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="change-loc-district" className="block text-xs font-bold text-slate-700 mb-1">
                  District {districts.length > 0 && <span className="text-slate-400 font-normal">({districts.length})</span>}
                </label>
                <select
                  id="change-loc-district"
                  value={selectedDistrictId}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  disabled={!selectedStateId || isLoadingDistricts}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-white disabled:bg-slate-100"
                >
                  <option value="">{isLoadingDistricts ? 'Loading Districts...' : 'Select District'}</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="change-loc-municipality" className="block text-xs font-bold text-slate-700 mb-1">
                  Municipality
                </label>
                <select
                  id="change-loc-municipality"
                  value={selectedCityId}
                  onChange={(e) => handleCityChange(e.target.value)}
                  disabled={!selectedDistrictId || isLoadingCities}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-white disabled:bg-slate-100"
                >
                  <option value="">{isLoadingCities ? 'Loading Municipality...' : 'Select City'}</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="change-loc-area" className="block text-xs font-bold text-slate-700 mb-1">
                  Area / Locality {areas.length > 0 && <span className="text-slate-400 font-normal">({areas.length})</span>}
                </label>
                <select
                  id="change-loc-area"
                  value={selectedAreaId}
                  onChange={(e) => setSelectedAreaId(e.target.value)}
                  disabled={!selectedCityId || isLoadingAreas}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-white disabled:bg-slate-100"
                >
                  <option value="">{isLoadingAreas ? 'Loading Localities...' : 'Select Locality'}</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
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
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-xs font-medium bg-white disabled:bg-slate-100"
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
              disabled={!selectedStateId || !selectedDistrictId || !selectedCityId || !selectedAreaId}
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
