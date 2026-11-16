import React, { useState } from 'react';
import {
  Package,
  Clock,
  CalendarCheck,
  Truck,
  CheckCircle2,
  AlertTriangle,
  UserCheck,
  Calendar,
  Search,
  Filter,
  Check,
  X,
  AlertCircle
} from 'lucide-react';
import { StatCard } from '../../components/common/StatCard.tsx';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { PickupRequest, User } from '../../types/index.ts';
import { formatCoordinates, isValidCoordinates } from '../../utils/ecoLogic.ts';

interface SupervisorDashboardProps {
  currentUser?: User | null;
  pickups: PickupRequest[];
  collectors: User[];
  onApproveRequest: (id: string) => Promise<void>;
  onRejectRequest: (id: string, reason?: string) => Promise<void>;
  onAssignCollector: (data: {
    pickupId: string;
    collectorId: string;
    scheduledDate: string;
    scheduledTimeSlot: string;
  }) => Promise<void>;
  onRescheduleMissed: (data: {
    pickupId: string;
    collectorId: string;
    scheduledDate: string;
    scheduledTimeSlot: string;
  }) => Promise<void>;
  onSelectPickup: (p: PickupRequest) => void;
}

export const SupervisorDashboard: React.FC<SupervisorDashboardProps> = ({
  currentUser,
  pickups,
  collectors,
  onApproveRequest,
  onRejectRequest,
  onAssignCollector,
  onRescheduleMissed,
  onSelectPickup
}) => {
  const [selectedPickupForAssign, setSelectedPickupForAssign] = useState<PickupRequest | null>(null);
  const [assignCollectorId, setAssignCollectorId] = useState(collectors[0]?.id || '');
  const [assignDate, setAssignDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [assignSlot, setAssignSlot] = useState('09:00 AM – 12:00 PM');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [assignError, setAssignError] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  const timeSlots = [
    '06:00 AM – 09:00 AM',
    '09:00 AM – 12:00 PM',
    '12:00 PM – 03:00 PM',
    '03:00 PM – 06:00 PM'
  ];

  // Stats
  const total = pickups.length;
  const unassigned = pickups.filter(p => !p.assignedCollectorId && p.status !== 'Completed' && p.status !== 'Cancelled').length;
  const scheduled = pickups.filter(p => p.status === 'Scheduled' || p.status === 'Assigned').length;
  const activeCollectorsCount = collectors.filter(c => c.active).length;
  const completed = pickups.filter(p => p.status === 'Completed').length;
  const missed = pickups.filter(p => p.status === 'Missed').length;

  const filteredPickups = pickups.filter(p => {
    if (statusFilter !== 'all' && p.status !== statusFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return (
        p.requestNumber.toLowerCase().includes(q) ||
        p.citizenName.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.categoryName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const openAssignModal = (p: PickupRequest) => {
    setSelectedPickupForAssign(p);
    setAssignCollectorId(p.assignedCollectorId || collectors[0]?.id || '');
    setAssignDate(p.scheduledDate || p.preferredDate || new Date().toISOString().split('T')[0]);
    setAssignSlot(p.scheduledTimeSlot || p.preferredTimeSlot || '09:00 AM – 12:00 PM');
    setAssignError('');
  };

  const handleExecuteAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPickupForAssign) return;
    setAssignError('');
    setIsAssigning(true);

    try {
      if (selectedPickupForAssign.status === 'Missed') {
        await onRescheduleMissed({
          pickupId: selectedPickupForAssign.id,
          collectorId: assignCollectorId,
          scheduledDate: assignDate,
          scheduledTimeSlot: assignSlot
        });
      } else {
        await onAssignCollector({
          pickupId: selectedPickupForAssign.id,
          collectorId: assignCollectorId,
          scheduledDate: assignDate,
          scheduledTimeSlot: assignSlot
        });
      }
      setSelectedPickupForAssign(null);
    } catch (err: any) {
      setAssignError(err.message || 'Failed to assign collector');
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6 min-w-0">
      {/* Supervisor Header */}
      <div className="bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-900 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-md">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-blue-200 tracking-wider uppercase">
            Field Operations Supervisor Portal
          </span>
          {currentUser && (
            <span className="text-xs font-bold px-3 py-1 rounded-full bg-white/15 border border-white/20 text-white">
              Supervisor: {currentUser.name}
            </span>
          )}
        </div>
        <h1 className="text-xl sm:text-3xl font-extrabold mt-1">
          {currentUser ? `Welcome, ${currentUser.name}` : 'Daily Collection & Dispatch Hub'}
        </h1>
        <p className="text-xs sm:text-sm text-blue-100/90 mt-1 max-w-xl">
          {currentUser?.area ? `Zone: ${currentUser.area} • ` : ''}Approve incoming requests, allocate collection shifts, prevent driver slot overlaps, and resolve missed pickups.
        </p>
      </div>

      {/* 6 Supervisor Summary Cards (Section 10) */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard title="Total Pickups" value={total} icon={Package} color="blue" />
        <StatCard title="Unassigned" value={unassigned} icon={Clock} color="amber" />
        <StatCard title="Scheduled" value={scheduled} icon={CalendarCheck} color="purple" />
        <StatCard title="Active Collectors" value={activeCollectorsCount} icon={Truck} color="emerald" />
        <StatCard title="Completed" value={completed} icon={CheckCircle2} color="emerald" />
        <StatCard title="Missed Pickups" value={missed} icon={AlertTriangle} color="red" />
      </div>

      {/* Requests Management Table with Search & Filter */}
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h3 className="font-bold text-slate-900 text-sm sm:text-base">Municipal Pickup Requests Operations</h3>
            <p className="text-xs text-slate-500">Approve submissions, assign active collectors, or reschedule</p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search citizen, ID, street..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-xs w-full sm:w-56 bg-slate-50 focus:bg-white focus:outline-hidden"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="py-2 px-3 rounded-xl border border-slate-200 text-xs bg-slate-50 font-medium text-slate-700 w-full sm:w-auto"
            >
              <option value="all">All Statuses</option>
              <option value="Submitted">Submitted (New)</option>
              <option value="Pending Approval">Pending Approval</option>
              <option value="Approved">Approved</option>
              <option value="Assigned">Assigned</option>
              <option value="In Progress">In Progress</option>
              <option value="Completed">Completed</option>
              <option value="Missed">Missed (Action Needed)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Request ID</th>
                <th className="py-3 px-4">Citizen & Address</th>
                <th className="py-3 px-4">Waste Stream</th>
                <th className="py-3 px-4">Date / Slot</th>
                <th className="py-3 px-4">Current Collector</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Supervisor Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredPickups.map((p) => {
                const isPending = p.status === 'Submitted' || p.status === 'Pending Approval';
                const canAssign = ['Approved', 'Scheduled', 'Assigned', 'Missed'].includes(p.status);

                return (
                  <tr key={p.id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{p.requestNumber}</td>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-slate-800">{p.citizenName}</p>
                      <p className="text-slate-500 text-[11px] truncate max-w-xs">{p.address}</p>
                      {isValidCoordinates(p.latitude, p.longitude) && (
                        <p className="text-[10px] font-mono tabular-nums text-emerald-700 mt-0.5">
                          Pin: {formatCoordinates(Number(p.latitude), Number(p.longitude))}
                          {p.pickupLocationNote ? ` • ${p.pickupLocationNote}` : ''}
                        </p>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-700">{p.categoryName}</span>
                      <span className="text-[11px] text-slate-400 block">{p.quantityKg} kg est.</span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <p className="font-medium text-slate-800">{p.scheduledDate || p.preferredDate}</p>
                      <p className="text-[11px] text-slate-400">{p.scheduledTimeSlot || p.preferredTimeSlot}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      {p.assignedCollectorName ? (
                        <span className="font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-100">
                          {p.assignedCollectorName}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None assigned</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={p.status} size="sm" />
                    </td>
                    <td className="py-3.5 px-4 text-right space-x-1">
                      {isPending && (
                        <>
                          <button
                            type="button"
                            onClick={() => onApproveRequest(p.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-xs hover:bg-emerald-700 transition"
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            onClick={() => onRejectRequest(p.id)}
                            className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 font-semibold text-xs hover:bg-slate-200 transition"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {canAssign && (
                        <button
                          type="button"
                          onClick={() => openAssignModal(p)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                            p.status === 'Missed'
                              ? 'bg-rose-600 text-white hover:bg-rose-700'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                        >
                          {p.status === 'Missed' ? 'Reschedule' : p.assignedCollectorId ? 'Reassign' : 'Assign'}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onSelectPickup(p)}
                        className="px-2 py-1 text-slate-400 hover:text-slate-700 font-medium"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Collector Assignment Modal with Conflict Prevention */}
      {selectedPickupForAssign && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-200 max-h-[calc(100dvh-1.5rem)] overflow-y-auto my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">
                  Operational Scheduling
                </span>
                <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                  {selectedPickupForAssign.status === 'Missed' ? 'Reschedule Missed Pickup' : 'Assign Waste Collector'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPickupForAssign(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <p className="font-bold text-slate-800">{selectedPickupForAssign.requestNumber}</p>
              <p className="text-slate-600 mt-0.5">{selectedPickupForAssign.address} ({selectedPickupForAssign.area})</p>
              <p className="text-slate-500 mt-0.5">Category: {selectedPickupForAssign.categoryName} &bull; {selectedPickupForAssign.quantityKg} kg</p>
            </div>

            {assignError && (
              <div className="mt-3 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{assignError}</span>
              </div>
            )}

            <form onSubmit={handleExecuteAssign} className="mt-4 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Active Collector *</label>
                <select
                  value={assignCollectorId}
                  onChange={(e) => setAssignCollectorId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-blue-600 focus:outline-hidden font-medium"
                  required
                >
                  {collectors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — Area: {c.area || 'All Areas'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Collection Shift Date *</label>
                <input
                  type="date"
                  value={assignDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-blue-600 focus:outline-hidden font-medium"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Time Slot Window *</label>
                <select
                  value={assignSlot}
                  onChange={(e) => setAssignSlot(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 focus:bg-white focus:border-blue-600 focus:outline-hidden font-medium"
                  required
                >
                  {timeSlots.map((slot) => (
                    <option key={slot} value={slot}>
                      {slot}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedPickupForAssign(null)}
                  className="px-3.5 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAssigning}
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xs transition"
                >
                  {isAssigning ? 'Scheduling...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
