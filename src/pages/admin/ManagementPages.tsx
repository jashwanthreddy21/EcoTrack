import React, { useState, useEffect } from 'react';
import { User, AreaLocation, WasteCategory, UserRole, ServiceAreaRequest, AreaHierarchyLocation } from '../../types/index.ts';
import { Users, Layers, MapPin, Check, X, Shield, Plus, ToggleLeft, ToggleRight, Inbox, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { api } from '../../services/api.ts';

interface UsersManagementProps {
  users: User[];
  onToggleStatus: (userId: string) => Promise<void>;
}

export const UsersManagement: React.FC<UsersManagementProps> = ({ users, onToggleStatus }) => {
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = users.filter(u => {
    if (roleFilter !== 'all' && u.role !== roleFilter) return false;
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.area && u.area.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-emerald-600" />
            User & Role Management
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Activate, suspend, or audit citizen, supervisor, and collector access across the municipality.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <input
            type="text"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white w-full sm:w-52"
          />
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white font-semibold text-slate-700 w-full sm:w-auto"
          >
            <option value="all">All Roles</option>
            <option value="citizen">Citizens</option>
            <option value="supervisor">Supervisors</option>
            <option value="collector">Collectors</option>
            <option value="admin">Administrators</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Area / Beat</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Account Status</th>
                <th className="py-3 px-4 text-right">Access Control</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50/60 transition">
                  <td className="py-3.5 px-4">
                    <p className="font-bold text-slate-900">{u.name}</p>
                    <p className="text-slate-400 text-[11px]">{u.email}</p>
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                        u.role === 'admin'
                          ? 'bg-purple-100 text-purple-800 border-purple-200'
                          : u.role === 'supervisor'
                          ? 'bg-blue-100 text-blue-800 border-blue-200'
                          : u.role === 'collector'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-slate-600">{u.area || 'All Areas'}</td>
                  <td className="py-3.5 px-4 text-slate-600">{u.phone || 'N/A'}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 font-semibold ${
                        u.active ? 'text-emerald-700' : 'text-slate-400'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${u.active ? 'bg-emerald-600' : 'bg-slate-400'}`} />
                      {u.active ? 'Active' : 'Suspended'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      type="button"
                      onClick={() => onToggleStatus(u.id)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        u.active
                          ? 'border border-rose-200 text-rose-700 hover:bg-rose-50'
                          : 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                      }`}
                    >
                      {u.active ? 'Deactivate' : 'Activate'}
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

interface AreasCategoriesProps {
  areas: AreaLocation[];
  categories: WasteCategory[];
  onToggleCategory: (catId: string) => Promise<void>;
  onCreateCategory: (cat: Partial<WasteCategory>) => Promise<void>;
}

export const AreasCategoriesManagement: React.FC<AreasCategoriesProps> = ({
  areas,
  categories,
  onToggleCategory,
  onCreateCategory
}) => {
  const [activeTab, setActiveTab] = useState<'categories' | 'areas' | 'service-requests'>('categories');
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [newCatInstr, setNewCatInstr] = useState('');
  const [showAddCat, setShowAddCat] = useState(false);

  // Service Area Requests from citizens
  const [serviceRequests, setServiceRequests] = useState<ServiceAreaRequest[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(false);

  // New Area Form
  const [showAddArea, setShowAddArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaZone, setNewAreaZone] = useState('Central Zone');
  const [newAreaPincode, setNewAreaPincode] = useState('506001');
  const [newAreaWards, setNewAreaWards] = useState('Ward 1, Ward 2');
  const [isSupported, setIsSupported] = useState(true);
  const [adminNotice, setAdminNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const fetchRequests = async () => {
      setIsLoadingRequests(true);
      try {
        const reqs = await api.getServiceAreaRequests();
        setServiceRequests(reqs);
      } catch (err) {
        console.warn('Failed to load service requests:', err);
      } finally {
        setIsLoadingRequests(false);
      }
    };
    fetchRequests();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    await onCreateCategory({
      name: newCatName.trim(),
      description: newCatDesc.trim(),
      instructions: newCatInstr.trim(),
      color: '#0284C7'
    });
    setNewCatName('');
    setNewCatDesc('');
    setNewCatInstr('');
    setShowAddCat(false);
  };

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;

    try {
      await api.addAreaHierarchy({
        cityId: 'city-gwmc-hnk',
        name: newAreaName.trim(),
        zone: newAreaZone,
        pincode: newAreaPincode.trim(),
        wards: newAreaWards.split(',').map((w) => w.trim()).filter(Boolean),
        isSupported
      });

      setAdminNotice({ type: 'success', text: `Area ${newAreaName.trim()} created successfully.` });
      setShowAddArea(false);
      setNewAreaName('');
    } catch (err: any) {
      setAdminNotice({ type: 'error', text: err?.message || 'Failed to add area' });
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      await api.updateServiceAreaRequestStatus(id, newStatus);
      setServiceRequests((prev) =>
        prev.map((r) => (r.id === id ? { ...r, status: newStatus as any } : r))
      );
      setAdminNotice({ type: 'success', text: `Request marked as ${newStatus}.` });
    } catch {
      setAdminNotice({ type: 'error', text: 'Failed to update status' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-6 h-6 text-emerald-600" />
            Location & Municipal Stream Administration
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage waste streams, service localities, ward boundaries, and incoming service expansion requests.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200 overflow-x-auto max-w-full">
          <button
            type="button"
            onClick={() => setActiveTab('categories')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
              activeTab === 'categories' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Waste Streams ({categories.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('areas')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 ${
              activeTab === 'areas' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Municipal Areas ({areas.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('service-requests')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'service-requests' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Inbox className="w-3.5 h-3.5 shrink-0" />
            <span>Service Requests ({serviceRequests.length})</span>
          </button>
        </div>
      </div>

      {adminNotice && (
        <div
          className={`px-4 py-2.5 rounded-2xl text-xs font-semibold flex items-center justify-between border ${
            adminNotice.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span>{adminNotice.text}</span>
          <button
            type="button"
            onClick={() => setAdminNotice(null)}
            className="text-xs font-bold underline ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: Waste Categories */}
      {activeTab === 'categories' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Active Waste Streams</h3>
            <button
              type="button"
              onClick={() => setShowAddCat(!showAddCat)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              Add Stream
            </button>
          </div>

          {showAddCat && (
            <form onSubmit={handleAdd} className="p-5 bg-white rounded-2xl border border-slate-200 text-xs space-y-3 shadow-xs">
              <h4 className="font-bold text-slate-900">Define New Waste Stream</h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Category Name (e.g. Biomedical Waste)"
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  className="p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-xs"
                  required
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  className="p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-xs"
                />
                <input
                  type="text"
                  placeholder="Handling Instructions"
                  value={newCatInstr}
                  onChange={(e) => setNewCatInstr(e.target.value)}
                  className="p-2.5 rounded-xl border border-slate-300 bg-slate-50 text-xs"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCat(false)}
                  className="px-3 py-1.5 text-slate-500 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-xl"
                >
                  Save Category
                </button>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {categories.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex flex-col justify-between text-xs">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                    <button
                      type="button"
                      onClick={() => onToggleCategory(c.id)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition ${
                        c.active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {c.active ? 'Active' : 'Inactive'}
                    </button>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm">{c.name}</h4>
                  <p className="text-slate-500 mt-1 leading-relaxed">{c.description}</p>
                  <p className="text-[11px] text-slate-600 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                    {c.instructions}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: Municipal Areas & Wards */}
      {activeTab === 'areas' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Configured Municipal Service Areas</h3>
              <p className="text-xs text-slate-500">Localities available for citizen service selection</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddArea(!showAddArea)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              Add Service Area
            </button>
          </div>

          {showAddArea && (
            <form onSubmit={handleAddArea} className="p-5 bg-white rounded-2xl border border-slate-200 text-xs space-y-3 shadow-xs">
              <h4 className="font-bold text-slate-900">Register New Service Area</h4>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <input
                  type="text"
                  placeholder="Area / Locality Name"
                  required
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  className="p-2.5 rounded-xl border border-slate-300 text-xs"
                />
                <input
                  type="text"
                  placeholder="Zone (e.g. North Zone)"
                  value={newAreaZone}
                  onChange={(e) => setNewAreaZone(e.target.value)}
                  className="p-2.5 rounded-xl border border-slate-300 text-xs"
                />
                <input
                  type="text"
                  placeholder="PIN Code"
                  value={newAreaPincode}
                  onChange={(e) => setNewAreaPincode(e.target.value)}
                  className="p-2.5 rounded-xl border border-slate-300 text-xs"
                />
                <input
                  type="text"
                  placeholder="Wards (comma-separated)"
                  value={newAreaWards}
                  onChange={(e) => setNewAreaWards(e.target.value)}
                  className="p-2.5 rounded-xl border border-slate-300 text-xs"
                />
              </div>
              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isSupported}
                    onChange={(e) => setIsSupported(e.target.checked)}
                    className="rounded text-emerald-600"
                  />
                  <span className="font-semibold text-slate-700">Active Collection Route (isSupported)</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddArea(false)}
                    className="px-3 py-1.5 text-slate-500 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-emerald-600 text-white font-bold rounded-xl"
                  >
                    Save Area
                  </button>
                </div>
              </div>
            </form>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {areas.map((a) => (
              <div key={a.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs text-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-100">
                      {a.zone}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                      Active
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-sm mt-2">{a.name}</h4>
                  <p className="text-slate-400 text-[11px] mt-0.5">{a.city}, Telangana</p>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-100">
                  <p className="text-slate-500 font-semibold mb-1">Covered Wards:</p>
                  <div className="flex flex-wrap gap-1">
                    {a.wards.map((w) => (
                      <span key={w} className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-medium">
                        {w}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Service Area Requests from Citizens (Prompt 1.3 requirement) */}
      {activeTab === 'service-requests' && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800">Citizen Service Expansion Inquiries</h3>
            <p className="text-xs text-slate-500">
              Citizens in unsupported localities submitted these requests to have municipal waste collection routes extended to their streets.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4 whitespace-nowrap">Requested Locality</th>
                    <th className="py-3 px-4 whitespace-nowrap">City & State</th>
                    <th className="py-3 px-4 whitespace-nowrap">Citizen Contact</th>
                    <th className="py-3 px-4 whitespace-nowrap">Notes / Household Count</th>
                    <th className="py-3 px-4 whitespace-nowrap">Status</th>
                    <th className="py-3 px-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {serviceRequests.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400">
                        No service area requests submitted yet.
                      </td>
                    </tr>
                  ) : (
                    serviceRequests.map((req) => (
                      <tr key={req.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-4 font-bold text-slate-900">
                          {req.areaName}
                          <span className="block text-[11px] font-normal text-slate-500">
                            PIN: {req.pincode}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-700">
                          {req.cityName}
                          <span className="block text-[11px] text-slate-400">{req.stateName}</span>
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="font-semibold text-slate-900">{req.citizenName}</p>
                          <p className="text-[11px] text-slate-500">{req.email} • {req.phone}</p>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                          <p className="truncate">{req.notes || 'No additional notes'}</p>
                          <span className="text-[10px] text-slate-400">
                            {new Date(req.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                              req.status === 'Approved'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                                : req.status === 'Under Review'
                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                : req.status === 'Rejected'
                                ? 'bg-rose-100 text-rose-800 border-rose-200'
                                : 'bg-amber-100 text-amber-800 border-amber-200'
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1">
                            {req.status === 'Pending' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(req.id, 'Under Review')}
                                className="px-2 py-1 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition whitespace-nowrap"
                              >
                                Review
                              </button>
                            )}
                            {req.status !== 'Approved' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(req.id, 'Approved')}
                                className="px-2 py-1 rounded-md text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition whitespace-nowrap"
                              >
                                Approve
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
