import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from './services/api.ts';
import {
  User,
  Household,
  WasteCategory,
  PickupRequest,
  CollectionSchedule,
  AreaLocation,
  AppNotification,
  UserRole
} from './types/index.ts';
import {
  INITIAL_USERS,
  INITIAL_HOUSEHOLDS,
  INITIAL_CATEGORIES,
  INITIAL_PICKUPS,
  INITIAL_SCHEDULES,
  INITIAL_AREAS,
  INITIAL_NOTIFICATIONS
} from './services/seedData.ts';
import { initAuthListener, signInWithGoogle, logoutFirebase, testFirestoreConnection } from './services/firebase.ts';

// Layout & Common
import { Navbar } from './components/layout/Navbar.tsx';
import { Sidebar, ActiveScreen } from './components/layout/Sidebar.tsx';
import { ToastContainer, ToastMessage } from './components/common/Toast.tsx';
import { QrCompletionSuccessOverlay } from './components/collector/QrCompletionSuccessOverlay.tsx';
import { MapboxView } from './components/maps/MapboxView.tsx';

// Location & Chatbot Integration
import { LocationProvider, useLocation } from './context/LocationContext.tsx';
import { LocationOnboardingModal } from './components/location/LocationOnboardingModal.tsx';
import { LocationChangeModal } from './components/location/LocationChangeModal.tsx';
import { EcoBot } from './components/chat/EcoBot.tsx';
import { MapPin, Building2 } from 'lucide-react';
import {
  getDefaultScreenForRole,
  resolveAccessibleScreen,
  scopePickupsForUser,
  parseAuthRoute,
  QrSuccessFeedbackData,
  buildQrSuccessFeedbackData
} from './utils/ecoLogic.ts';

// Screens
import { LoginPage } from './pages/auth/LoginPage.tsx';
import { AdminDashboard } from './pages/admin/AdminDashboard.tsx';
import { CitizenDashboard } from './pages/citizen/CitizenDashboard.tsx';
import { HouseholdManagement } from './pages/citizen/HouseholdManagement.tsx';
import { RequestPickupModal } from './pages/citizen/RequestPickupModal.tsx';
import { PickupTrackingPage } from './pages/citizen/PickupTrackingPage.tsx';
import { SupervisorDashboard } from './pages/supervisor/SupervisorDashboard.tsx';
import { CollectorDashboard } from './pages/collector/CollectorDashboard.tsx';
import { SchedulingPage } from './pages/scheduling/SchedulingPage.tsx';
import { ReportsPage } from './pages/reports/ReportsPage.tsx';
import { WorkspaceOpsPage } from './pages/workspace/WorkspaceOpsPage.tsx';
import { EcoLocatorPage } from './pages/locator/EcoLocatorPage.tsx';
import { UsersManagement, AreasCategoriesManagement } from './pages/admin/ManagementPages.tsx';

const SESSION_USER_KEY = 'ecotrack_session_user';
const SESSION_TOKEN_KEY = 'ecotrack_session_token';

