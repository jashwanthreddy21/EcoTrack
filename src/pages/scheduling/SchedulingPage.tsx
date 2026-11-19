import React, { useEffect, useState } from 'react';
import { CollectionSchedule, User, AreaLocation } from '../../types/index.ts';
import { Calendar, Plus, Clock, MapPin, Truck, Check, X, Users, AlertCircle } from 'lucide-react';
import { useTelanganaLocationHierarchy } from '../../hooks/useTelanganaLocationHierarchy.ts';

interface SchedulingPageProps {
  schedules: CollectionSchedule[];
  collectors: User[];
  areas: AreaLocation[];
  onCreateSchedule: (data: {
    date: string;
    timeSlot: string;
    area: string;
    ward?: string;
    collectorId: string;
    totalPickups?: number;
  }) => Promise<void>;
}

export const SchedulingPage: React.FC<SchedulingPageProps> = ({
  schedules,
  collectors,
  areas,
  onCreateSchedule
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [timeSlot, setTimeSlot] = useState('06:00 AM – 09:00 AM');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [area, setArea] = useState('');
  const [ward, setWard] = useState('Ward 1');
  const [collectorId, setCollectorId] = useState(collectors[0]?.id || '');
  const [totalPickups, setTotalPickups] = useState(12);

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    districts,
    municipalAreas,
    isLoadingDistricts,
    isLoadingAreas
  } = useTelanganaLocationHierarchy({
    selectedDistrict,
    enabled: isModalOpen,
    fallbackAreas: areas
  });

  useEffect(() => {
    if (!isModalOpen || !selectedDistrict || isLoadingAreas) return;
    if (municipalAreas.length === 0) {
      setArea('');
      setWard('Ward 1');
      return;
    }
    const existing = municipalAreas.find((a) => a.name === area);
    if (existing) {
      if (existing.wards.length > 0 && !existing.wards.includes(ward)) {
        setWard(existing.wards[0]);
      }
      return;
    }
    const first = municipalAreas[0];
    setArea(first.name);
    setWard(first.wards[0] || 'Ward 1');
  }, [isModalOpen, selectedDistrict, isLoadingAreas, municipalAreas]);

  const timeSlots = [
    '06:00 AM – 09:00 AM',
    '09:00 AM – 12:00 PM',
    '12:00 PM – 03:00 PM',
    '03:00 PM – 06:00 PM'
  ];

  const selectedAreaObj = municipalAreas.find(a => a.name === area);
  const availableWards = selectedAreaObj?.wards || ['Ward 1', 'Ward 2'];

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (!selectedDistrict.trim() || !area.trim()) {
      setErrorMsg('Please select a Telangana District and Municipal Area');
      return;
    }
    setIsSubmitting(true);

    try {
      await onCreateSchedule({
        date,
        timeSlot,
        area,
        ward,
        collectorId,
        totalPickups: Number(totalPickups) || 10
      });
      setIsModalOpen(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create collection schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-emerald-600" />
            Collection Scheduling & Shift Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Configure municipal regular beat routes, allocate daily collection time windows, and assign collector vehicles.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === 'list' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600'
              }`}
            >
              List View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-1.5 rounded-lg transition ${
                viewMode === 'calendar' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600'
              }`}
            >
              Calendar
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 min-h-[40px]"
          >
            <Plus className="w-4 h-4" />
            Create Schedule
          </button>
        </div>
      </div>

      {/* Schedules Display */}
      {viewMode === 'list' ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Schedule ID</th>
                  <th className="py-3 px-4">Shift Date</th>
                  <th className="py-3 px-4">Time Slot Window</th>
                  <th className="py-3 px-4">Municipal Area & Ward</th>
                  <th className="py-3 px-4">Assigned Collector</th>
                  <th className="py-3 px-4">Target Pickups</th>
                  <th className="py-3 px-4">Progress / Completed</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {schedules.map((s) => {
                  const percent = s.totalPickups > 0 ? Math.round((s.completedPickups / s.totalPickups) * 100) : 0;
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{s.id}</td>
                      <td className="py-3.5 px-4 font-medium text-slate-800">{s.date}</td>
                      <td className="py-3.5 px-4 font-semibold text-slate-700">{s.timeSlot}</td>
                      <td className="py-3.5 px-4 text-slate-600">
                        {s.area} <span className="text-[11px] text-slate-400">({s.ward})</span>
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-700 flex items-center gap-1.5 mt-1">
                        <Truck className="w-3.5 h-3.5" />
                        {s.collectorName}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{s.totalPickups} households</td>
                      <td className="py-3.5 px-4">
                        <div className="w-32">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-medium mb-1">
                            <span>{s.completedPickups} done</span>
                            <span>{percent}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            s.status === 'Completed'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : s.status === 'In Progress'
                              ? 'bg-amber-100 text-amber-800 border-amber-200'
                              : 'bg-blue-100 text-blue-800 border-blue-200'
                          }`}
                        >
                          {s.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Calendar Schedule Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {schedules.map((s) => (
            <div key={s.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                  <span className="font-bold text-slate-900">{s.date}</span>
                  <span className="font-semibold text-emerald-700">{s.timeSlot}</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm mt-3">{s.area}</h4>
                <p className="text-xs text-slate-500">{s.ward}</p>
                <p className="text-xs font-semibold text-slate-700 mt-2 flex items-center gap-1.5">
                  <Truck className="w-3.5 h-3.5 text-emerald-600" />
                  {s.collectorName}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Completed: {s.completedPickups}/{s.totalPickups}</span>
                <span className="font-bold text-emerald-600">{s.status}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Schedule Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[calc(100dvh-1.5rem)] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">Create Collection Schedule</h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreate} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Collection Date *</label>
                <input
                  type="date"
                  value={date}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Time Slot Window *</label>
                <select
                  value={timeSlot}
                  onChange={(e) => setTimeSlot(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                  required
                >
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">1. District in Telangana *</label>
                <select
                  value={selectedDistrict}
                  onChange={(e) => {
                    setSelectedDistrict(e.target.value);
                    setArea('');
                    setWard('Ward 1');
                  }}
                  disabled={isLoadingDistricts && districts.length === 0}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                  required
                >
                  <option value="">-- Select District --</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">2. Municipal Area *</label>
                <select
                  value={area}
                  onChange={(e) => {
                    setArea(e.target.value);
                    const sel = municipalAreas.find(a => a.name === e.target.value);
                    if (sel && sel.wards.length > 0) setWard(sel.wards[0]);
                  }}
                  disabled={!selectedDistrict || isLoadingAreas || municipalAreas.length === 0}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium disabled:bg-slate-100 disabled:text-slate-400"
                  required
                >
                  {!selectedDistrict ? (
                    <option value="">Select District first</option>
                  ) : isLoadingAreas ? (
                    <option value="">Loading municipal areas...</option>
                  ) : municipalAreas.length === 0 ? (
                    <option value="">No areas available</option>
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
                <label className="block font-bold text-slate-700 mb-1">Ward *</label>
                <select
                  value={ward}
                  onChange={(e) => setWard(e.target.value)}
                  disabled={!area}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium disabled:bg-slate-100 disabled:text-slate-400"
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
                <label className="block font-bold text-slate-700 mb-1">Assign Active Collector *</label>
                <select
                  value={collectorId}
                  onChange={(e) => setCollectorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                  required
                >
                  {collectors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Target Pickups Capacity</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={totalPickups}
                  onChange={(e) => setTotalPickups(parseInt(e.target.value, 10) || 10)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-emerald-600 focus:outline-hidden font-medium"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto px-3.5 py-2.5 sm:py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs transition"
                >
                  {isSubmitting ? 'Creating...' : 'Save Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
