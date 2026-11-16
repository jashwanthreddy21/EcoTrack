import React, { useState } from 'react';
import {
  FileBarChart,
  Download,
  Printer,
  Search,
  Filter,
  BarChart2,
  Calendar,
  Layers,
  Truck,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface ReportsPageProps {
  scheduleReport: any[];
  pickupReport: any[];
  areaReport: any[];
  collectorReport: any[];
  onRefreshReports: () => Promise<void>;
}

export const ReportsPage: React.FC<ReportsPageProps> = ({
  scheduleReport,
  pickupReport,
  areaReport,
  collectorReport,
  onRefreshReports
}) => {
  const [activeReportTab, setActiveReportTab] = useState<'schedule' | 'pickup' | 'area' | 'collector'>('schedule');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState('all');
  const [exportNotice, setExportNotice] = useState('');

  // CSV Export utility
  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) {
      setExportNotice('No report records are available to export for the current location.');
      return;
    }
    setExportNotice('');
    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row =>
        headers
          .map(header => {
            const val = row[header];
            if (typeof val === 'object' && val !== null) {
              return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
            }
            return `"${String(val ?? '').replace(/"/g, '""')}"`;
          })
          .join(',')
      )
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${filename}-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Report Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">
            SR University Mandate &bull; Project No. 54
          </span>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 flex items-center gap-2">
            <FileBarChart className="w-6 h-6 text-emerald-600" />
            Statutory Municipal Waste Reports
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Official operational audit documents, area waste balances, collection schedule fulfillment, and collector KPI logs.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-initial justify-center px-3.5 py-2.5 sm:py-2 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-semibold shadow-xs transition flex items-center gap-1.5 min-h-[40px]"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>Print View</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (activeReportTab === 'schedule') exportToCSV(scheduleReport, 'ecotrack-schedule-report');
              if (activeReportTab === 'pickup') exportToCSV(pickupReport, 'ecotrack-pickup-requests-report');
              if (activeReportTab === 'area') exportToCSV(areaReport, 'ecotrack-area-waste-report');
              if (activeReportTab === 'collector') exportToCSV(collectorReport, 'ecotrack-collector-performance-report');
            }}
            className="flex-1 sm:flex-initial justify-center px-4 py-2.5 sm:py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-xs transition flex items-center gap-1.5 min-h-[40px]"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {exportNotice && (
        <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{exportNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportNotice('')}
            className="text-amber-800 font-bold hover:underline shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4 Mandatory Tabs Navigation */}
      <div className="flex items-center sm:flex-wrap gap-2 border-b border-slate-200 pb-3 overflow-x-auto -mx-1 px-1">
        <button
          type="button"
          onClick={() => setActiveReportTab('schedule')}
          className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeReportTab === 'schedule'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4 shrink-0" />
          Report 1: Collection Schedule
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab('pickup')}
          className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeReportTab === 'pickup'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 shrink-0" />
          Report 2: Pickup Requests
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab('area')}
          className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeReportTab === 'area'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <BarChart2 className="w-4 h-4 shrink-0" />
          Report 3: Area-wise Waste
        </button>

        <button
          type="button"
          onClick={() => setActiveReportTab('collector')}
          className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 ${
            activeReportTab === 'collector'
              ? 'bg-emerald-700 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Truck className="w-4 h-4 shrink-0" />
          Report 4: Collector Performance
        </button>
      </div>

      {/* REPORT 1: Collection Schedule Report */}
      {activeReportTab === 'schedule' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Report 1 — Collection Schedule Report</h3>
              <p className="text-xs text-slate-500">Scheduled route shifts, time-slot coverage, and fulfillment rates</p>
            </div>
            <span className="self-start sm:self-auto text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
              {scheduleReport.length} Scheduled Shifts
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Schedule ID</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Time Slot</th>
                  <th className="py-3 px-4">Area & Ward</th>
                  <th className="py-3 px-4">Assigned Collector</th>
                  <th className="py-3 px-4">Total Pickups</th>
                  <th className="py-3 px-4">Completed</th>
                  <th className="py-3 px-4">Pending</th>
                  <th className="py-3 px-4">Missed</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {scheduleReport.map((s, idx) => (
                  <tr key={s.scheduleId || idx} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{s.scheduleId}</td>
                    <td className="py-3.5 px-4 text-slate-800 font-medium">{s.date}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{s.timeSlot}</td>
                    <td className="py-3.5 px-4 text-slate-600">{s.area} ({s.ward})</td>
                    <td className="py-3.5 px-4 font-bold text-emerald-800">{s.collectorName}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{s.totalPickups}</td>
                    <td className="py-3.5 px-4 font-semibold text-emerald-600">{s.completedPickups}</td>
                    <td className="py-3.5 px-4 font-semibold text-amber-600">{s.pendingPickups}</td>
                    <td className="py-3.5 px-4 font-semibold text-rose-600">{s.missedPickups}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border">
                        {s.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 2: Pickup Request Report */}
      {activeReportTab === 'pickup' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Report 2 — Pickup Request Report</h3>
              <p className="text-xs text-slate-500">Citizen requests, household addresses, waste categories, and audit status</p>
            </div>
            <span className="self-start sm:self-auto text-xs font-semibold px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg">
              {pickupReport.length} Registered Requests
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Request ID</th>
                  <th className="py-3 px-4">Citizen</th>
                  <th className="py-3 px-4">Household Address</th>
                  <th className="py-3 px-4">Waste Category</th>
                  <th className="py-3 px-4">Quantity (kg)</th>
                  <th className="py-3 px-4">Request Date</th>
                  <th className="py-3 px-4">Scheduled Date</th>
                  <th className="py-3 px-4">Assigned Collector</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pickupReport.map((p, idx) => (
                  <tr key={p.requestId || idx} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900">{p.requestId}</td>
                    <td className="py-3.5 px-4 font-medium text-slate-800">{p.citizenName}</td>
                    <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">{p.address}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-700">{p.categoryName}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">
                      {p.actualQuantityKg ? `${p.actualQuantityKg} (Act)` : p.quantityKg}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">{p.requestDate}</td>
                    <td className="py-3.5 px-4 text-slate-600">{p.scheduledDate}</td>
                    <td className="py-3.5 px-4 font-semibold text-sky-700">{p.collectorName}</td>
                    <td className="py-3.5 px-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border">
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* REPORT 3: Area-wise Waste Report */}
      {activeReportTab === 'area' && (
        <div className="space-y-6">
          {/* Comparison Chart */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 min-w-0">
            <h3 className="font-bold text-slate-900 text-base mb-1">Area-wise Waste Collection Comparison</h3>
            <p className="text-xs text-slate-500 mb-4">Total kilograms of solid waste diverted per municipal zone</p>

            <div className="h-72 sm:h-64 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={areaReport} margin={{ top: 10, right: 12, left: -12, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="area"
                    tick={{ fontSize: 10 }}
                    interval={0}
                    angle={-24}
                    textAnchor="end"
                    height={56}
                    tickFormatter={(v: string) => (v && v.length > 14 ? `${v.slice(0, 12)}…` : v)}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    formatter={(val: any) => [`${val} kg`, 'Waste Weight']}
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                  <Bar dataKey="totalCollectedWasteKg" fill="#16a34a" radius={[6, 6, 0, 0]} name="Waste Collected (kg)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6">
            <div className="pb-3 border-b border-slate-100 mb-4">
              <h3 className="font-bold text-slate-900 text-base">Report 3 — Area-wise Waste Report Table</h3>
              <p className="text-xs text-slate-500">Zone-by-zone waste metrics, completed shifts, and missed counts</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Municipal Area</th>
                    <th className="py-3 px-4">Wards Covered</th>
                    <th className="py-3 px-4">Total Requests</th>
                    <th className="py-3 px-4">Waste Collected (kg)</th>
                    <th className="py-3 px-4">Completed Collections</th>
                    <th className="py-3 px-4">Missed Collections</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {areaReport.map((a, idx) => (
                    <tr key={a.area || idx} className="hover:bg-slate-50/60 transition">
                      <td className="py-3.5 px-4 font-bold text-slate-900">{a.area}</td>
                      <td className="py-3.5 px-4 text-slate-600">{a.ward}</td>
                      <td className="py-3.5 px-4 font-bold text-slate-800">{a.totalRequests}</td>
                      <td className="py-3.5 px-4 font-bold text-emerald-700">{a.totalCollectedWasteKg} kg</td>
                      <td className="py-3.5 px-4 font-semibold text-emerald-600">{a.completedCollections}</td>
                      <td className="py-3.5 px-4 font-semibold text-rose-600">{a.missedCollections}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* REPORT 4: Collector Performance Report */}
      {activeReportTab === 'collector' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs p-4 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Report 4 — Collector Performance Report</h3>
              <p className="text-xs text-slate-500">
                Formula: Completion Rate = (Completed Pickups / Total Assigned Pickups) &times; 100
              </p>
            </div>
            <span className="self-start sm:self-auto text-xs font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded-lg">
              Active Municipal Fleet: {collectorReport.length} Drivers
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Collector Name</th>
                  <th className="py-3 px-4">Contact Phone</th>
                  <th className="py-3 px-4">Zone Beat</th>
                  <th className="py-3 px-4">Assigned Pickups</th>
                  <th className="py-3 px-4">Completed Pickups</th>
                  <th className="py-3 px-4">Pending</th>
                  <th className="py-3 px-4">Missed</th>
                  <th className="py-3 px-4">Total Weight (kg)</th>
                  <th className="py-3 px-4">Completion Rate</th>
                  <th className="py-3 px-4">Avg. Time (min)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {collectorReport.map((c, idx) => (
                  <tr key={c.collectorId || idx} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-1.5">
                      <Truck className="w-3.5 h-3.5 text-emerald-600" />
                      {c.collectorName}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">{c.phone}</td>
                    <td className="py-3.5 px-4 text-slate-700">{c.area}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-800">{c.assignedPickups}</td>
                    <td className="py-3.5 px-4 font-semibold text-emerald-600">{c.completedPickups}</td>
                    <td className="py-3.5 px-4 font-semibold text-amber-600">{c.pendingPickups}</td>
                    <td className="py-3.5 px-4 font-semibold text-rose-600">{c.missedPickups}</td>
                    <td className="py-3.5 px-4 font-bold text-slate-900">{c.totalCollectedKg} kg</td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-700">{c.completionRate}%</span>
                        <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full"
                            style={{ width: `${Math.min(100, c.completionRate)}%` }}
                          />
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {c.averageCompletionTimeMinutes} mins
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