function loadSessionUser(): User | null {
  try {
    const raw = sessionStorage.getItem(SESSION_USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function AppContent() {
  // Location Context
  const {
    selectedLocation,
    isLocationSet,
    isLoadingLocation,
    isChangeModalOpen,
    setIsChangeModalOpen,
    confirmLocation
  } = useLocation();

  // Authentication & Role (always prompt login unless active session exists)
  const initialUser = loadSessionUser();
  const [currentUser, setCurrentUser] = useState<User | null>(initialUser);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(!!initialUser);
  const [authPathname, setAuthPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );
  const [activeScreen, setActiveScreen] = useState<ActiveScreen>(
    initialUser ? getDefaultScreenForRole(initialUser.role) : 'citizen-dashboard'
  );
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const navigateAuthRoute = (path: string) => {
    if (typeof window !== 'undefined' && window.location.pathname !== path) {
      window.history.pushState({}, '', path);
    }
    setAuthPathname(path);
  };

  // Application Data States
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [households, setHouseholds] = useState<Household[]>(INITIAL_HOUSEHOLDS);
  const [categories, setCategories] = useState<WasteCategory[]>(INITIAL_CATEGORIES);
  const [pickups, setPickups] = useState<PickupRequest[]>(INITIAL_PICKUPS);
  const [schedules, setSchedules] = useState<CollectionSchedule[]>(INITIAL_SCHEDULES);
  const [areas, setAreas] = useState<AreaLocation[]>(INITIAL_AREAS);
  const [notifications, setNotifications] = useState<AppNotification[]>(INITIAL_NOTIFICATIONS);

  // Selected state for tracking / modals
  const [selectedPickup, setSelectedPickup] = useState<PickupRequest | null>(INITIAL_PICKUPS[0]);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [qrSuccessFeedback, setQrSuccessFeedback] = useState<QrSuccessFeedbackData | null>(null);
  const qrSuccessTimerRef = useRef<number | null>(null);

  // Reports data
  const [scheduleReport, setScheduleReport] = useState<any[]>([]);
  const [pickupReport, setPickupReport] = useState<any[]>([]);
  const [areaReport, setAreaReport] = useState<any[]>([]);
  const [collectorReport, setCollectorReport] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);

  // Toast feedback helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const dismissQrSuccessFeedback = useCallback(() => {
    if (qrSuccessTimerRef.current !== null) {
      window.clearTimeout(qrSuccessTimerRef.current);
      qrSuccessTimerRef.current = null;
    }
    setQrSuccessFeedback(null);
  }, []);

  const triggerQrSuccessFeedback = useCallback((pickup: PickupRequest) => {
    if (qrSuccessTimerRef.current !== null) {
      window.clearTimeout(qrSuccessTimerRef.current);
    }
    setQrSuccessFeedback(buildQrSuccessFeedbackData(pickup));
    qrSuccessTimerRef.current = window.setTimeout(() => {
      qrSuccessTimerRef.current = null;
      setQrSuccessFeedback(null);
    }, 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (qrSuccessTimerRef.current !== null) {
        window.clearTimeout(qrSuccessTimerRef.current);
      }
    };
  }, []);

  const isFetchingDataRef = useRef(false);

  // Load initial data from Express backend & sync
  const fetchAllData = async () => {
    if (isFetchingDataRef.current) return;
    isFetchingDataRef.current = true;
    try {
      const [
        pickupsData,
        householdsData,
        schedulesData,
        analyticsData,
        repSchedule,
        repPickup,
        repArea,
        repCollector,
        usersData
      ] = await Promise.all([
        api.getPickups(),
        api.getHouseholds(),
        api.getSchedules(),
        api.getDashboardAnalytics(),
        api.getCollectionScheduleReport(),
        api.getPickupRequestReport(),
        api.getAreaWiseWasteReport(),
        api.getCollectorPerformanceReport(),
        api.getUsers()
      ]);

      if (pickupsData) setPickups(pickupsData);
      if (householdsData) setHouseholds(householdsData);
      if (schedulesData) setSchedules(schedulesData);
      if (analyticsData) setAnalytics(analyticsData);
      if (repSchedule?.data) setScheduleReport(repSchedule.data);
      if (repPickup?.data) setPickupReport(repPickup.data);
      if (repArea?.data) setAreaReport(repArea.data);
      if (repCollector?.data) setCollectorReport(repCollector.data);
      if (usersData) setUsers(usersData);
    } catch (err) {
      console.warn('API data fetch notice, using seed data state:', err);
    } finally {
      isFetchingDataRef.current = false;
    }
  };

  useEffect(() => {
    const onPopState = () => {
      setAuthPathname(window.location.pathname);
    };
    window.addEventListener('popstate', onPopState);

    const savedToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (savedToken) {
      api.setToken(savedToken);
    }

    if (initialUser) {
      fetchAllData();
    }
    testFirestoreConnection();

    // Setup Firebase Auth listener (quietly sync access token if already signed in)
    const unsubscribe = initAuthListener(
      (_firebaseUser, token) => {
        if (token) api.setToken(token);
      },
      () => {
        // signed out
      }
    );

    return () => {
      window.removeEventListener('popstate', onPopState);
      unsubscribe();
    };
  }, []);

  const completeAuthSession = (user: User, token?: string) => {
    setCurrentUser(user);
    setIsAuthenticated(true);
    setActiveScreen(getDefaultScreenForRole(user.role));
    setIsMobileMenuOpen(false);
    try {
      sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
      if (token) {
        sessionStorage.setItem(SESSION_TOKEN_KEY, token);
        api.setToken(token);
      }
    } catch {
      // ignore storage errors
    }
    fetchAllData();
  };

  const handleLogout = () => {
    logoutFirebase();
    api.setToken(null);
    try {
      sessionStorage.removeItem(SESSION_USER_KEY);
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
    } catch {
      // ignore
    }
    setIsMobileMenuOpen(false);
    setIsAuthenticated(false);
    setCurrentUser(null);
    navigateAuthRoute('/');
  };

  // Google Sign-In with Firebase Auth (Citizen portal auth or Workspace linking)
  const handleGoogleSignIn = async () => {
    try {
      const result = await signInWithGoogle();
      if (result) {
        if (!isAuthenticated) {
          if (result.user.email) {
            const authRes = await api.googleLogin(
              result.user.email,
              result.user.displayName || 'EcoTrack Citizen',
              'citizen'
            );
            if (result.accessToken) api.setToken(result.accessToken);
            completeAuthSession(authRes.user, authRes.token);
            showToast(`Signed in as ${authRes.user.name} (${authRes.user.role})`, 'success');
          }
        } else {
          if (result.accessToken) api.setToken(result.accessToken);
          showToast(
            result.user.email
              ? `Google Workspace linked for ${result.user.email}`
              : `Welcome, ${result.user.displayName || 'Google User'}!`,
            'success'
          );
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Google Sign-in failed', 'error');
    }
  };

  // Pickup Request Creation
  const handleCreatePickup = async (data: {
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
  }) => {
    try {
      const created = await api.createPickup({
        citizenId: currentUser?.id || 'usr-cit-1',
        ...data
      });
      if (currentUser && !currentUser.phone && data.citizenPhone) {
        const updatedUser = { ...currentUser, phone: data.citizenPhone };
        setCurrentUser(updatedUser);
        sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(updatedUser));
      }
      setPickups((prev) => [created, ...prev]);
      setSelectedPickup(created);
      showToast(`Pickup request ${created.requestNumber} booked successfully!`, 'success');
      fetchAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to submit pickup', 'error');
      throw err;
    }
  };

  // Update exact pickup map pin coordinates
  const handleUpdatePickupLocation = async (
    pickupId: string,
    payload: { latitude: number; longitude: number; pickupLocationNote?: string }
  ) => {
    try {
      const updated = await api.updatePickupLocation(pickupId, {
        ...payload,
        changedBy: currentUser?.id,
        changedByName: currentUser?.name
      });
      setPickups((prev) => prev.map((p) => (p.id === pickupId ? updated : p)));
      if (selectedPickup?.id === pickupId) setSelectedPickup(updated);
      showToast(`Map pin updated for ${updated.requestNumber}`, 'success');
      fetchAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update map location', 'error');
      throw err;
    }
  };

  // Status progression update
  const handleUpdateStatus = async (
    pickupId: string,
    nextStatus: any,
    extra?: any
  ) => {
    try {
      const updated = await api.updatePickupStatus(pickupId, nextStatus, {
        ...extra,
        changedBy: currentUser?.id,
        changedByName: currentUser?.name
      });

      setPickups((prev) => prev.map((p) => (p.id === pickupId ? updated : p)));
      if (selectedPickup?.id === pickupId) setSelectedPickup(updated);
      showToast(`Status updated to ${nextStatus}`, 'success');
      fetchAllData();
    } catch (err: any) {
      showToast(err.message || 'Failed to update status', 'error');
      throw err;
    }
  };

  // QR-Verified Pickup Completion
  const handleVerifyQrCompletion = async (
    pickupId: string,
    payload: {
      scannedCode: string;
      actualQuantityKg: number;
      completionRemarks?: string;
    }
  ): Promise<PickupRequest> => {
    try {
      const updated = await api.verifyPickupByQr(pickupId, {
        ...payload,
        collectorId: currentUser?.id,
        changedBy: currentUser?.id,
        changedByName: currentUser?.name
      });

      setPickups((prev) => prev.map((p) => (p.id === pickupId ? updated : p)));
      if (selectedPickup?.id === pickupId) setSelectedPickup(updated);
      triggerQrSuccessFeedback(updated);
      fetchAllData();
      return updated;
    } catch (err: any) {
      showToast(err.message || 'QR verification failed', 'error');
      throw err;
    }
  };

  // Collector Assignment
  const handleAssignCollector = async (data: {
    pickupId: string;
    collectorId: string;
    scheduledDate: string;
    scheduledTimeSlot: string;
  }) => {
    try {
      const updated = await api.assignCollector({
        ...data,
        supervisorId: currentUser?.id
      });
      setPickups((prev) => prev.map((p) => (p.id === data.pickupId ? updated : p)));
      showToast(`Collector assigned for ${updated.requestNumber}`, 'success');
      fetchAllData();
    } catch (err: any) {
      showToast(err.message || 'Assignment failed', 'error');
      throw err;
    }
  };

  // Household add/edit/delete
  const handleAddHousehold = async (data: Partial<Household>) => {
    try {
      const created = await api.createHousehold(data);
      setHouseholds((prev) => [...prev, created]);
      showToast('Household address saved!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to save household', 'error');
    }
  };

  const handleUpdateHousehold = async (id: string, data: Partial<Household>) => {
    try {
      const updated = await api.updateHousehold(id, data);
      setHouseholds((prev) => prev.map((h) => (h.id === id ? updated : h)));
      showToast('Household updated!', 'success');
    } catch (err: any) {
      showToast(err.message || 'Failed to update household', 'error');
    }
  };

  const handleDeleteHousehold = async (id: string) => {
    try {
      await api.deleteHousehold(id);
      setHouseholds((prev) => prev.filter((h) => h.id !== id));
      showToast('Household deleted.', 'info');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete household', 'error');
    }
  };

  // Notification helpers
  const handleMarkNotificationRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    try {
      await api.markNotificationRead(id);
    } catch {
      // ignore
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    try {
      await api.markAllNotificationsRead(currentUser?.id);
    } catch {
      // ignore
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (!isAuthenticated || !currentUser) {
    const { view } = parseAuthRoute(authPathname);
    return (
      <>
        <LoginPage
          key={view}
          view={view}
          onNavigateRoute={navigateAuthRoute}
          onLogin={async (identifier, pwd) => {
            const res = await api.login(identifier, pwd);
            completeAuthSession(res.user, res.token);
            showToast(`Signed in as ${res.user.name} (${res.user.role})`, 'success');
          }}
          onRegisterCitizen={async (data) => {
            const res = await api.register(data);
            setHouseholds((prev) => [...prev, res.household]);
            setUsers((prev) => [...prev, res.user]);
            completeAuthSession(res.user, res.token);
            showToast(`Account created for ${res.user.name}!`, 'success');
          }}
          onRegisterStaff={async (data) => {
            const res = await api.registerStaff(data);
            setUsers((prev) => [...prev, res.user]);
            completeAuthSession(res.user, res.token);
            showToast(`Welcome, ${res.user.name}!`, 'success');
          }}
          onGoogleSignIn={handleGoogleSignIn}
        />
        <ToastContainer
          toasts={toasts}
          onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        />
      </>
    );
  }

  const collectors = users.filter((u) => u.role === 'collector');
  const accessibleScreen = resolveAccessibleScreen(currentUser.role, activeScreen);
  const scopedPickups = scopePickupsForUser(pickups, currentUser);
  const activeSelectedPickup =
    scopedPickups.find((p) => p.id === selectedPickup?.id) || scopedPickups[0] || null;

  const navigateForRole = (targetScreen: string) => {
    setActiveScreen(resolveAccessibleScreen(currentUser.role, targetScreen));
  };

  return (
    <div className="min-h-screen bg-slate-100/70 font-sans text-slate-800 antialiased flex flex-col overflow-x-hidden">
      {/* Top Navbar */}
      <Navbar
        currentUser={currentUser}
        currentLocation={selectedLocation}
        notifications={notifications}
        unreadCount={unreadCount}
        onGoogleSignIn={handleGoogleSignIn}
        onLogout={handleLogout}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        isMobileMenuOpen={isMobileMenuOpen}
        onChangeLocation={() => setIsChangeModalOpen(true)}
      />

      <div className="flex-1 flex max-w-7xl w-full mx-auto min-w-0">
        {/* Left Sidebar (strictly scoped to currentUser.role) */}
        <Sidebar
          currentRole={currentUser.role}
          userName={currentUser.name}
          activeScreen={accessibleScreen}
          onNavigate={navigateForRole}
          onLogout={handleLogout}
          isOpen={isMobileMenuOpen}
          onClose={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <main className="flex-1 p-3 sm:p-6 lg:p-8 lg:ml-64 min-w-0 w-full overflow-x-hidden pb-20 sm:pb-8">
          {isLoadingLocation && !isLocationSet ? (
            <div className="p-6 sm:p-8 max-w-xl mx-auto my-6 sm:my-12 text-center bg-white rounded-3xl border border-slate-200/90 shadow-md space-y-3">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center animate-pulse">
                <MapPin className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-slate-800">Checking service location...</p>
              <p className="text-xs text-slate-500">Verifying your municipal service area configuration.</p>
            </div>
          ) : !isLocationSet ? (
            <div className="p-6 sm:p-8 max-w-xl mx-auto my-6 sm:my-12 text-center bg-white rounded-3xl border border-slate-200/90 shadow-md space-y-4">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-inner">
                <MapPin className="w-8 h-8 animate-bounce text-emerald-700" />
              </div>
              <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-emerald-100">
                First-Time Setup
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900">Welcome to EcoTrack</h2>
              <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                Select your location to discover waste collection services available in your area. Your selected location determines municipal schedules, route collectors, and neighborhood recycling hubs.
              </p>
              <button
                type="button"
                onClick={() => setIsChangeModalOpen(true)}
                className="w-full sm:w-auto px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 mx-auto min-h-[44px]"
              >
                <Building2 className="w-4 h-4" />
                <span>Select Your Service Location</span>
              </button>
            </div>
          ) : (
            <>
              {/* SCREEN ROUTING (strictly guarded by role) */}
              {accessibleScreen === 'admin-dashboard' && (
                <AdminDashboard
                  analytics={analytics}
                  pickups={pickups}
                  onNavigate={navigateForRole}
                  onSelectPickup={(p) => {
                    setSelectedPickup(p);
                    navigateForRole('tracking');
                  }}
                />
              )}

              {accessibleScreen === 'citizen-dashboard' && (
                <CitizenDashboard
                  currentUser={currentUser}
                  selectedLocation={selectedLocation}
                  onChangeLocation={() => setIsChangeModalOpen(true)}
                  pickups={scopedPickups}
                  households={households.filter((h) => h.citizenId === currentUser.id)}
                  onOpenRequestModal={() => setIsRequestModalOpen(true)}
                  onNavigate={navigateForRole}
                  onSelectPickup={(p) => {
                    setSelectedPickup(p);
                    navigateForRole('tracking');
                  }}
                />
              )}

          {accessibleScreen === 'supervisor-dashboard' && (
            <SupervisorDashboard
              currentUser={currentUser}
              pickups={pickups}
              collectors={collectors}
              onApproveRequest={async (id) => handleUpdateStatus(id, 'Approved')}
              onRejectRequest={async (id) => handleUpdateStatus(id, 'Rejected')}
              onAssignCollector={handleAssignCollector}
              onRescheduleMissed={handleAssignCollector}
              onSelectPickup={(p) => {
                setSelectedPickup(p);
                navigateForRole('tracking');
              }}
            />
          )}

          {accessibleScreen === 'collector-dashboard' && (
            <CollectorDashboard
              currentUser={currentUser}
              pickups={scopedPickups}
              onUpdateStatus={handleUpdateStatus}
              onVerifyQrCompletion={handleVerifyQrCompletion}
              onSelectPickup={(p) => {
                setSelectedPickup(p);
                navigateForRole('tracking');
              }}
              onNavigateToMap={() => navigateForRole('ecomap')}
              onLocateOnMap={(p) => {
                setSelectedPickup(p);
                navigateForRole('ecomap');
              }}
            />
          )}

          {accessibleScreen === 'households' && (
            <HouseholdManagement
              currentUser={currentUser}
              households={
                currentUser.role === 'admin'
                  ? households
                  : households.filter((h) => h.citizenId === currentUser.id)
              }
              areas={areas}
              onAddHousehold={handleAddHousehold}
              onUpdateHousehold={handleUpdateHousehold}
              onDeleteHousehold={handleDeleteHousehold}
            />
          )}

          {accessibleScreen === 'pickups' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
                <div>
                  <h1 className="text-xl font-bold text-slate-900">
                    {currentUser.role === 'citizen' ? 'My Pickup Requests' : 'Pickup Requests Directory'}
                  </h1>
                  <p className="text-xs text-slate-500 mt-1">
                    {currentUser.role === 'citizen'
                      ? 'Track and manage your household waste collection requests.'
                      : 'Manage and inspect all municipal waste collection service requests.'}
                  </p>
                </div>
                {currentUser.role === 'citizen' && (
                  <button
                    type="button"
                    onClick={() => setIsRequestModalOpen(true)}
                    className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition"
                  >
                    + Book New Pickup
                  </button>
                )}
              </div>

              {/* Table */}
              <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="py-3 px-4">Request ID</th>
                        <th className="py-3 px-4">Citizen</th>
                        <th className="py-3 px-4">Address</th>
                        <th className="py-3 px-4">Waste Stream</th>
                        <th className="py-3 px-4">Quantity</th>
                        <th className="py-3 px-4">Scheduled Slot</th>
                        <th className="py-3 px-4">Assigned Collector</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {scopedPickups.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-4 font-bold text-slate-900">{p.requestNumber}</td>
                          <td className="py-3.5 px-4 font-semibold text-slate-800">{p.citizenName}</td>
                          <td className="py-3.5 px-4 text-slate-600 max-w-xs truncate">{p.address}</td>
                          <td className="py-3.5 px-4 font-semibold text-slate-700">{p.categoryName}</td>
                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {p.actualQuantityKg ? `${p.actualQuantityKg} kg (Act)` : `${p.quantityKg} kg`}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600">
                            {p.scheduledDate || p.preferredDate} ({p.scheduledTimeSlot || p.preferredTimeSlot})
                          </td>
                          <td className="py-3.5 px-4 font-medium text-emerald-800">
                            {p.assignedCollectorName || <span className="text-slate-400 italic">Unassigned</span>}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border">
                              {p.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPickup(p);
                                navigateForRole('tracking');
                              }}
                              className="px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                            >
                              Track &rarr;
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {accessibleScreen === 'tracking' && (
            <PickupTrackingPage
              pickups={scopedPickups}
              selectedPickup={activeSelectedPickup}
              onSelectPickup={(p) => setSelectedPickup(p)}
              onCancelPickup={async (id) => handleUpdateStatus(id, 'Cancelled')}
              onUpdatePickupLocation={handleUpdatePickupLocation}
              onViewOnMap={(p) => {
                setSelectedPickup(p);
                navigateForRole('ecomap');
              }}
              onBack={() => navigateForRole(getDefaultScreenForRole(currentUser.role))}
            />
          )}

          {accessibleScreen === 'scheduling' && (
            <SchedulingPage
              schedules={schedules}
              collectors={collectors}
              areas={areas}
              onCreateSchedule={async (data) => {
                const created = await api.createSchedule(data);
                setSchedules((prev) => [created, ...prev]);
                showToast(`Schedule ${created.id} created!`, 'success');
              }}
            />
          )}

          {accessibleScreen === 'reports' && (
            <ReportsPage
              scheduleReport={scheduleReport}
              pickupReport={pickupReport}
              areaReport={areaReport}
              collectorReport={collectorReport}
              onRefreshReports={fetchAllData}
            />
          )}

          {accessibleScreen === 'ecomap' && (
            <div className="space-y-4">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Municipal EcoMap{selectedLocation?.cityName ? ` — ${selectedLocation.cityName}` : ''}
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Interactive GIS visualization powered by Mapbox raster tiles displaying active waste requests and collection routes.
                </p>
              </div>
              <MapboxView
                pickups={scopedPickups}
                selectedPickupId={activeSelectedPickup?.id}
                onSelectPickup={(p) => {
                  setSelectedPickup(p);
                  navigateForRole('tracking');
                }}
                height="560px"
              />
            </div>
          )}

          {accessibleScreen === 'locator' && <EcoLocatorPage />}

          {accessibleScreen === 'workspace-ops' && (
            <WorkspaceOpsPage
              pickups={scopedPickups}
              currentUser={currentUser}
              onShowToast={showToast}
            />
          )}

          {accessibleScreen === 'users-management' && (
            <UsersManagement
              users={users}
              onToggleStatus={async (id) => {
                const updated = await api.toggleUserStatus(id);
                setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
                showToast(`User ${updated.name} status updated.`);
              }}
            />
          )}

          {accessibleScreen === 'areas-categories' && (
            <AreasCategoriesManagement
              areas={areas}
              categories={categories}
              onToggleCategory={async (id) => {
                const updated = await api.toggleCategoryStatus(id);
                setCategories((prev) => prev.map((c) => (c.id === id ? updated : c)));
                showToast(`Category ${updated.name} status toggled.`);
              }}
              onCreateCategory={async (cat) => {
                const created = await api.createCategory(cat);
                setCategories((prev) => [...prev, created]);
                showToast(`Category ${created.name} added.`);
              }}
            />
          )}
            </>
          )}
        </main>
      </div>

      {/* Citizen Pickup Booking Modal */}
      <RequestPickupModal
        key={currentUser.id}
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        onSubmit={handleCreatePickup}
        households={households.filter((h) => h.citizenId === currentUser.id)}
        categories={categories.filter((c) => c.active)}
        defaultLocation={selectedLocation}
        defaultCitizenPhone={currentUser.phone || ''}
      />

      {/* Location Onboarding Modal (First-Time User Prompt - Blocking until selected) */}
      <LocationOnboardingModal
        isOpen={!isLocationSet && !isLoadingLocation}
        onConfirm={confirmLocation}
      />

      {/* Location Change Modal */}
      <LocationChangeModal
        isOpen={isChangeModalOpen}
        onClose={() => setIsChangeModalOpen(false)}
        currentLocation={selectedLocation}
        onSave={confirmLocation}
      />

      {/* Intelligent AI-Powered EcoBot Assistant */}
      <EcoBot
        currentUserRole={currentUser.role}
        currentUserId={currentUser.id}
        currentLocation={selectedLocation}
        onNavigate={(screen, payload) => {
          if (payload?.pickupId) {
            const p = scopedPickups.find((x) => x.requestNumber === payload.pickupId);
            if (p) setSelectedPickup(p);
          }
          navigateForRole(screen);
        }}
        onRequestPickup={() => {
          if (currentUser.role === 'citizen') setIsRequestModalOpen(true);
        }}
        onChangeLocation={() => setIsChangeModalOpen(true)}
      />

      {/* Visual QR Verification Success Feedback Overlay */}
      <QrCompletionSuccessOverlay
        feedback={qrSuccessFeedback}
        onDismiss={dismissQrSuccessFeedback}
      />

      {/* Toast Notification Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
      />
    </div>
  );
}

export default function App() {
  return (
    <LocationProvider>
      <AppContent />
    </LocationProvider>
  );
}
