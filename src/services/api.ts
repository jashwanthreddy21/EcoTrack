import {
  User,
  Household,
  WasteCategory,
  PickupRequest,
  CollectionSchedule,
  AreaLocation,
  AppNotification,
  PickupStatus,
  CollectorLiveLocation,
  StateLocation,
  DistrictLocation,
  CityLocation,
  AreaHierarchyLocation,
  UserLocationSelection,
  ServiceAreaRequest,
  ChatMessage,
  ChatSession,
  BotActionBadge
} from '../types/index.ts';
import { OptimizedAreaRouteResult } from '../utils/ecoLogic.ts';

const RAW_API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
let base = RAW_API_BASE ? RAW_API_BASE.replace(/\/+$/, '') : '/api';
if (base.startsWith('http') && !base.endsWith('/api')) {
  base = `${base}/api`;
}
const API_BASE = base;

class ApiClient {
  private token: string | null = null;

  setToken(t: string | null) {
    this.token = t;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {})
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    let res: Response;
    try {
      res = await fetch(`${API_BASE}${endpoint}`, {
        ...options,
        headers
      });
    } catch (networkErr: any) {
      throw new Error(
        `Cannot connect to backend API (${API_BASE}). Please check your VITE_API_URL and ensure the Render service is awake: ${networkErr?.message || networkErr}`
      );
    }

