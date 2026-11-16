import React from 'react';
import { UserRole } from '../../types/index.ts';
import {
  LayoutDashboard,
  Home,
  PlusCircle,
  Calendar,
  ListOrdered,
  Truck,
  UserCheck,
  FileBarChart,
  MapPin,
  Sparkles,
  Users,
  Settings,
  Layers,
  CheckSquare,
  MessageSquare,
  X,
  LogOut
} from 'lucide-react';

export type ActiveScreen =
  | 'admin-dashboard'
  | 'citizen-dashboard'
  | 'supervisor-dashboard'
  | 'collector-dashboard'
  | 'households'
  | 'pickups'
  | 'scheduling'
  | 'tracking'
  | 'reports'
  | 'ecomap'
  | 'locator'
  | 'workspace-ops'
  | 'users-management'
  | 'areas-categories';

interface SidebarProps {
  currentRole: UserRole;
  userName?: string;
  activeScreen: ActiveScreen;
  onNavigate: (screen: ActiveScreen) => void;
  onLogout?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  userName,
  activeScreen,
  onNavigate,
  onLogout,
  isOpen,
  onClose
}) => {
  interface NavItem {
    id: ActiveScreen;
    label: string;
    icon: React.ElementType;
    badge?: string;
  }

  const getNavItems = (): NavItem[] => {
    switch (currentRole) {
      case 'admin':
        return [
          { id: 'admin-dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
          { id: 'reports', label: 'Reports & Analytics', icon: FileBarChart, badge: '4 Required' },
          { id: 'pickups', label: 'Pickup Requests', icon: ListOrdered },
          { id: 'scheduling', label: 'Collection Schedules', icon: Calendar },
          { id: 'ecomap', label: 'Municipal EcoMap', icon: MapPin },
          { id: 'locator', label: 'AI Disposal Locator', icon: Sparkles },
          { id: 'workspace-ops', label: 'Tasks & Chat Ops', icon: CheckSquare },
          { id: 'users-management', label: 'User Directory', icon: Users },
          { id: 'areas-categories', label: 'Areas & Categories', icon: Layers },
          { id: 'households', label: 'All Households', icon: Home }
        ];

      case 'supervisor':
        return [
          { id: 'supervisor-dashboard', label: 'Supervisor Dashboard', icon: LayoutDashboard },
          { id: 'pickups', label: 'Review & Assign Requests', icon: ListOrdered },
          { id: 'scheduling', label: 'Collection Scheduling', icon: Calendar },
          { id: 'ecomap', label: 'Live Operations Map', icon: MapPin },
          { id: 'workspace-ops', label: 'Dispatch Alerts (Chat)', icon: MessageSquare },
          { id: 'reports', label: 'Operations Reports', icon: FileBarChart },
          { id: 'locator', label: 'Recycling Guide', icon: Sparkles }
        ];

      case 'collector':
        return [
          { id: 'collector-dashboard', label: 'Collector Workstation', icon: Truck },
          { id: 'ecomap', label: 'Route Navigation Map', icon: MapPin },
          { id: 'scheduling', label: 'Today’s Shift Schedule', icon: Calendar },
          { id: 'workspace-ops', label: 'Sync to Google Tasks', icon: CheckSquare }
        ];

      case 'citizen':
      default:
        return [
          { id: 'citizen-dashboard', label: 'Citizen Dashboard', icon: LayoutDashboard },
          { id: 'households', label: 'My Households', icon: Home },
          { id: 'pickups', label: 'My Pickup Requests', icon: ListOrdered },
          { id: 'tracking', label: 'Track Live Pickup', icon: Truck },
          { id: 'scheduling', label: 'Regular Schedule', icon: Calendar },
          { id: 'ecomap', label: 'Ward Collection Map', icon: MapPin },
          { id: 'locator', label: 'Smart Disposal Locator', icon: Sparkles }
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Aside */}
      <aside
        className={`fixed inset-y-0 lg:top-16 bottom-0 left-0 z-50 lg:z-30 w-72 sm:w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Mobile Drawer Header */}
          <div className="flex items-center justify-between lg:hidden pb-2 border-b border-slate-800">
            <span className="text-sm font-black text-white tracking-tight">EcoTrack Navigation</span>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Active Role Indicator Card (strictly reflects logged-in role) */}
          <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700/60">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Active Portal</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <p className="text-sm font-bold text-white mt-1 capitalize flex items-center gap-1.5">
              {currentRole} Console
            </p>
            {userName && (
              <p className="text-xs text-emerald-300 font-semibold mt-0.5 truncate">{userName}</p>
            )}
            <p className="text-[11px] text-slate-400 mt-0.5">Role-Based Access Control</p>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeScreen === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onNavigate(item.id);
                    onClose();
                  }}
                  className={`w-full min-h-[44px] flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md shrink-0 whitespace-nowrap ${
                        isActive ? 'bg-emerald-700 text-white' : 'bg-slate-800 text-emerald-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Account Sign Out & Attribution */}
        <div className="p-4 border-t border-slate-800 space-y-3 text-[11px] text-slate-500">
          {onLogout && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="w-full min-h-[40px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-rose-950/80 text-slate-200 hover:text-rose-200 border border-slate-700 hover:border-rose-800/60 text-xs font-semibold transition"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out / Switch Account</span>
            </button>
          )}
          <div>
            <p className="font-semibold text-slate-400">SR University — Project 54</p>
            <p className="mt-0.5 text-slate-500">DevOps & Full Stack B.Tech</p>
          </div>
        </div>
      </aside>
    </>
  );
};
