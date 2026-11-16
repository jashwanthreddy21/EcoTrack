import React, { useState } from 'react';
import { Household, WasteCategory, UserLocationSelection } from '../../types/index.ts';
import { X, UploadCloud, AlertCircle, MapPin, Phone } from 'lucide-react';
import { PickupLocationMapPicker } from '../../components/maps/PickupLocationMapPicker.tsx';
import { getAreaCenterCoordinates, isValidCoordinates, validatePhoneNumber } from '../../utils/ecoLogic.ts';

interface RequestPickupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    householdId: string;
    categoryId: string;
    quantityKg: number;
    preferredDate: string;
    preferredTimeSlot: string;
    citizenPhone?: string;
    specialInstructions?: string;
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    pickupLocationNote?: string;
  }) => Promise<void>;
  households: Household[];
  categories: WasteCategory[];
  isSubmitting?: boolean;
  defaultLocation?: UserLocationSelection | null;
  defaultCitizenPhone?: string;
}

export const RequestPickupModal: React.FC<RequestPickupModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  households,
  categories,
  isSubmitting = false,
  defaultLocation,
  defaultCitizenPhone = ''
}) => {
  const [householdId, setHouseholdId] = useState(households[0]?.id || '');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [quantityKg, setQuantityKg] = useState<number>(10);
  const [preferredDate, setPreferredDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [preferredTimeSlot, setPreferredTimeSlot] = useState('09:00 AM – 12:00 PM');
  const [citizenPhone, setCitizenPhone] = useState<string>(defaultCitizenPhone);
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState('');

  const initialHousehold = households[0];
  const initialCenter =
    initialHousehold && isValidCoordinates(initialHousehold.latitude, initialHousehold.longitude)
      ? [Number(initialHousehold.latitude), Number(initialHousehold.longitude)]
      : getAreaCenterCoordinates(initialHousehold?.area || defaultLocation?.areaName);

  const [pinnedLat, setPinnedLat] = useState<number>(initialCenter[0]);
  const [pinnedLng, setPinnedLng] = useState<number>(initialCenter[1]);
  const [pickupLocationNote, setPickupLocationNote] = useState<string>(
    initialHousehold?.pickupLocationNote || ''
  );

  React.useEffect(() => {
    if (defaultCitizenPhone && !citizenPhone) {
      setCitizenPhone(defaultCitizenPhone);
    }
  }, [defaultCitizenPhone, citizenPhone]);

  React.useEffect(() => {
    if ((!householdId || !households.some(h => h.id === householdId)) && households.length > 0) {
      setHouseholdId(households[0].id);
    }
  }, [households, householdId]);

  React.useEffect(() => {
    const selectedHh = households.find(h => h.id === householdId);
    if (selectedHh) {
      if (isValidCoordinates(selectedHh.latitude, selectedHh.longitude)) {
        setPinnedLat(Number(selectedHh.latitude));
        setPinnedLng(Number(selectedHh.longitude));
      } else {
        const [lat, lng] = getAreaCenterCoordinates(selectedHh.area || defaultLocation?.areaName);
        setPinnedLat(lat);
        setPinnedLng(lng);
      }
      if (selectedHh.pickupLocationNote) {
        setPickupLocationNote(selectedHh.pickupLocationNote);
      }
    } else if (defaultLocation?.areaName) {
      const [lat, lng] = getAreaCenterCoordinates(defaultLocation.areaName);
      setPinnedLat(lat);
      setPinnedLng(lng);
    }
  }, [householdId, households, defaultLocation?.areaName]);

  React.useEffect(() => {
    if ((!categoryId || !categories.some(c => c.id === categoryId)) && categories.length > 0) {
      setCategoryId(categories[0].id);
    }
  }, [categories, categoryId]);

  if (!isOpen) return null;

  const timeSlots = [
    '06:00 AM – 09:00 AM',
    '09:00 AM – 12:00 PM',
    '12:00 PM – 03:00 PM',
    '03:00 PM – 06:00 PM'
  ];

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrorMsg('Image size cannot exceed 5MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetHouseholdId = householdId || households[0]?.id || '';
    const targetCategoryId = categoryId || categories[0]?.id || '';

    if (!targetHouseholdId) {
      setErrorMsg('Please select a collection household address');
      return;
    }
    if (!targetCategoryId) {
      setErrorMsg('Please select a waste category');
      return;
    }
    if (!quantityKg || quantityKg <= 0) {
      setErrorMsg('Estimated waste quantity must be greater than 0 kg');
      return;
    }
    if (!preferredDate) {
      setErrorMsg('Preferred collection date is required');
      return;
    }

    const phoneCheck = validatePhoneNumber(citizenPhone);
    if (!phoneCheck.valid) {
      setErrorMsg(phoneCheck.error || 'Please provide a valid contact phone number');
      return;
    }

    try {
      await onSubmit({
        householdId: targetHouseholdId,
        categoryId: targetCategoryId,
        quantityKg: Number(quantityKg),
        preferredDate,
        preferredTimeSlot,
        citizenPhone: phoneCheck.normalized,
        specialInstructions,
        imageUrl: imagePreview,
        latitude: pinnedLat,
        longitude: pinnedLng,
        pickupLocationNote: pickupLocationNote.trim() || undefined
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit pickup request');
    }
  };

  const selectedCategory = categories.find(c => c.id === categoryId);
  const selectedHousehold = households.find(h => h.id === householdId) || households[0];

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full p-4 sm:p-8 shadow-2xl border border-slate-200 max-h-[calc(100dvh-1.25rem)] sm:max-h-[90vh] overflow-y-auto my-auto">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
              Citizen Service Request
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 mt-0.5">Book Waste Pickup</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-xl transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {defaultLocation && (
            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                <span className="font-semibold break-words">
                  Active Service Area: {defaultLocation.areaName}, {defaultLocation.cityName}
                </span>
              </div>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-200/60 text-emerald-900 shrink-0 whitespace-nowrap">
                {defaultLocation.ward || 'Ward 1'}
              </span>
            </div>
          )}

          {/* Household Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Select Household Address <span className="text-rose-500">*</span>
            </label>
            {households.length === 0 ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                No household addresses registered yet. Please add a household address first.
              </div>
            ) : (
              <select
                value={householdId}
                onChange={(e) => setHouseholdId(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                required
              >
                {households.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.houseNumber ? `${h.houseNumber}, ` : ''}{h.address} ({h.area} — {h.ward})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Interactive Map Pin for Exact Pickup Spot */}
          <PickupLocationMapPicker
            latitude={pinnedLat}
            longitude={pinnedLng}
            pickupLocationNote={pickupLocationNote}
            areaName={selectedHousehold?.area || defaultLocation?.areaName}
            height="220px"
            label="Pin Exact Waste Pickup Location on Map"
            onChange={({ latitude, longitude }) => {
              setPinnedLat(latitude);
              setPinnedLng(longitude);
            }}
            onNoteChange={setPickupLocationNote}
          />

          {/* Waste Category Selection */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Waste Category <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {categories.map((c) => {
                const isSelected = categoryId === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategoryId(c.id)}
                    className={`p-2.5 text-left rounded-xl border text-xs transition flex flex-col justify-between ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-2 ring-emerald-600/20'
                        : 'border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <span>{c.name}</span>
                    <span className="w-2 h-2 rounded-full mt-2" style={{ backgroundColor: c.color }} />
                  </button>
                );
              })}
            </div>

            {selectedCategory && (
              <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <span className="font-semibold text-slate-700">Collection Instructions: </span>
                {selectedCategory.instructions}
              </p>
            )}
          </div>

          {/* Estimated Quantity (kg) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Quantity (kg) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="500"
                step="0.5"
                value={quantityKg}
                onChange={(e) => setQuantityKg(parseFloat(e.target.value) || 0)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                required
              />
            </div>

            {/* Preferred Date */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Preferred Date <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={preferredDate}
                onChange={(e) => setPreferredDate(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                required
              />
            </div>

            {/* Time Slot */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Preferred Time Slot <span className="text-rose-500">*</span>
              </label>
              <select
                value={preferredTimeSlot}
                onChange={(e) => setPreferredTimeSlot(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                required
              >
                {timeSlots.map((slot) => (
                  <option key={slot} value={slot}>
                    {slot}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contact Phone for Collector */}
          <div>
            <label htmlFor="pickup-citizen-phone" className="block text-xs font-bold text-slate-700 mb-1">
              Contact Phone Number (Shown to Collector) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
              <input
                id="pickup-citizen-phone"
                type="tel"
                value={citizenPhone}
                onChange={(e) => setCitizenPhone(e.target.value)}
                placeholder="+91 98480 12345"
                autoComplete="tel"
                className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-mono tabular-nums font-medium"
                required
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              So the waste collector can call you regarding your pickup arrival.
            </p>
          </div>

          {/* Special Instructions */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Special Handling Instructions
            </label>
            <textarea
              rows={2}
              value={specialInstructions}
              onChange={(e) => setSpecialInstructions(e.target.value)}
              placeholder="e.g., Gate key code, keep by front porch, heavy sacks require two collectors"
              className="w-full text-xs rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium placeholder:text-slate-400"
            />
          </div>

          {/* Optional Image Attachment (Section 21 of prompt) */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Waste Photo Attachment (Optional)
            </label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 hover:bg-slate-100 cursor-pointer text-xs font-semibold text-slate-700 transition">
                <UploadCloud className="w-4 h-4 text-emerald-600" />
                <span>Upload Image</span>
                <input
                  type="file"
                  accept="image/png, image/jpeg, image/webp"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
              {imagePreview && (
                <div className="flex items-center gap-2">
                  <img src={imagePreview} alt="Preview" className="w-10 h-10 object-cover rounded-lg border" />
                  <button
                    type="button"
                    onClick={() => setImagePreview('')}
                    className="text-[11px] text-rose-600 hover:underline font-semibold"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Accepted: PNG, JPEG up to 5MB.</p>
          </div>

          {/* Submit Buttons */}
          <div className="pt-4 border-t border-slate-100 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto min-h-[42px] px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition border border-slate-200 sm:border-transparent"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || households.length === 0}
              className="w-full sm:w-auto min-h-[42px] px-5 py-2.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Pickup Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
