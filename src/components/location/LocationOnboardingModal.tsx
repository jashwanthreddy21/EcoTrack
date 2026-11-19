import React, { useState, useEffect } from 'react';
import { UserLocationSelection } from '../../types/index.ts';
import { api } from '../../services/api.ts';
import { useTelanganaLocationHierarchy } from '../../hooks/useTelanganaLocationHierarchy.ts';
import {
  MapPin,
  Compass,
  AlertCircle,
  CheckCircle2,
  Send,
  Loader2,
  Building2
} from 'lucide-react';

interface LocationOnboardingModalProps {
  isOpen: boolean;
  onConfirm: (loc: UserLocationSelection) => void;
}

export const LocationOnboardingModal: React.FC<LocationOnboardingModalProps> = ({
  isOpen,
  onConfirm
}) => {
  // Two-step Telangana hierarchy selections
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [selectedWard, setSelectedWard] = useState<string>('');
  const [pincode, setPincode] = useState<string>('');

  // UI state
  const [isDetectingLocation, setIsDetectingLocation] = useState<boolean>(false);
  const [detectionNotice, setDetectionNotice] = useState<string | null>(null);
  const [detectedCandidate, setDetectedCandidate] = useState<UserLocationSelection | null>(null);

  // Request Service Area state
  const [showRequestForm, setShowRequestForm] = useState<boolean>(false);
  const [requestCitizenName, setRequestCitizenName] = useState('');
  const [requestEmail, setRequestEmail] = useState('');
  const [requestPhone, setRequestPhone] = useState('');
  const [requestNotes, setRequestNotes] = useState('');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);
  const [requestSubmittedSuccess, setRequestSubmittedSuccess] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);

  const {
    districts,
    selectedDistrictObj,
    municipalAreas: areas,
    isLoadingDistricts,
    isLoadingAreas
  } = useTelanganaLocationHierarchy({
    selectedDistrict,
    enabled: isOpen
  });

  // When Area changes -> auto-fill PIN code & set default Ward
  useEffect(() => {
    if (!selectedAreaId) {
      setSelectedWard('');
      setPincode('');
      return;
    }
    const matched = areas.find((a) => a.id === selectedAreaId);
    if (matched) {
      setPincode(matched.pincode || '');
      setSelectedWard(matched.wards[0] || 'Ward 1');
      if (!matched.isSupported) {
        setShowRequestForm(true);
      } else {
        setShowRequestForm(false);
      }
    }
  }, [selectedAreaId, areas]);

  const handleDistrictSelect = (districtName: string) => {
    if (districtName === selectedDistrict) return;
    setSelectedDistrict(districtName);
    setSelectedAreaId('');
    setSelectedWard('');
    setPincode('');
    setShowRequestForm(false);
    setRequestSubmittedSuccess(false);
  };

  const currentArea = areas.find((a) => a.id === selectedAreaId);
  const isSelectedAreaSupported = currentArea ? currentArea.isSupported : true;

  // Use My Current Location flow with explicit browser permission
  const handleDetectCurrentLocation = () => {
    setDetectionNotice(null);
    setDetectedCandidate(null);

    if (!navigator.geolocation) {
      setDetectionNotice('Browser Geolocation is not supported in this browser. Please select manually below.');
      return;
    }

    setIsDetectingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          const result = await api.reverseGeocodeLocation({ latitude, longitude });

          if (result && result.detected && result.location) {
            setDetectedCandidate(result.location);
            setDetectionNotice(
              `Nearby municipal area found: ${result.location.areaName} (~${result.distanceKm || 1} km away). Please review and confirm below.`
            );
          } else {
            setDetectionNotice(
              'Your coordinates were detected, but no matching municipal ward is configured yet. Please choose your Telangana district and locality below.'
            );
          }
        } catch {
          setDetectionNotice('Unable to reverse-geocode coordinates. Please choose manually.');
        } finally {
          setIsDetectingLocation(false);
        }
      },
      (error) => {
        setIsDetectingLocation(false);
        if (error.code === error.PERMISSION_DENIED) {
          setDetectionNotice(
            'Location access was not granted. Please select your Telangana District and Municipal Area below.'
          );
        } else {
          setDetectionNotice('Location detection timed out or failed. Please use manual dropdown selection.');
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  const handleApplyDetectedCandidate = () => {
    if (!detectedCandidate) return;
    onConfirm(detectedCandidate);
  };

  const handleContinueManual = () => {
    if (!selectedDistrictObj || !currentArea) return;

    const locSelection: UserLocationSelection = {
      stateId: 'state-ts',
      stateName: 'Telangana',
      districtId: selectedDistrictObj.id,
      districtName: selectedDistrictObj.name,
      cityId: currentArea.cityId || `city-${selectedDistrictObj.id}`,
      cityName: currentArea.cityName || `${selectedDistrictObj.name} Municipality`,
      areaId: currentArea.id,
      areaName: currentArea.name,
      ward: selectedWard || currentArea.wards[0] || 'Ward 1',
      pincode: pincode.trim() || currentArea.pincode,
      isSupported: currentArea.isSupported,
      confirmedAt: new Date().toISOString()
    };

    onConfirm(locSelection);
  };

  const handleSubmitServiceRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestCitizenName || !requestEmail) return;

    setIsSubmittingRequest(true);
    setRequestError(null);
    try {
      await api.submitServiceAreaRequest({
        stateName: 'Telangana',
        districtName: selectedDistrictObj?.name || selectedDistrict || 'General',
        cityName: currentArea?.cityName || `${selectedDistrict || 'Telangana'} Municipality`,
        areaName: currentArea?.name || 'Requested Locality',
        pincode: pincode || '506001',
        citizenName: requestCitizenName,
        email: requestEmail,
        phone: requestPhone,
        notes: requestNotes
      });

      setRequestSubmittedSuccess(true);
    } catch (err: any) {
      setRequestError(err?.message || 'Failed to submit service area request');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2 sm:p-4 bg-slate-900/80 backdrop-blur-md overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-y-auto max-h-[calc(100dvh-1rem)] sm:max-h-[92dvh] my-auto">
        {/* Banner with EcoTrack Brand & Graphic */}
        <div className="relative bg-gradient-to-br from-emerald-800 via-emerald-700 to-teal-800 p-4 sm:p-8 text-white overflow-hidden">
          <div className="absolute -right-8 -bottom-8 w-44 h-44 rounded-full bg-emerald-600/30 blur-2xl pointer-events-none" />
          <div className="flex items-center gap-3">
            <img
              src="/app-icon.svg"
              alt="EcoTrack App Icon"
              referrerPolicy="no-referrer"
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white p-0.5 shadow-sm border border-emerald-200/50 object-contain shrink-0"
            />
            <div className="min-w-0">
              <span className="inline-block text-[10px] sm:text-[11px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-100 border border-emerald-400/30">
                EcoTrack • Telangana Municipal Waste Platform
              </span>
              <h2 className="text-xl sm:text-3xl font-black tracking-tight text-white mt-1">
                Welcome to EcoTrack
              </h2>
            </div>
          </div>
          <p className="mt-2.5 sm:mt-3 text-xs sm:text-sm text-emerald-50 leading-relaxed font-normal max-w-xl">
            First select your District in Telangana, then pick your municipal area to view local collection schedules, assigned collectors, and recycling centers.
          </p>
        </div>

        <div className="p-4 sm:p-8 space-y-4 sm:space-y-6">
          {/* Optional Current Location Button with privacy note */}
          <div className="bg-emerald-50/60 rounded-2xl p-3.5 sm:p-4 border border-emerald-100/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-emerald-600 text-white shadow-xs shrink-0">
                <Compass className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Automatic Location Detection</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Request device geolocation once to look up your municipal ward. We never track or store coordinates silently.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDetectCurrentLocation}
              disabled={isDetectingLocation}
              className="w-full sm:w-auto min-h-[44px] shrink-0 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isDetectingLocation ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Detecting...</span>
                </>
              ) : (
                <>
                  <MapPin className="w-4 h-4" />
                  <span>Use My Current Location</span>
                </>
              )}
            </button>
          </div>

          {/* Detection Notice / Confirmation card */}
          {detectionNotice && (
            <div
              className={`p-4 rounded-2xl text-xs flex items-start gap-3 border ${
                detectedCandidate
                  ? 'bg-blue-50 border-blue-200 text-blue-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-semibold">{detectionNotice}</p>
                {detectedCandidate && (
                  <div className="mt-3 p-3 bg-white rounded-xl border border-blue-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-900">
                        {detectedCandidate.areaName}, {detectedCandidate.cityName}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        {detectedCandidate.districtName}, {detectedCandidate.stateName} • PIN {detectedCandidate.pincode}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleApplyDetectedCandidate}
                      className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition shrink-0"
                    >
                      Confirm Detected Location
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-xs uppercase font-bold tracking-wider text-slate-400">
              Or Select Manually (Telangana)
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Two-Step Dependent Dropdowns Form */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Step 1: District in Telangana */}
            <div>
              <label htmlFor="onboard-district" className="block text-xs font-bold text-slate-700 mb-1.5">
                1. District in Telangana {districts.length > 0 && <span className="text-slate-400 font-normal">({districts.length})</span>}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <select
                id="onboard-district"
                value={selectedDistrict}
                onChange={(e) => handleDistrictSelect(e.target.value)}
                disabled={isLoadingDistricts && districts.length === 0}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white text-xs font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 transition"
              >
                <option value="">
                  {isLoadingDistricts && districts.length === 0
                    ? 'Loading Districts...'
                    : '-- Select District in Telangana --'}
                </option>
                {districts.map((d) => (
                  <option key={d.id} value={d.name}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 2: Municipal Area / Locality (fetched for chosen district) */}
            <div>
              <label htmlFor="onboard-area" className="block text-xs font-bold text-slate-700 mb-1.5">
                2. Municipal Area / Locality {areas.length > 0 && <span className="text-slate-400 font-normal">({areas.length})</span>}{' '}
                <span className="text-rose-500">*</span>
              </label>
              <select
                id="onboard-area"
                value={selectedAreaId}
                onChange={(e) => setSelectedAreaId(e.target.value)}
                disabled={!selectedDistrict || isLoadingAreas || areas.length === 0}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white text-xs font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 transition"
              >
                <option value="">
                  {!selectedDistrict
                    ? 'Select District first'
                    : isLoadingAreas
                      ? 'Loading municipal areas...'
                      : areas.length === 0
                        ? 'No municipal areas found'
                        : '-- Select Municipal Area / Locality --'}
                </option>
                {areas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.zone}) {!a.isSupported ? '(Service Request Needed)' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Ward */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Ward Selection {currentArea?.wards && currentArea.wards.length > 0 && '(Available)'}
              </label>
              <select
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                disabled={!selectedAreaId || !currentArea?.wards || currentArea.wards.length === 0}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white text-xs font-medium text-slate-800 disabled:bg-slate-100 disabled:text-slate-400 transition"
              >
                {currentArea?.wards && currentArea.wards.length > 0 ? (
                  currentArea.wards.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))
                ) : (
                  <option value="">General Ward</option>
                )}
              </select>
            </div>

            {/* PIN Code */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Postal PIN Code
              </label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="e.g. 506001"
                maxLength={6}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 bg-white text-xs font-medium text-slate-800 transition"
              />
            </div>
          </div>

          {/* Area Service Info Banner (when supported area selected) */}
          {currentArea && isSelectedAreaSupported && (
            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-900 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-emerald-950">
                  Municipal Waste Collection Active in {currentArea.name}
                </p>
                <p className="mt-0.5 text-[11px] font-semibold text-emerald-700">
                  {currentArea.cityName}
                </p>
                <p className="mt-1 text-emerald-800 leading-relaxed">
                  Scheduled collection: <span className="font-semibold">{currentArea.collectionFrequency || 'Daily Morning Shifts'}</span>.
                  {currentArea.contactPhone && (
                    <span className="block mt-0.5 font-medium">Ward Helpline: {currentArea.contactPhone}</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* Unsupported Area Notice & Request Flow */}
          {currentArea && !isSelectedAreaSupported && (
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200 space-y-3">
              <div className="flex items-start gap-3 text-amber-900 text-xs">
                <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-sm text-amber-950">
                    Your location is not currently supported.
                  </p>
                  <p className="mt-0.5 text-amber-800">
                    Please select another location or contact the administrator to expand collection services to this locality.
                  </p>
                </div>
              </div>

              {!requestSubmittedSuccess ? (
                <div className="pt-2 border-t border-amber-200/80">
                  <button
                    type="button"
                    onClick={() => setShowRequestForm(!showRequestForm)}
                    className="text-xs font-bold text-amber-900 hover:text-amber-950 underline flex items-center gap-1.5"
                  >
                    <span>{showRequestForm ? 'Hide Service Area Request Form' : 'Request Municipal Service for this Area'}</span>
                  </button>

                  {showRequestForm && (
                    <form onSubmit={handleSubmitServiceRequest} className="mt-3 space-y-3 bg-white p-4 rounded-xl border border-amber-100 text-xs">
                      <p className="font-semibold text-slate-800">Request Service Area Activation</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Your Name *</label>
                          <input
                            type="text"
                            required
                            value={requestCitizenName}
                            onChange={(e) => setRequestCitizenName(e.target.value)}
                            placeholder="Full Name"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Email Address *</label>
                          <input
                            type="email"
                            required
                            value={requestEmail}
                            onChange={(e) => setRequestEmail(e.target.value)}
                            placeholder="citizen@domain.com"
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Mobile Number</label>
                          <input
                            type="tel"
                            value={requestPhone}
                            onChange={(e) => setRequestPhone(e.target.value)}
                            placeholder="+91 98..."
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 mb-1">Locality Details / Notes</label>
                          <input
                            type="text"
                            value={requestNotes}
                            onChange={(e) => setRequestNotes(e.target.value)}
                            placeholder="Colony name, number of houses..."
                            className="w-full px-3 py-2 rounded-lg border border-slate-200 text-xs"
                          />
                        </div>
                      </div>
                      {requestError && (
                        <p className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                          {requestError}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={isSubmittingRequest}
                        className="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold rounded-lg transition flex items-center gap-2"
                      >
                        {isSubmittingRequest ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                        Submit Service Area Request
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <div className="p-3 bg-emerald-100 text-emerald-900 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                  <span>Your service request has been logged. Municipal supervisors will review route expansion for this locality.</span>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleContinueManual}
              disabled={!selectedDistrict || !selectedAreaId || !isSelectedAreaSupported}
              className="w-full sm:w-auto min-h-[44px] px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs tracking-wide transition shadow-md hover:shadow-lg disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <span>Continue with Selected Location</span>
              <Building2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
