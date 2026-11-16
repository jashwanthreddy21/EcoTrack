import React, { useState } from 'react';
import { User, AppNotification, UserRole, UserLocationSelection } from '../../types/index.ts';
import {
  Recycle,
  Bell,
  Check,
  LogOut,
  Menu,
  X,
  UserCheck,
  ShieldAlert,
  ChevronDown,
  Sparkles,
  MapPin
} from 'lucide-react';

interface NavbarProps {
  currentUser: User | null;
  currentLocation?: UserLocationSelection | null;
  notifications: AppNotification[];
  unreadCount: number;
  onGoogleSignIn: () => void;
  onLogout: () => void;
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onToggleMobileMenu: () => void;
  isMobileMenuOpen: boolean;
  onChangeLocation?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  currentLocation,
  notifications,
  unreadCount,
  onGoogleSignIn,
  onLogout,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  onToggleMobileMenu,
  isMobileMenuOpen,
  onChangeLocation
}) => {
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-16 gap-2 min-w-0">
          {/* Left: Brand Logo & Tagline */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition shrink-0"
              aria-label="Toggle navigation menu"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-emerald-700 to-emerald-500 flex items-center justify-center text-white shadow-xs shrink-0">
                <Recycle className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-black tracking-tight text-slate-900 flex items-center gap-1.5 whitespace-nowrap">
                  <span>EcoTrack</span>
                  <span className="hidden sm:inline-flex text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 uppercase whitespace-nowrap">
                    SRU No. 54
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 hidden sm:block font-medium truncate">
                  Smarter Waste Collection. Cleaner Communities.
                </p>
              </div>
            </div>
          </div>

          {/* Center / Right: Location Badge (md+) & Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Desktop / Tablet Navigation Location Display */}
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 border border-slate-200/90 text-xs text-slate-800 shadow-2xs">
              <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
              <span className="font-bold text-slate-900 truncate max-w-[160px] xl:max-w-[200px]">
                {currentLocation ? `${currentLocation.areaName}, ${currentLocation.stateName}` : 'Select Service Location'}
              </span>
              <button
                type="button"
                onClick={onChangeLocation}
                className="ml-1 text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-white hover:bg-emerald-50 px-2 py-0.5 rounded-md border border-slate-200 transition whitespace-nowrap"
              >
                Change
              </button>
            </div>

            {/* Authenticated Role Portal Badge (Desktop lg+) */}
            {currentUser && (
              <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 capitalize whitespace-nowrap">
                <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                <span>{currentUser.role} Portal</span>
              </div>
            )}

            {/* Notifications Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 transition"
                aria-label="View notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="fixed inset-x-3 top-16 sm:inset-x-auto sm:top-auto sm:absolute sm:right-0 sm:mt-2 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 py-3 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-4 pb-2 border-b border-slate-100 flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">Notifications</h4>
                      <p className="text-xs text-slate-500">{unreadCount} unread updates</p>
                    </div>
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={onMarkAllNotificationsRead}
                        className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-xs text-center text-slate-400">No notifications yet.</p>
                    ) : (
                      notifications.slice(0, 8).map((n) => (
                        <div
                          key={n.id}
                          onClick={() => onMarkNotificationRead(n.id)}
                          className={`p-3.5 hover:bg-slate-50 cursor-pointer transition flex items-start gap-3 ${
                            !n.read ? 'bg-emerald-50/40' : ''
                          }`}
                        >
                          <span
                            className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                              !n.read ? 'bg-emerald-600' : 'bg-transparent'
                            }`}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-900">{n.title}</p>
                            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{n.message}</p>
                            <span className="text-[10px] text-slate-400 mt-1 block">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Official Sign in with Google Button */}
            <button
              type="button"
              onClick={onGoogleSignIn}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 min-h-[38px] rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shadow-xs transition shrink-0 whitespace-nowrap"
              title="Sign in with Google via Firebase Auth"
              aria-label="Sign in with Google"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="hidden sm:inline">Google Auth</span>
            </button>

            {/* User Profile / Active Role Display */}
            {currentUser && (
              <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 shrink-0">
                <div className="w-8 h-8 rounded-full bg-emerald-700 text-white font-bold text-xs flex items-center justify-center shrink-0">
                  {currentUser.name.charAt(0)}
                </div>
                <div className="hidden xl:block text-left">
                  <p className="text-xs font-bold text-slate-900 leading-tight">{currentUser.name}</p>
                  <p className="text-[10px] text-emerald-700 font-semibold capitalize">{currentUser.role}</p>
                </div>
                <button
                  type="button"
                  onClick={onLogout}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-rose-600 transition rounded-lg"
                  title="Logout"
                  aria-label="Logout"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Compact Location & Role Strip (< md) */}
      <div className="md:hidden border-t border-slate-100 bg-slate-50/95 px-3 py-1.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onChangeLocation}
          className="flex items-center gap-1.5 text-xs text-slate-800 min-w-0 flex-1 text-left"
        >
          <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
          <span className="font-bold text-slate-900 truncate">
            {currentLocation ? `${currentLocation.areaName}, ${currentLocation.cityName}` : 'Select Service Location'}
          </span>
          <span className="text-[10px] font-bold text-emerald-700 bg-white px-1.5 py-0.5 rounded border border-slate-200 shrink-0 whitespace-nowrap">
            Change
          </span>
        </button>

        {currentUser && (
          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0 whitespace-nowrap">
            {currentUser.role}
          </span>
        )}
      </div>
    </header>
  );
};
