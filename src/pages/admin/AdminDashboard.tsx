import React from 'react';
import {
  Users,
  Package,
  Clock,
  CalendarCheck,
  CheckCircle2,
  AlertTriangle,
  Scale,
  Truck,
  TrendingUp,
  MapPin,
  ArrowUpRight
} from 'lucide-react';
import { StatCard } from '../../components/common/StatCard.tsx';
import { StatusBadge } from '../../components/common/StatusBadge.tsx';
import { WastePredictionChart } from '../../components/dashboard/WastePredictionChart.tsx';
import { PickupRequest } from '../../types/index.ts';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

interface AdminDashboardProps {
  analytics: any;
  pickups: PickupRequest[];
  onNavigate: (screen: any) => void;
  onSelectPickup: (p: PickupRequest) => void;
}

const PIE_COLORS = ['#16A34A', '#0284C7', '#EA580C', '#EAB308', '#8B5CF6', '#DC2626', '#475569', '#64748B'];

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  analytics,
  pickups,
  onNavigate,
  onSelectPickup
}) => {
  const kpis = analytics?.kpis || {
    totalRegisteredCitizens: 10,
    totalPickupRequests: 10,
    pendingRequests: 2,
    scheduledCollections: 2,
    completedCollections: 4,
    missedPickups: 1,
    totalWasteCollectedKg: 96.7,
    activeWasteCollectors: 5
  };

  const categoryData = analytics?.categoryDistribution || [];
  const dailyTrends = analytics?.dailyTrends || [];
  const areaComparison = analytics?.areaComparison || [];

  const recentPickups = pickups.slice(0, 5);

  return (
    <div className="space-y-5 sm:space-y-6 min-w-0">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-emerald-100 text-[11px] sm:text-xs font-semibold backdrop-blur-xs mb-2.5 sm:mb-3">
            <TrendingUp className="w-3.5 h-3.5 shrink-0" />
            Live Municipal Operations Hub
          </span>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-snug">
            Warangal Municipal Solid Waste Command Center
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-emerald-100/90 mt-2 leading-relaxed">
            Real-time monitoring of citizen pickup requests, collector shifts, landfill diversion metrics, and 4 statutory reports.
          </p>

          <div className="mt-4 sm:mt-5 flex flex-wrap gap-2.5 sm:gap-3">
            <button
              type="button"
              onClick={() => onNavigate('reports')}
              className="px-4 py-2.5 rounded-xl bg-white text-emerald-900 text-xs font-bold hover:bg-emerald-50 transition shadow-xs flex items-center gap-1.5 min-h-[40px]"
            >
              View 4 University Reports
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('ecomap')}
              className="px-4 py-2.5 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs font-bold border border-emerald-500/50 transition flex items-center gap-1.5 min-h-[40px]"
            >
              <MapPin className="w-3.5 h-3.5" />
              Open EcoMap
            </button>
          </div>
        </div>
      </div>

      {/* 8 Mandatory Admin KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Total Registered Citizens"
          value={kpis.totalRegisteredCitizens}
          subtitle="Household waste generators"
          icon={Users}
          color="emerald"
          trend="+12% this mo"
        />
        <StatCard
          title="Total Pickup Requests"
          value={kpis.totalPickupRequests}
          subtitle="All collection bookings"
          icon={Package}
          color="blue"
          trend="+8 today"
        />
        <StatCard
          title="Pending Requests"
          value={kpis.pendingRequests}
          subtitle="Awaiting supervisor approval"
          icon={Clock}
          color="amber"
          trend="Action required"
          trendPositive={false}
        />
        <StatCard
          title="Scheduled Collections"
          value={kpis.scheduledCollections}
          subtitle="Assigned to active collectors"
          icon={CalendarCheck}
          color="purple"
        />
        <StatCard
          title="Completed Collections"
          value={kpis.completedCollections}
          subtitle="Successfully weighed & dumped"
          icon={CheckCircle2}
          color="emerald"
          trend="80% rate"
        />
        <StatCard
          title="Missed Pickups"
          value={kpis.missedPickups}
          subtitle="Requires supervisor reschedule"
          icon={AlertTriangle}
          color="red"
          trend="1 open"
          trendPositive={false}
        />
        <StatCard
          title="Total Waste Collected"
          value={`${kpis.totalWasteCollectedKg} kg`}
          subtitle="Diverted to recycling/compost"
          icon={Scale}
          color="slate"
          trend="Target: 150 kg"
        />
        <StatCard
          title="Active Waste Collectors"
          value={kpis.activeWasteCollectors}
          subtitle="5 vehicles deployed today"
          icon={Truck}
          color="blue"
          trend="100% attendance"
        />
      </div>

      {/* Recharts Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        {/* Waste Category Distribution */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">Waste Category Distribution</h3>
              <p className="text-xs text-slate-500">Collected kilograms per waste stream</p>
            </div>
            <span className="text-[11px] sm:text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg shrink-0 whitespace-nowrap">
              Live DB Data
            </span>
          </div>

          <div className="h-60 sm:h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={categoryData} margin={{ top: 10, right: 8, left: -24, bottom: 24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" angle={-25} textAnchor="end" tick={{ fontSize: 10 }} interval={0} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  formatter={(val: any) => [`${val} kg`, 'Waste Weight']}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Bar dataKey="completedKg" fill="#16a34a" radius={[6, 6, 0, 0]} name="Completed (kg)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Pickup & Collection Trend */}
        <div className="bg-white rounded-2xl p-4 sm:p-6 border border-slate-200/80 shadow-xs min-w-0">
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="min-w-0">
              <h3 className="font-bold text-slate-900 text-sm sm:text-base truncate">Weekly Municipal Collection Trend</h3>
              <p className="text-xs text-slate-500">Daily bookings vs actual kg processed</p>
            </div>
            <span className="text-[11px] sm:text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg shrink-0 whitespace-nowrap">
              Current Week
            </span>
          </div>

          <div className="h-60 sm:h-64 w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyTrends} margin={{ top: 10, right: 8, left: -24, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }} />
                <Bar dataKey="requests" fill="#0284c7" radius={[4, 4, 0, 0]} name="Pickup Requests" />
                <Bar dataKey="collectedKg" fill="#16a34a" radius={[4, 4, 0, 0]} name="Waste Collected (kg)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Predictive Recharts Data Visualization: Future Waste Volume Forecast */}
      <WastePredictionChart historicalData={dailyTrends} />

      {/* Recent Pickup Requests Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 text-base">Recent Municipal Pickup Requests</h3>
            <p className="text-xs text-slate-500">Real-time submissions across all 5 wards</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('pickups')}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition"
          >
            View All Pickups &rarr;
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Request ID</th>
                <th className="py-3 px-4">Citizen</th>
                <th className="py-3 px-4">Area & Ward</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Est. Quantity</th>
                <th className="py-3 px-4">Collector</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentPickups.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4 font-bold text-slate-900">{p.requestNumber}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-800">{p.citizenName}</td>
                  <td className="py-3.5 px-4 text-slate-600">
                    {p.area} <span className="text-[11px] text-slate-400">({p.ward})</span>
                  </td>
                  <td className="py-3.5 px-4">
                    <span className="font-semibold text-slate-700">{p.categoryName}</span>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-slate-800">
                    {p.actualQuantityKg ? `${p.actualQuantityKg} kg (Act)` : `${p.quantityKg} kg`}
                  </td>
                  <td className="py-3.5 px-4 text-slate-600 font-medium">
                    {p.assignedCollectorName || <span className="text-slate-400 italic">Unassigned</span>}
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={p.status} size="sm" />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectPickup(p)}
                      className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
