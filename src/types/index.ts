export type UserRole = 'admin' | 'supervisor' | 'collector' | 'citizen';

export interface User {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: UserRole;
  phone?: string;
  area?: string;
  ward?: string;
  pincode?: string;
  active: boolean;
  avatarUrl?: string;
  createdAt: string;
}

export interface Household {
  id: string;
  citizenId: string;
  citizenName: string;
  address: string;
  houseNumber: string;
  area: string;
  ward: string;
  landmark?: string;
  pincode: string;
  latitude?: number;
  longitude?: number;
  pickupLocationNote?: string;
  createdAt: string;
}

export interface WasteCategory {
  id: string;
  name: string;
  description: string;
  instructions: string;
  iconName: string;
  color: string;
  active: boolean;
}

export type PickupStatus =
  | 'Submitted'
  | 'Pending Approval'
  | 'Approved'
  | 'Scheduled'
  | 'Assigned'
  | 'Collector On The Way'
  | 'In Progress'
  | 'Completed'
  | 'Missed'
  | 'Cancelled'
  | 'Rejected';

export interface PickupStatusHistory {
  id: string;
  pickupRequestId: string;
  previousStatus: PickupStatus;
  newStatus: PickupStatus;
  changedBy: string;
  changedByName: string;
  reason?: string;
  remarks?: string;
  timestamp: string;
}

export interface PickupRequest {
  id: string;
  requestNumber: string;
  citizenId: string;
  citizenName: string;
  citizenPhone?: string;
  householdId: string;
  address: string;
  area: string;
  ward: string;
  latitude?: number;
  longitude?: number;
  pickupLocationNote?: string;
  categoryId: string;
  categoryName: string;
  quantityKg: number;
  actualQuantityKg?: number;
  preferredDate: string;
  preferredTimeSlot: string;
  specialInstructions?: string;
  imageUrl?: string;
  status: PickupStatus;
  assignedCollectorId?: string;
  assignedCollectorName?: string;
  scheduledDate?: string;
  scheduledTimeSlot?: string;
  missedReason?: string;
  missedRemarks?: string;
  completionRemarks?: string;
  completedAt?: string;
  containerTagId?: string;
  qrVerified?: boolean;
  qrScannedCode?: string;
  qrVerifiedAt?: string;
  qrVerifiedBy?: string;
  segregationVerified?: boolean;
  statusHistory: PickupStatusHistory[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionSchedule {
  id: string;
  date: string;
  timeSlot: string;
  area: string;
  ward: string;
  collectorId: string;
  collectorName: string;
  totalPickups: number;
  completedPickups: number;
  pendingPickups: number;
  missedPickups: number;
  status: 'Scheduled' | 'In Progress' | 'Completed';
  createdAt: string;
}

export interface AreaLocation {
  id: string;
  name: string;
  zone: string;
  city: string;
  wards: string[];
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface GroundingChunk {
  maps?: {
    uri: string;
    title: string;
    placeAnswerSources?: {
      reviewSnippets?: string[];
    };
  };
  web?: {
    uri: string;
    title: string;
  };
}

export interface FacilityRecommendation {
  facilityName: string;
  category: string;
  address: string;
  guidelines: string;
  mapUri?: string;
  snippet?: string;
}

export interface CollectorLiveLocation {
  collectorId: string;
  collectorName: string;
  latitude: number;
  longitude: number;
  heading?: number;
  speedKmh?: number;
  vehicleNumber?: string;
  phone?: string;
  isSharing: boolean;
  status: 'active' | 'en_route' | 'idle' | 'stopped';
  lastUpdated: string;
  activePickupId?: string;
  activePickupAddress?: string;
  batteryLevel?: number;
}

// -------------------------------------------------------------
// LOCATION HIERARCHY & ONBOARDING TYPES
// -------------------------------------------------------------
export interface StateLocation {
  id: string;
  name: string;
  code: string;
  active: boolean;
}

export interface DistrictLocation {
  id: string;
  stateId: string;
  name: string;
  active: boolean;
}

export interface CityLocation {
  id: string;
  districtId: string;
  name: string;
  municipalityType: string;
  active: boolean;
}

export interface AreaHierarchyLocation {
  id: string;
  cityId: string;
  name: string;
  zone: string;
  pincode: string;
  wards: string[];
  isSupported: boolean;
  active: boolean;
  collectionFrequency?: string;
  contactPhone?: string;
}

export interface UserLocationSelection {
  stateId: string;
  stateName: string;
  districtId: string;
  districtName: string;
  cityId: string;
  cityName: string;
  areaId: string;
  areaName: string;
  ward?: string;
  pincode?: string;
  isSupported: boolean;
  confirmedAt?: string;
}

export interface ServiceAreaRequest {
  id: string;
  stateName: string;
  districtName: string;
  cityName: string;
  areaName: string;
  pincode: string;
  citizenName: string;
  email: string;
  phone: string;
  notes?: string;
  status: 'Pending' | 'Under Review' | 'Approved' | 'Rejected';
  createdAt: string;
}

// -------------------------------------------------------------
// ECOBOT AI CHATBOT TYPES
// -------------------------------------------------------------
export type BotActionType =
  | 'NAVIGATE'
  | 'TRACK'
  | 'REQUEST_PICKUP'
  | 'REPORT_MISSED'
  | 'CHANGE_LOCATION'
  | 'RECYCLING_GUIDE';

export interface BotActionBadge {
  type: BotActionType;
  label: string;
  payload?: string;
  screen?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  language: 'en' | 'te' | 'hi';
  actions?: BotActionBadge[];
}

export interface ChatSession {
  id: string;
  userId: string;
  title: string;
  createdAt: string;
  lastActivity: string;
}

// -------------------------------------------------------------
// CITIZEN GAMIFICATION & BADGES TYPES
// -------------------------------------------------------------
export type BadgeCategory = 'frequency' | 'segregation' | 'impact';
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'emerald';

export interface CitizenBadge {
  id: string;
  title: string;
  description: string;
  criteriaLabel: string;
  category: BadgeCategory;
  tier: BadgeTier;
  earned: boolean;
  progressCurrent: number;
  progressTarget: number;
  progressPercent: number;
  unitLabel: string;
  earnedAt?: string;
}

export type PointActivityType =
  | 'pickup_completed'
  | 'segregation_bonus'
  | 'qr_verified'
  | 'weight_diverted';

export interface CitizenPointHistoryEntry {
  id: string;
  pickupId: string;
  requestNumber: string;
  categoryName: string;
  type: PointActivityType;
  title: string;
  reason: string;
  points: number;
  awardedAt: string;
}

export interface CitizenGamificationSummary {
  ecoPoints: number;
  level: string;
  nextLevelName: string | null;
  pointsToNextLevel: number;
  completedPickupsCount: number;
  segregatedPickupsCount: number;
  segregationRatePercent: number;
  recycledStreamCount: number;
  distinctSegregatedCategories: number;
  totalDivertedKg: number;
  earnedBadgesCount: number;
  totalBadgesCount: number;
  badges: CitizenBadge[];
  pointHistory: CitizenPointHistoryEntry[];
}

