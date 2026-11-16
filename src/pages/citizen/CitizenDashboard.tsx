import React from 'react';
import {
  Package,
  Clock,
  CalendarCheck,
  CheckCircle2,
  PlusCircle,
  Home,
  MapPin,
  Calendar,
  Truck,
  ArrowRight
} from 'lucide-react';
import { StatCard } from '../../components/common/StatCard.tsx';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { Household, PickupRequest, User, UserLocationSelection } from '../../types/index.ts';

interface CitizenDashboardProps {
  currentUser: User | null;
  pickups: PickupRequest[];
  households: Household[];
  onOpenRequestModal: () => void;
  onNavigate: (screen: any) => void;
  onSelectPickup: (p: PickupRequest) => void;
  selectedLocation?: UserLocationSelection | null;
  onChangeLocation?: () => void;
}

export const CitizenDashboard: React.FC<CitizenDashboardProps> = ({
  currentUser,
  pickups,
  households,
  onOpenRequestModal,
  onNavigate,
  onSelectPickup,
  selectedLocation,
  onChangeLocation
}) => {
  const citizenPickups = currentUser
    ? pickups.filter(p => p.citizenId === currentUser.id)
    : pickups;

  const total = citizenPickups.length;
  const pending = citizenPickups.filter(p => p.status === 'Submitted' || p.status === 'Pending Approval').length;
  const scheduled = citizenPickups.filter(p => p.status === 'Scheduled' || p.status === 'Assigned' || p.status === 'Collector On The Way' || p.status === 'In Progress').length;
  const completed = citizenPickups.filter(p => p.status === 'Completed').length;

  const activePickup = citizenPickups.find(
    p => p.status === 'Collector On The Way' || p.status === 'In Progress' || p.status === 'Assigned'
  );

  return (
    <div className="space-y-5 sm:space-y-6 min-w-0">
      {/* Citizen Welcome Card */}
      <div className="bg-gradient-to-r from-emerald-800 to-teal-700 rounded-2xl sm:rounded-3xl p-5 sm:p-8 text-white shadow-md flex flex-col md:flex-row md:items-center md:justify-between gap-4 sm:gap-6">
        <div className="min-w-0">
          <span className="text-xs font-bold text-emerald-200 tracking-wider uppercase">
            Citizen Resident Portal
          </span>
          <h1 className="text-xl sm:text-3xl font-extrabold mt-1">
            Welcome back, {currentUser?.name || 'Citizen'}!
          </h1>
          {selectedLocation && (
            <div className="mt-2 inline-flex flex-wrap items-center gap-1.5 px-3 py-1.5 rounded-2xl sm:rounded-full bg-white/15 backdrop-blur-xs text-xs font-semibold text-emerald-100 border border-white/20 max-w-full">
              <MapPin className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
              <span className="break-words">Service Area: {selectedLocation.areaName}, {selectedLocation.cityName} ({selectedLocation.ward || 'Ward 1'})</span>
              {onChangeLocation && (
                <button
                  type="button"
                  onClick={onChangeLocation}
                  className="ml-1 text-[10px] text-white underline font-bold hover:text-emerald-200 whitespace-nowrap"
                >
                  Change
                </button>
              )}
            </div>
          )}
          <p className="text-xs sm:text-sm text-emerald-100/90 mt-2 max-w-xl">
            Book segregated household waste collections, monitor assigned waste trucks, and track your environmental contribution.
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenRequestModal}
          className="w-full md:w-auto min-h-[44px] px-5 py-3 rounded-2xl bg-white text-emerald-900 font-bold text-sm shadow-md hover:bg-emerald-50 transition flex items-center justify-center gap-2 shrink-0"
        >
          <PlusCircle className="w-5 h-5 text-emerald-600" />
          Request Waste Pickup
        </button>
      </div>

      {/* 4 Citizen Dashboard Cards (Section 9) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Pickup Requests"
          value={total}
          subtitle="Your submitted bookings"
          icon={Package}
          color="emerald"
        />
        <StatCard
          title="Pending Requests"
          value={pending}
          subtitle="Under supervisor review"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Scheduled Pickups"
          value={scheduled}
          subtitle="Collector dispatched/assigned"
          icon={CalendarCheck}
          color="blue"
        />
        <StatCard
          title="Completed Pickups"
          value={completed}
          subtitle="Collected & safely recycled"
          icon={CheckCircle2}
          color="purple"
        />
      </div>

      {/* Active Pickup Live Progress Tracker (if any) */}
      {activePickup && (
        <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 border-2 border-emerald-500/30 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
            <div>
              <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                <Truck className="w-4 h-4 animate-bounce" />
                Active Pickup Tracking
              </span>
              <h3 className="text-lg font-bold text-slate-900 mt-0.5">
                {activePickup.requestNumber} — {activePickup.categoryName} ({activePickup.quantityKg} kg)
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={activePickup.status} />
              <button
                type="button"
                onClick={() => {
                  onSelectPickup(activePickup);
                  onNavigate('tracking');
                }}
                className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 text-xs font-bold hover:bg-emerald-100 transition"
              >
                Track Live &rarr;
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <p className="text-slate-400 font-medium">Collection Address</p>
              <p className="font-semibold text-slate-800 mt-0.5">{activePickup.address}</p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Assigned Collector</p>
              <p className="font-semibold text-slate-800 mt-0.5">
                {activePickup.assignedCollectorName || 'Dispatching'}
              </p>
            </div>
            <div>
              <p className="text-slate-400 font-medium">Scheduled Window</p>
              <p className="font-semibold text-slate-800 mt-0.5">
                {activePickup.scheduledDate} ({activePickup.scheduledTimeSlot || activePickup.preferredTimeSlot})
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Two Column Layout: Household Addresses & Recent Requests */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Registered Households */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Home className="w-4 h-4 text-emerald-600" />
                Registered Households
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('households')}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
              >
                Manage
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {households.length === 0 ? (
                <p className="text-xs text-slate-400">No registered households found.</p>
              ) : (
                households.slice(0, 3).map((h) => (
                  <div key={h.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
                    <p className="font-bold text-slate-900">
                      {h.houseNumber ? `${h.houseNumber}, ` : ''}{h.address}
                    </p>
                    <p className="text-slate-500 mt-0.5">
                      {h.area} &bull; {h.ward} &bull; PIN {h.pincode}
                    </p>
                    {h.landmark && (
                      <p className="text-[11px] text-slate-400 mt-1 italic">Landmark: {h.landmark}</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigate('households')}
            className="mt-4 w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition"
          >
            + Add Another Household Address
          </button>
        </div>

        {/* Right: My Pickup Requests List */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">My Pickup Requests</h3>
              <p className="text-xs text-slate-500">History of scheduled and past collections</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('pickups')}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              View All ({citizenPickups.length})
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {citizenPickups.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                You have not booked any waste collection requests yet.
              </div>
            ) : (
              citizenPickups.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  onClick={() => {
                    onSelectPickup(p);
                    onNavigate('tracking');
                  }}
                  className="py-3 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 cursor-pointer transition text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{p.requestNumber}</span>
                      <StatusBadge status={p.status} size="sm" />
                    </div>
                    <p className="text-slate-600 mt-0.5">
                      {p.categoryName} &bull; {p.quantityKg} kg &bull; Date: {p.preferredDate}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="hidden sm:inline text-[11px] font-medium text-slate-500">
                      {p.assignedCollectorName || 'Pending'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