    if (!res.ok) {
      let errorMsg = `Server error (${res.status})`;
      try {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errorData = await res.json();
          errorMsg = errorData.error || (errorData.errors ? errorData.errors.join(', ') : errorMsg);
        } else {
          const text = await res.text();
          if (text.includes('<!doctype html>') || text.includes('<html')) {
            errorMsg = `API endpoint "${API_BASE}${endpoint}" returned HTML instead of JSON. Ensure VITE_API_URL is configured in Vercel to your Render backend URL (e.g. https://<render-service>.onrender.com/api) and trigger a redeploy in Vercel.`;
          } else {
            errorMsg = text.slice(0, 150) || res.statusText || errorMsg;
          }
        }
      } catch {
        errorMsg = res.statusText || `Request failed with HTTP ${res.status}`;
      }
      throw new Error(errorMsg);
    }

    return res.json() as Promise<T>;
  }

  // Auth
  async login(identifier: string, password?: string, role?: string): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: identifier, username: identifier, password, role })
    });
    this.setToken(res.token);
    return res;
  }

  async registerStaff(data: {
    name: string;
    username: string;
    password: string;
    role: 'supervisor' | 'collector';
    area?: string;
    phone?: string;
  }): Promise<{ token: string; user: User }> {
    const res = await this.request<{ token: string; user: User }>('/auth/register-staff', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.setToken(res.token);
    return res;
  }

  async googleLogin(
    email: string,
    name: string,
    role?: string,
    avatarUrl?: string
  ): Promise<{ token: string; user: User; isNewUser?: boolean }> {
    const res = await this.request<{ token: string; user: User; isNewUser?: boolean }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ email, name, role, avatarUrl })
    });
    this.setToken(res.token);
    return res;
  }

  async register(data: {
    name: string;
    email: string;
    phone: string;
    password?: string;
    address: string;
    area: string;
    ward?: string;
    pincode?: string;
    houseNumber?: string;
    landmark?: string;
  }): Promise<{ token: string; user: User; household: Household }> {
    const res = await this.request<{ token: string; user: User; household: Household }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    this.setToken(res.token);
    return res;
  }

  // Users
  async getUsers(role?: string): Promise<User[]> {
    const query = role ? `?role=${encodeURIComponent(role)}` : '';
    const res = await this.request<{ users: User[] }>(`/users${query}`);
    return res.users;
  }

  async toggleUserStatus(id: string, active?: boolean): Promise<User> {
    const res = await this.request<{ user: User }>(`/users/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active })
    });
    return res.user;
  }

  // Households
  async getHouseholds(citizenId?: string): Promise<Household[]> {
    const query = citizenId ? `?citizenId=${encodeURIComponent(citizenId)}` : '';
    const res = await this.request<{ households: Household[] }>(`/households${query}`);
    return res.households;
  }

  async createHousehold(data: Partial<Household>): Promise<Household> {
    const res = await this.request<{ household: Household }>('/households', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.household;
  }

  async updateHousehold(id: string, data: Partial<Household>): Promise<Household> {
    const res = await this.request<{ household: Household }>(`/households/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return res.household;
  }

  async deleteHousehold(id: string): Promise<void> {
    await this.request(`/households/${id}`, { method: 'DELETE' });
  }

  // Locations & Categories
  async getAreas(district?: string): Promise<AreaLocation[]> {
    const query = district ? `?district=${encodeURIComponent(district)}` : '';
    const res = await this.request<{ areas: AreaLocation[] }>(`/areas${query}`);
    return res.areas;
  }

  async getWards(): Promise<string[]> {
    const res = await this.request<{ wards: string[] }>('/wards');
    return res.wards;
  }

  async getCategories(): Promise<WasteCategory[]> {
    const res = await this.request<{ categories: WasteCategory[] }>('/categories');
    return res.categories;
  }

  async createCategory(data: Partial<WasteCategory>): Promise<WasteCategory> {
    const res = await this.request<{ category: WasteCategory }>('/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.category;
  }

  async toggleCategoryStatus(id: string): Promise<WasteCategory> {
    const res = await this.request<{ category: WasteCategory }>(`/categories/${id}/status`, {
      method: 'PATCH'
    });
    return res.category;
  }

  // Pickup Requests
  async getPickups(params?: {
    citizenId?: string;
    collectorId?: string;
    status?: string;
    area?: string;
    search?: string;
  }): Promise<PickupRequest[]> {
    const query = new URLSearchParams();
    if (params?.citizenId) query.append('citizenId', params.citizenId);
    if (params?.collectorId) query.append('collectorId', params.collectorId);
    if (params?.status) query.append('status', params.status);
    if (params?.area) query.append('area', params.area);
    if (params?.search) query.append('search', params.search);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    const res = await this.request<{ pickups: PickupRequest[] }>(`/pickups${queryString}`);
    return res.pickups;
  }

  async getPickupById(id: string): Promise<PickupRequest> {
    const res = await this.request<{ pickup: PickupRequest }>(`/pickups/${id}`);
    return res.pickup;
  }

  async createPickup(data: {
    citizenId: string;
    citizenPhone?: string;
    householdId: string;
    categoryId: string;
    quantityKg: number;
    preferredDate: string;
    preferredTimeSlot: string;
    specialInstructions?: string;
    imageUrl?: string;
    latitude?: number;
    longitude?: number;
    pickupLocationNote?: string;
  }): Promise<PickupRequest> {
    const res = await this.request<{ pickup: PickupRequest }>('/pickups', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.pickup;
  }

  async updatePickupLocation(
    id: string,
    data: {
      latitude: number;
      longitude: number;
      pickupLocationNote?: string;
      changedBy?: string;
      changedByName?: string;
    }
  ): Promise<PickupRequest> {
    const res = await this.request<{ pickup: PickupRequest }>(`/pickups/${id}/location`, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
    return res.pickup;
  }

  async updatePickupStatus(
    id: string,
    status: PickupStatus,
    extra?: {
      actualQuantityKg?: number;
      completionRemarks?: string;
      segregationVerified?: boolean;
      missedReason?: string;
      missedRemarks?: string;
      remarks?: string;
      changedBy?: string;
      changedByName?: string;
    }
  ): Promise<PickupRequest> {
    const res = await this.request<{ pickup: PickupRequest }>(`/pickups/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, ...extra })
    });
    return res.pickup;
  }

  async verifyPickupByQr(
    id: string,
    payload: {
      scannedCode: string;
      actualQuantityKg: number;
      completionRemarks?: string;
      segregationVerified?: boolean;
      collectorId?: string;
      changedBy?: string;
      changedByName?: string;
    }
  ): Promise<PickupRequest> {
    const res = await this.request<{ pickup: PickupRequest }>(`/pickups/${id}/verify-qr`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    return res.pickup;
  }

  async assignCollector(data: {
    pickupId: string;
    collectorId: string;
    scheduledDate: string;
    scheduledTimeSlot: string;
    supervisorId?: string;
  }): Promise<PickupRequest> {
    const res = await this.request<{ pickup: PickupRequest }>('/assignments', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.pickup;
  }

  // Schedules
  async getSchedules(): Promise<CollectionSchedule[]> {
    const res = await this.request<{ schedules: CollectionSchedule[] }>('/schedules');
    return res.schedules;
  }

  async createSchedule(data: {
    date: string;
    timeSlot: string;
    area: string;
    ward?: string;
    collectorId: string;
    totalPickups?: number;
  }): Promise<CollectionSchedule> {
    const res = await this.request<{ schedule: CollectionSchedule }>('/schedules', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.schedule;
  }

  // Reports
  async getCollectionScheduleReport(filters?: { area?: string; status?: string }) {
    const query = new URLSearchParams();
    if (filters?.area) query.append('area', filters.area);
    if (filters?.status) query.append('status', filters.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ reportName: string; generatedAt: string; data: any[] }>(`/reports/collection-schedule${qs}`);
  }

  async getPickupRequestReport(filters?: { area?: string; category?: string; status?: string }) {
    const query = new URLSearchParams();
    if (filters?.area) query.append('area', filters.area);
    if (filters?.category) query.append('category', filters.category);
    if (filters?.status) query.append('status', filters.status);
    const qs = query.toString() ? `?${query.toString()}` : '';
    return this.request<{ reportName: string; generatedAt: string; data: any[] }>(`/reports/pickup-requests${qs}`);
  }

  async getAreaWiseWasteReport() {
    return this.request<{ reportName: string; generatedAt: string; data: any[] }>('/reports/area-wise-waste');
  }

  async getCollectorPerformanceReport() {
    return this.request<{ reportName: string; generatedAt: string; data: any[] }>('/reports/collector-performance');
  }

  // Analytics
  async getDashboardAnalytics() {
    return this.request<{
      kpis: {
        totalRegisteredCitizens: number;
        totalPickupRequests: number;
        pendingRequests: number;
        scheduledCollections: number;
        completedCollections: number;
        missedPickups: number;
        totalWasteCollectedKg: number;
        activeWasteCollectors: number;
      };
      categoryDistribution: { name: string; requests: number; completedKg: number; pendingKg: number }[];
      dailyTrends: { day: string; requests: number; collectedKg: number }[];
      areaComparison: { area: string; totalRequests: number; collectedKg: number; missed: number }[];
    }>('/analytics/dashboard');
  }

  // Notifications
  async getNotifications(userId?: string): Promise<{ notifications: AppNotification[]; unreadCount: number }> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    return this.request<{ notifications: AppNotification[]; unreadCount: number }>(`/notifications${query}`);
  }

  async markNotificationRead(id: string): Promise<void> {
    await this.request(`/notifications/${id}/read`, { method: 'PATCH' });
  }

  async markAllNotificationsRead(userId?: string): Promise<void> {
    await this.request('/notifications/read-all', {
      method: 'PATCH',
      body: JSON.stringify({ userId })
    });
  }

  // Gemini Maps Grounding Locator
  async queryEcoLocator(query?: string, category?: string) {
    return this.request<{ reply: string; facilities?: any[]; groundingChunks?: any[]; fallback?: boolean }>(
      '/gemini/maps-grounding',
      {
        method: 'POST',
        body: JSON.stringify({ query, category })
      }
    );
  }

  // Collector Live Tracking & Telemetry
  async getCollectorLocations(): Promise<CollectorLiveLocation[]> {
    const res = await this.request<{ locations: CollectorLiveLocation[] }>('/collectors/locations');
    return res.locations || [];
  }

  async updateCollectorLocation(data: {
    collectorId: string;
    latitude: number;
    longitude: number;
    heading?: number;
    speedKmh?: number;
    isSharing?: boolean;
    status?: 'active' | 'en_route' | 'idle' | 'stopped';
    activePickupId?: string;
  }): Promise<CollectorLiveLocation> {
    const res = await this.request<{ location: CollectorLiveLocation }>('/collectors/location', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return res.location;
  }

  async toggleCollectorLocationSharing(collectorId: string, isSharing: boolean): Promise<CollectorLiveLocation> {
    const res = await this.request<{ location: CollectorLiveLocation }>(`/collectors/${collectorId}/sharing`, {
      method: 'PATCH',
      body: JSON.stringify({ isSharing })
    });
    return res.location;
  }

  // -------------------------------------------------------------
  // LOCATION HIERARCHY & ONBOARDING METHODS
  // -------------------------------------------------------------
  async getStates(): Promise<StateLocation[]> {
    const res = await this.request<{ states: StateLocation[] }>('/locations/states');
    return res.states || [];
  }

  async getDistricts(stateId?: string): Promise<DistrictLocation[]> {
    const query = stateId ? `?stateId=${encodeURIComponent(stateId)}` : '';
    const res = await this.request<{ districts: DistrictLocation[] }>(`/locations/districts${query}`);
    return res.districts || [];
  }

  async getTelanganaDistricts(): Promise<DistrictLocation[]> {
    const res = await this.request<{ districts: DistrictLocation[] }>('/locations/districts?stateId=state-ts');
    return res.districts || [];
  }

  async getCities(districtId?: string): Promise<CityLocation[]> {
    const query = districtId ? `?districtId=${encodeURIComponent(districtId)}` : '';
    const res = await this.request<{ cities: CityLocation[] }>(`/locations/cities${query}`);
    return res.cities || [];
  }

  async getAreasHierarchy(
    cityOrFilter?: string | { cityId?: string; districtId?: string; district?: string; supportedOnly?: boolean },
    supportedOnly?: boolean
  ): Promise<AreaHierarchyLocation[]> {
    const params = new URLSearchParams();
    if (typeof cityOrFilter === 'string') {
      if (cityOrFilter) params.append('cityId', cityOrFilter);
      if (supportedOnly) params.append('supportedOnly', 'true');
    } else if (cityOrFilter) {
      if (cityOrFilter.cityId) params.append('cityId', cityOrFilter.cityId);
      if (cityOrFilter.districtId) params.append('districtId', cityOrFilter.districtId);
      if (cityOrFilter.district) params.append('district', cityOrFilter.district);
      if (cityOrFilter.supportedOnly || supportedOnly) params.append('supportedOnly', 'true');
    } else if (supportedOnly) {
      params.append('supportedOnly', 'true');
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await this.request<{ areas: AreaHierarchyLocation[] }>(`/locations/areas${query}`);
    return res.areas || [];
  }

  async getMunicipalAreasByDistrict(
    district: { districtId?: string; districtName?: string },
    supportedOnly?: boolean
  ): Promise<AreaHierarchyLocation[]> {
    return this.getAreasHierarchy(
      {
        districtId: district.districtId,
        district: district.districtName,
        supportedOnly
      },
      supportedOnly
    );
  }

  async getWardsForArea(areaId?: string): Promise<string[]> {
    const query = areaId ? `?areaId=${encodeURIComponent(areaId)}` : '';
    const res = await this.request<{ wards: string[] }>(`/locations/wards${query}`);
    return res.wards || [];
  }

  async getUserLocation(): Promise<UserLocationSelection | null> {
    const res = await this.request<{ location: UserLocationSelection | null }>('/users/me/location');
    return res.location;
  }

  async saveUserLocation(data: UserLocationSelection & { userId?: string }): Promise<{ success: boolean; location: UserLocationSelection }> {
    return this.request<{ success: boolean; location: UserLocationSelection }>('/users/me/location', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  async reverseGeocodeLocation(coords: { latitude: number; longitude: number }): Promise<{
    detected: boolean;
    distanceKm?: number;
    isSupported?: boolean;
    location?: UserLocationSelection;
    message?: string;
  }> {
    return this.request('/locations/reverse-geocode', {
      method: 'POST',
      body: JSON.stringify(coords)
    });
  }

  async submitServiceAreaRequest(data: Partial<ServiceAreaRequest>): Promise<{ success: boolean; request: ServiceAreaRequest }> {
    return this.request<{ success: boolean; request: ServiceAreaRequest }>('/locations/service-area-requests', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async getServiceAreaRequests(): Promise<ServiceAreaRequest[]> {
    const res = await this.request<{ requests: ServiceAreaRequest[] }>('/locations/service-area-requests');
    return res.requests || [];
  }

  async updateServiceAreaRequestStatus(id: string, status: string): Promise<{ success: boolean; request: ServiceAreaRequest }> {
    return this.request<{ success: boolean; request: ServiceAreaRequest }>(`/locations/service-area-requests/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status })
    });
  }

  async addAreaHierarchy(
    data: Partial<AreaHierarchyLocation> & {
      districtId?: string;
      district?: string;
      latitude?: number;
      longitude?: number;
    }
  ): Promise<{ success: boolean; area: AreaHierarchyLocation }> {
    return this.request<{ success: boolean; area: AreaHierarchyLocation }>('/locations/areas', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async toggleAreaHierarchyStatus(id: string, active?: boolean, isSupported?: boolean): Promise<{ success: boolean; area: AreaHierarchyLocation }> {
    return this.request<{ success: boolean; area: AreaHierarchyLocation }>(`/locations/areas/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ active, isSupported })
    });
  }

  // -------------------------------------------------------------
  // INTELLIGENT AI-POWERED ECOBOT ASSISTANT METHODS
  // -------------------------------------------------------------
  async sendChatMessage(payload: {
    message: string;
    sessionId?: string;
    language?: 'en' | 'te' | 'hi';
    userId?: string;
    userRole?: string;
    userLocation?: UserLocationSelection | null;
  }): Promise<{
    sessionId: string;
    messageId: string;
    reply: string;
    actions: BotActionBadge[];
    timestamp: string;
  }> {
    return this.request('/chat/message', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getChatSessions(userId?: string): Promise<ChatSession[]> {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : '';
    const res = await this.request<{ sessions: ChatSession[] }>(`/chat/sessions${query}`);
    return res.sessions || [];
  }

  async getChatSessionMessages(sessionId: string): Promise<ChatMessage[]> {
    const res = await this.request<{ messages: ChatMessage[] }>(`/chat/sessions/${sessionId}/messages`);
    return res.messages || [];
  }

  async clearChatSession(sessionId: string): Promise<void> {
    await this.request(`/chat/sessions/${sessionId}`, { method: 'DELETE' });
  }

  // -------------------------------------------------------------
  // GOOGLE MAPS ROUTES API v2 — AREA ROUTE OPTIMIZER
  // -------------------------------------------------------------
  async optimizeCollectorAreaRoute(payload: {
    collectorId?: string;
    serviceArea?: string;
    originLat?: number;
    originLng?: number;
  }): Promise<OptimizedAreaRouteResult> {
    return this.request<OptimizedAreaRouteResult>('/routes/optimize-area', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }
}

export const api = new ApiClient();

