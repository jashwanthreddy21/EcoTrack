import React, { useEffect, useState } from 'react';
import { Household, User, AreaLocation } from '../../types/index.ts';
import { Home, Plus, Edit2, Trash2, MapPin, X, AlertCircle } from 'lucide-react';
import { ConfirmDialog } from '../../components/common/ConfirmDialog.tsx';
import { PickupLocationMapPicker } from '../../components/maps/PickupLocationMapPicker.tsx';
import { formatCoordinates, getAreaCenterCoordinates, isValidCoordinates } from '../../utils/ecoLogic.ts';
import { useTelanganaLocationHierarchy } from '../../hooks/useTelanganaLocationHierarchy.ts';

interface HouseholdManagementProps {
  currentUser: User | null;
  households: Household[];
  areas: AreaLocation[];
  onAddHousehold: (data: Partial<Household>) => Promise<void>;
  onUpdateHousehold: (id: string, data: Partial<Household>) => Promise<void>;
  onDeleteHousehold: (id: string) => Promise<void>;
}

export const HouseholdManagement: React.FC<HouseholdManagementProps> = ({
  currentUser,
  households,
  areas,
  onAddHousehold,
  onUpdateHousehold,
  onDeleteHousehold
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [houseNumber, setHouseNumber] = useState('');
  const [address, setAddress] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [area, setArea] = useState('');
  const [ward, setWard] = useState('Ward 1');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const defaultCoords = getAreaCenterCoordinates('Warangal Urban');
  const [latitude, setLatitude] = useState<number>(defaultCoords[0]);
  const [longitude, setLongitude] = useState<number>(defaultCoords[1]);
  const [pickupLocationNote, setPickupLocationNote] = useState('');

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Two-step Telangana hierarchy: 1. Select District -> 2. Fetch & display only that district's municipal areas
  const {
    districts,
    municipalAreas,
    isLoadingDistricts,
    isLoadingAreas
  } = useTelanganaLocationHierarchy({
    selectedDistrict,
    enabled: isAdding,
    fallbackAreas: areas
  });

  // When fetched municipal areas arrive for the chosen district, sync area/ward/PIN/map pin
  useEffect(() => {
    if (!isAdding || !selectedDistrict || isLoadingAreas) return;

    if (municipalAreas.length === 0) {
      if (!editingId) {
        setArea('');
        setWard('Ward 1');
        setPincode('');
      }
      return;
    }

    const existingMatch = municipalAreas.find((a) => a.name === area);
    if (existingMatch) {
      if (existingMatch.wards.length > 0 && !existingMatch.wards.includes(ward)) {
        setWard(existingMatch.wards[0]);
      }
      if (!pincode && existingMatch.pincode) {
        setPincode(existingMatch.pincode);
      }
      return;
    }

    const first = municipalAreas[0];
    setArea(first.name);
    setWard(first.wards[0] || 'Ward 1');
    setPincode(first.pincode || '');
    if (!editingId) {
      setLatitude(first.latitude);
      setLongitude(first.longitude);
    }
  }, [isAdding, selectedDistrict, isLoadingAreas, municipalAreas, editingId]);

  const selectedAreaObj = municipalAreas.find((a) => a.name === area);
  const availableWards = selectedAreaObj?.wards || ['Ward 1', 'Ward 2', 'Ward 3'];

  const applyAreaSelection = (nextAreaName: string, preserveCoords: boolean = false) => {
    setArea(nextAreaName);
    const sel = municipalAreas.find((a) => a.name === nextAreaName);
    if (sel) {
      if (sel.wards.length > 0) setWard(sel.wards[0]);
      if (sel.pincode) setPincode(sel.pincode);
    }
    if (!preserveCoords && nextAreaName) {
      const [lat, lng] =
        sel?.latitude !== undefined && sel?.longitude !== undefined
          ? [sel.latitude, sel.longitude]
          : getAreaCenterCoordinates(nextAreaName);
      setLatitude(lat);
      setLongitude(lng);
    }
  };

  const handleDistrictChange = (nextDistrict: string) => {
    setSelectedDistrict(nextDistrict);
    setArea('');
    setWard('Ward 1');
    setPincode('');
    if (!editingId && nextDistrict) {
      const [lat, lng] = getAreaCenterCoordinates(nextDistrict);
      setLatitude(lat);
      setLongitude(lng);
    }
  };

  const resetForm = () => {
    const [lat, lng] = getAreaCenterCoordinates('Warangal Urban');
    setHouseNumber('');
    setAddress('');
    setSelectedDistrict('');
    setArea('');
    setWard('Ward 1');
    setLandmark('');
    setPincode('');
    setLatitude(lat);
    setLongitude(lng);
    setPickupLocationNote('');
    setIsAdding(false);
    setEditingId(null);
    setErrorMsg('');
  };

  const startEdit = (h: Household) => {
    const [fallbackLat, fallbackLng] = getAreaCenterCoordinates(h.area);
    const matchedArea = areas.find((a) => a.name === h.area);
    setEditingId(h.id);
    setHouseNumber(h.houseNumber);
    setAddress(h.address);
    setSelectedDistrict(matchedArea?.district || '');
    setArea(h.area);
    setWard(h.ward);
    setLandmark(h.landmark || '');
    setPincode(h.pincode);
    setLatitude(isValidCoordinates(h.latitude, h.longitude) ? Number(h.latitude) : fallbackLat);
    setLongitude(isValidCoordinates(h.latitude, h.longitude) ? Number(h.longitude) : fallbackLng);
    setPickupLocationNote(h.pickupLocationNote || '');
    setIsAdding(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!address.trim()) {
      setErrorMsg('Street address is required');
      return;
    }
    if (!selectedDistrict.trim()) {
      setErrorMsg('Please select a District in Telangana first');
      return;
    }
    if (!area.trim()) {
      setErrorMsg('Municipal Area must be selected for the chosen district');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingId) {
        await onUpdateHousehold(editingId, {
          houseNumber,
          address,
          area,
          ward,
          landmark,
          pincode,
          latitude,
          longitude,
          pickupLocationNote: pickupLocationNote.trim() || undefined
        });
      } else {
        await onAddHousehold({
          citizenId: currentUser?.id || 'usr-cit-1',
          citizenName: currentUser?.name || 'Citizen',
          houseNumber,
          address,
          area,
          ward,
          landmark,
          pincode,
          latitude,
          longitude,
          pickupLocationNote: pickupLocationNote.trim() || undefined
        });
      }
      resetForm();
    } catch (err: any) {
      setErrorMsg(err.message || 'Operation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Home className="w-6 h-6 text-emerald-600" />
            Household Address Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Register your residential and property addresses for municipal door-to-door waste pickups.
          </p>
        </div>

        {!isAdding && (
          <button
            type="button"
            onClick={() => {
              resetForm();
              setIsAdding(true);
            }}
            className="w-full sm:w-auto justify-center min-h-[42px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add New Household
          </button>
        )}
      </div>

      {/* Add / Edit Household Form Modal / Section */}
      {isAdding && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-emerald-500/30 shadow-lg animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
            <h3 className="font-bold text-slate-900 text-sm">
              {editingId ? 'Edit Household Information' : 'Register New Collection Household'}
            </h3>
            <button
              type="button"
              onClick={resetForm}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {errorMsg && (
            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">House / Building / Flat No.</label>
                <input
                  type="text"
                  value={houseNumber}
                  onChange={(e) => setHouseNumber(e.target.value)}
                  placeholder="e.g. Plot No. 42-A, Flat 302"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Street Address & Locality <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Green Avenue, Road No. 3"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                  required
                />
              </div>

              <div>
                <label htmlFor="household-district-select" className="block font-bold text-slate-700 mb-1">
                  1. District in Telangana ({districts.length}) <span className="text-rose-500">*</span>
                </label>
                <select
                  id="household-district-select"
                  value={selectedDistrict}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  disabled={isLoadingDistricts && districts.length === 0}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                  required
                >
                  <option value="">
                    {isLoadingDistricts && districts.length === 0
                      ? 'Loading Telangana Districts...'
                      : '-- Select District in Telangana --'}
                  </option>
                  {districts.map((dist) => (
                    <option key={dist.id} value={dist.name}>
                      {dist.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="household-area-select" className="block font-bold text-slate-700 mb-1">
                  2. Municipal Area / Zone <span className="text-rose-500">*</span>
                </label>
                <select
                  id="household-area-select"
                  value={area}
                  onChange={(e) => applyAreaSelection(e.target.value, Boolean(editingId))}
                  disabled={!selectedDistrict || isLoadingAreas || municipalAreas.length === 0}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                  required
                >
                  {!selectedDistrict ? (
                    <option value="">Select District first</option>
                  ) : isLoadingAreas ? (
                    <option value="">Loading municipal areas...</option>
                  ) : municipalAreas.length === 0 ? (
                    <option value="">No municipal areas found for {selectedDistrict}</option>
                  ) : (
                    municipalAreas.map((a) => (
                      <option key={a.id} value={a.name}>
                        {a.name} ({a.zone})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Ward / Locality <span className="text-rose-500">*</span>
                </label>
                <select
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  disabled={!area}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden disabled:bg-slate-100 disabled:text-slate-400"
                  required
                >
                  {availableWards.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Nearest Landmark</label>
                <input
                  type="text"
                  value={landmark}
                  onChange={(e) => setLandmark(e.target.value)}
                  placeholder="e.g. Opposite Community Hall, Behind SBI Bank"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Postal PIN Code</label>
                <input
                  type="text"
                  value={pincode}
                  onChange={(e) => setPincode(e.target.value)}
                  placeholder="e.g. 506001"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden"
                />
              </div>
            </div>

            <PickupLocationMapPicker
              latitude={latitude}
              longitude={longitude}
              pickupLocationNote={pickupLocationNote}
              areaName={area}
              height="220px"
              label="Default Household Pickup Map Pin"
              onChange={({ latitude: nextLat, longitude: nextLng }) => {
                setLatitude(nextLat);
                setLongitude(nextLng);
              }}
              onNoteChange={setPickupLocationNote}
            />

            <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={resetForm}
                className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-5 py-2.5 sm:py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
              >
                {isSubmitting ? 'Saving...' : editingId ? 'Update Household' : 'Save Household'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Households Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {households.map((h) => (
          <div
            key={h.id}
            className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
                  <Home className="w-5 h-5" />
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(h)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                    title="Edit address"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmId(h.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    title="Delete household"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <h3 className="font-bold text-slate-900 text-sm mt-3">
                {h.houseNumber ? `${h.houseNumber}, ` : ''}{h.address}
              </h3>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                {h.area} &bull; {h.ward}
              </p>

              {h.landmark && (
                <p className="text-[11px] text-slate-400 mt-2 bg-slate-50 p-2 rounded-lg">
                  Landmark: {h.landmark}
                </p>
              )}

              {isValidCoordinates(h.latitude, h.longitude) && (
                <div className="mt-2 p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/70 text-[11px] text-emerald-900 space-y-0.5">
                  <div className="font-semibold flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                    <span>Map Pin:</span>
                    <span className="font-mono tabular-nums">
                      {formatCoordinates(Number(h.latitude), Number(h.longitude))}
                    </span>
                  </div>
                  {h.pickupLocationNote && (
                    <p className="text-slate-600 pl-4">{h.pickupLocationNote}</p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
              <span>PIN: {h.pincode}</span>
              <span>Owner: {h.citizenName}</span>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        isOpen={!!deleteConfirmId}
        title="Remove Household Address?"
        description="Are you sure you want to delete this registered collection location? Existing completed requests will preserve their records."
        isDestructive
        confirmLabel="Delete Address"
        onConfirm={async () => {
          if (deleteConfirmId) {
            await onDeleteHousehold(deleteConfirmId);
            setDeleteConfirmId(null);
          }
        }}
        onCancel={() => setDeleteConfirmId(null)}
      />
    </div>
  );
};
