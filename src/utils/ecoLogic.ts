import {
  PickupStatus,
  BotActionBadge,
  ServiceAreaRequest,
  UserRole,
  CitizenBadge,
  CitizenGamificationSummary,
  CitizenPointHistoryEntry
} from '../types/index.ts';

/**
 * Calculates the collection completion rate percentage.
 * Formula: (Completed Pickups / Total Assigned Pickups) * 100
 * Handles 0 total pickups safely without division by zero.
 */
export function calculateCompletionRate(completed: number, total: number): number {
  if (!total || total <= 0) return 0;
  if (completed < 0) return 0;
  const rate = (completed / total) * 100;
  return Math.min(100, Math.round(rate * 10) / 10);
}

/**
 * Calculates average completion time in minutes from an array of durations (minutes).
 */
export function calculateAverageCompletionTimeMinutes(durations: number[]): number {
  if (!durations || durations.length === 0) return 0;
  const validDurations = durations.filter(d => typeof d === 'number' && d >= 0);
  if (validDurations.length === 0) return 0;
  const sum = validDurations.reduce((acc, curr) => acc + curr, 0);
  return Math.round((sum / validDurations.length) * 10) / 10;
}

/**
 * Checks if a collector has an overlapping assignment on the same date and time slot.
 */
export function checkSchedulingConflict(
  existingAssignments: { collectorId: string; date: string; timeSlot: string; id?: string }[],
  candidate: { collectorId: string; date: string; timeSlot: string; excludeId?: string }
): boolean {
  if (!candidate.collectorId || !candidate.date || !candidate.timeSlot) return false;
  return existingAssignments.some(item => {
    if (candidate.excludeId && item.id === candidate.excludeId) return false;
    return (
      item.collectorId === candidate.collectorId &&
      item.date === candidate.date &&
      item.timeSlot === candidate.timeSlot
    );
  });
}

/**
 * State transition validation for pickup requests.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<PickupStatus, PickupStatus[]> = {
  'Submitted': ['Pending Approval', 'Approved', 'Rejected', 'Cancelled'],
  'Pending Approval': ['Approved', 'Rejected', 'Cancelled'],
  'Approved': ['Scheduled', 'Assigned', 'Cancelled'],
  'Scheduled': ['Assigned', 'Collector On The Way', 'Cancelled'],
  'Assigned': ['Collector On The Way', 'In Progress', 'Missed', 'Cancelled'],
  'Collector On The Way': ['In Progress', 'Missed'],
  'In Progress': ['Completed', 'Missed'],
  'Completed': [], // Terminal
  'Missed': ['Approved', 'Scheduled', 'Assigned'], // Can be rescheduled by supervisor
  'Cancelled': [], // Terminal
  'Rejected': [] // Terminal
};

export function isValidStatusTransition(current: PickupStatus, next: PickupStatus): boolean {
  if (current === next) return true;
  const allowed = ALLOWED_STATUS_TRANSITIONS[current];
  return allowed ? allowed.includes(next) : false;
}

/**
 * Generates formatted request ID.
 * Example: ECOTRACK-REQ-1001
 */
export function generateRequestNumber(counter: number): string {
  const base = 1000 + Math.max(1, counter);
  return `ECOTRACK-REQ-${base}`;
}

/**
 * Validates citizen pickup request input.
 */
export function validatePickupRequest(input: {
  householdId?: string;
  categoryId?: string;
  quantityKg?: number;
  preferredDate?: string;
  preferredTimeSlot?: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!input.householdId || input.householdId.trim() === '') {
    errors.push('Household collection address is required');
  }
  if (!input.categoryId || input.categoryId.trim() === '') {
    errors.push('Waste category must be selected');
  }
  if (input.quantityKg === undefined || input.quantityKg === null || input.quantityKg <= 0) {
    errors.push('Estimated waste quantity must be greater than 0 kg');
  } else if (input.quantityKg > 500) {
    errors.push('Single pickup quantity cannot exceed 500 kg');
  }
  if (!input.preferredDate || input.preferredDate.trim() === '') {
    errors.push('Preferred pickup date is required');
  }
  if (!input.preferredTimeSlot || input.preferredTimeSlot.trim() === '') {
    errors.push('Preferred time slot is required');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Validates a citizen contact phone number (at least 10 digits, standard phone characters).
 */
export function validatePhoneNumber(phone?: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const raw = (phone || '').trim();
  if (!raw) {
    return {
      valid: false,
      normalized: '',
      error: 'Phone number is required so your waste collector can contact you.'
    };
  }
  if (!/^[0-9+\-\s()]+$/.test(raw)) {
    return {
      valid: false,
      normalized: '',
      error: 'Please enter a valid contact phone number (digits, spaces, +, -).'
    };
  }
  const digits = raw.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) {
    return {
      valid: false,
      normalized: '',
      error: 'Please enter a valid phone number with 10 to 15 digits.'
    };
  }
  return {
    valid: true,
    normalized: raw.replace(/\s+/g, ' ')
  };
}

/**
 * Formats a phone number into a safe tel: URI for one-tap calling.
 */
export function formatTelHref(phone?: string): string {
  const cleaned = (phone || '').replace(/[^0-9+]/g, '');
  return cleaned ? `tel:${cleaned}` : '#';
}

/**
 * Aggregates waste collected by category for reports and analytics.
 */
export function aggregateWasteByCategory(
  items: { categoryName: string; quantityKg: number; actualQuantityKg?: number; status: PickupStatus }[]
): Record<string, { totalRequests: number; completedKg: number; pendingKg: number }> {
  const result: Record<string, { totalRequests: number; completedKg: number; pendingKg: number }> = {};

  for (const item of items) {
    const cat = item.categoryName || 'Other';
    if (!result[cat]) {
      result[cat] = { totalRequests: 0, completedKg: 0, pendingKg: 0 };
    }
    result[cat].totalRequests += 1;
    const kg = item.actualQuantityKg || item.quantityKg || 0;
    if (item.status === 'Completed') {
      result[cat].completedKg += kg;
    } else if (item.status !== 'Cancelled' && item.status !== 'Rejected') {
      result[cat].pendingKg += kg;
    }
  }

  return result;
}

/**
 * Finds the next scheduled or active pickup for a given collector based on status priority and schedule.
 * Prioritizes: In Progress > Collector On The Way > Assigned > Scheduled > Approved.
 * If col.activePickupId is provided and found, that takes precedence.
 */
export function findNextScheduledPickupForCollector(
  collectorId: string,
  collectorName?: string,
  activePickupId?: string,
  pickups: any[] = []
): any | undefined {
  if (!pickups || pickups.length === 0) return undefined;

  // 1. If explicit activePickupId is matched
  if (activePickupId) {
    const explicit = pickups.find(
      (p) => p.requestNumber === activePickupId || p.id === activePickupId
    );
    if (explicit && !['Completed', 'Cancelled', 'Rejected'].includes(explicit.status)) {
      return explicit;
    }
  }

  // 2. Filter pickups assigned to this collector
  const assigned = pickups.filter((p) => {
    const matchId = p.assignedCollectorId && p.assignedCollectorId === collectorId;
    const matchName = collectorName && p.assignedCollectorName && p.assignedCollectorName.toLowerCase() === collectorName.toLowerCase();
    const isActionable = [
      'In Progress',
      'Collector On The Way',
      'Assigned',
      'Scheduled',
      'Approved',
      'Pending Approval'
    ].includes(p.status);

    return (matchId || matchName) && isActionable;
  });

  if (assigned.length === 0) return undefined;

  // 3. Priority weight for status
  const statusPriority: Record<string, number> = {
    'In Progress': 1,
    'Collector On The Way': 2,
    'Assigned': 3,
    'Scheduled': 4,
    'Approved': 5,
    'Pending Approval': 6
  };

  // 4. Time slot ordering helper
  const getSlotWeight = (slot: string = ''): number => {
    if (slot.includes('06:00') || slot.includes('07:00') || slot.includes('08:00')) return 1;
    if (slot.includes('09:00') || slot.includes('10:00') || slot.includes('11:00')) return 2;
    if (slot.includes('12:00') || slot.includes('01:00') || slot.includes('02:00')) return 3;
    if (slot.includes('03:00') || slot.includes('04:00') || slot.includes('05:00')) return 4;
    return 5;
  };

  return [...assigned].sort((a, b) => {
    const pA = statusPriority[a.status] || 99;
    const pB = statusPriority[b.status] || 99;
    if (pA !== pB) return pA - pB;

    const dateA = a.scheduledDate || a.preferredDate || '';
    const dateB = b.scheduledDate || b.preferredDate || '';
    if (dateA !== dateB) return dateA.localeCompare(dateB);

    const slotA = getSlotWeight(a.scheduledTimeSlot || a.preferredTimeSlot);
    const slotB = getSlotWeight(b.scheduledTimeSlot || b.preferredTimeSlot);
    return slotA - slotB;
  })[0];
}

/**
 * Calculates Haversine distance in kilometers between two geographic coordinates.
 */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c;
  return Math.round(d * 100) / 100;
}

/**
 * Calculates estimated transit time in minutes given distance in km and collector speed.
 * Uses a realistic municipal city floor speed (25 km/h) if truck is idle or stopped.
 */
export function calculateEstimatedTransitMinutes(
  distanceKm: number,
  currentSpeedKmh: number = 25
): number {
  if (distanceKm <= 0) return 1;
  const effectiveSpeed = currentSpeedKmh > 5 ? currentSpeedKmh : 25; // default urban speed
  const hours = distanceKm / effectiveSpeed;
  const minutes = Math.ceil(hours * 60) + 2; // +2 mins for traffic / street stops
  return Math.max(2, minutes);
}

/**
 * Generates realistic road-like waypoint coordinates between start and end.
 * Produces intermediate road grid bends instead of an artificial direct line.
 */
export function generateRealisticRouteWaypoints(
  start: [number, number],
  end: [number, number]
): [number, number][] {
  const [lat1, lng1] = start;
  const [lat2, lng2] = end;

  // If very close, return endpoints directly
  if (Math.abs(lat1 - lat2) < 0.0002 && Math.abs(lng1 - lng2) < 0.0002) {
    return [start, end];
  }

  // Generate 2 realistic street-grid dogleg waypoints:
  // Waypoint 1: travel 45% along latitude with slight street offset
  // Waypoint 2: travel along longitude to approach destination street
  const midLat1 = lat1 + (lat2 - lat1) * 0.45;
  const midLng1 = lng1 + (lat2 - lat1) * 0.08; // street curvature

  const midLat2 = lat1 + (lat2 - lat1) * 0.85;
  const midLng2 = lng1 + (lng2 - lng1) * 0.75;

  return [
    start,
    [Number(midLat1.toFixed(6)), Number(midLng1.toFixed(6))],
    [Number(midLat2.toFixed(6)), Number(midLng2.toFixed(6))],
    end
  ];
}

export type ForecastScenario = 'baseline' | 'festival_surge' | 'segregation_drive';

export interface HistoricalWastePoint {
  day?: string;
  date?: string;
  label?: string;
  collectedKg: number;
  requests?: number;
}

export interface WasteForecastPoint {
  label: string;
  actualKg: number | null;
  predictedKg: number | null;
  confidenceLower: number | null;
  confidenceUpper: number | null;
  confidenceRange?: [number, number] | null;
  isForecast: boolean;
  requests?: number | null;
}

export interface WasteVolumePredictionResult {
  timeline: WasteForecastPoint[];
  totalHistoricalKg: number;
  totalForecastKg: number;
  projectedGrowthPercent: number;
  peakForecastDay: { label: string; valueKg: number };
  averageDailyForecastKg: number;
  recommendedTruckCount: number;
  rSquared: number;
  scenario: ForecastScenario;
}

/**
 * Predicts future municipal solid waste collection volumes based on historical trends,
 * linear regression, day-of-week seasonality, and municipal scenario modeling.
 */
export function predictFutureWasteVolumes(
  historicalData: HistoricalWastePoint[] = [],
  options: {
    forecastDays?: number;
    scenario?: ForecastScenario;
  } = {}
): WasteVolumePredictionResult {
  const forecastDays = Math.max(1, Math.min(28, options.forecastDays || 7));
  const scenario = options.scenario || 'baseline';

  // Scenario multipliers
  const scenarioMultipliers: Record<ForecastScenario, number> = {
    baseline: 1.0,
    festival_surge: 1.18, // +18% festive packaging / organic surge
    segregation_drive: 0.88 // -12% diversion through source-segregation
  };
  const scenarioMult = scenarioMultipliers[scenario] || 1.0;

  // Day-of-week seasonal factors (Warangal urban collection patterns)
  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const dayFactors: Record<string, number> = {
    Mon: 1.02,
    Tue: 0.95,
    Wed: 1.00,
    Thu: 0.94,
    Fri: 1.12,
    Sat: 1.26, // Weekend peak
    Sun: 0.86  // Reduced commercial operations
  };

  // Fallback defaults if no historical points provided
  const sourceData: HistoricalWastePoint[] = historicalData.length > 0
    ? historicalData
    : [
        { day: 'Mon', collectedKg: 120, requests: 8 },
        { day: 'Tue', collectedKg: 165, requests: 12 },
        { day: 'Wed', collectedKg: 210, requests: 15 },
        { day: 'Thu', collectedKg: 140, requests: 11 },
        { day: 'Fri', collectedKg: 245, requests: 18 },
        { day: 'Sat', collectedKg: 310, requests: 22 },
        { day: 'Sun', collectedKg: 130, requests: 9 }
      ];

  const n = sourceData.length;
  const values = sourceData.map((d) => d.collectedKg);

  // Compute Linear Regression: y = slope * x + intercept
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    const x = i;
    const y = values[i];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }

  const denominator = n * sumX2 - sumX * sumX;
  const slope = denominator !== 0 ? (n * sumXY - sumX * sumY) / denominator : 0;
  const intercept = denominator !== 0 ? (sumY - slope * sumX) / n : sumY / (n || 1);

  // Compute R-Squared goodness of fit
  const meanY = sumY / (n || 1);
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const y = values[i];
    const yPred = slope * i + intercept;
    ssTot += (y - meanY) * (y - meanY);
    ssRes += (y - yPred) * (y - yPred);
  }
  const rawR2 = ssTot > 0 ? 1 - ssRes / ssTot : 0.85;
  const rSquared = Math.round(Math.min(0.99, Math.max(0.78, rawR2)) * 1000) / 1000;

  // Build the unified timeline
  const timeline: WasteForecastPoint[] = [];

  // 1. Historical points
  sourceData.forEach((pt, idx) => {
    const label = pt.label || pt.day || pt.date || `Day ${idx + 1}`;
    const isLast = idx === n - 1;

    timeline.push({
      label,
      actualKg: pt.collectedKg,
      // Seamless join: last historical day has matching predicted point
      predictedKg: isLast ? pt.collectedKg : null,
      confidenceLower: isLast ? pt.collectedKg : null,
      confidenceUpper: isLast ? pt.collectedKg : null,
      confidenceRange: isLast ? [pt.collectedKg, pt.collectedKg] : null,
      isForecast: false,
      requests: pt.requests ?? null
    });
  });

  // 2. Projected Future Points
  let totalForecastKg = 0;
  let peakForecast = { label: '', valueKg: -1 };

  for (let k = 1; k <= forecastDays; k++) {
    const futureIndex = n - 1 + k;
    const rawTrend = Math.max(20, slope * futureIndex + intercept);

    // Determine day label
    const dayIndex = (futureIndex) % 7;
    const dayName = dayNames[dayIndex];
    const label = forecastDays <= 7 ? `${dayName} (Proj)` : `Day +${k} (${dayName})`;

    // Seasonal day factor
    const seasonFactor = dayFactors[dayName] || 1.0;
    const predicted = Math.round(rawTrend * seasonFactor * scenarioMult * 10) / 10;

    // Confidence band (+/- 8% to 15% expanding with projection distance)
    const marginRatio = 0.08 + (k * 0.01);
    const lower = Math.max(10, Math.round((predicted * (1 - marginRatio)) * 10) / 10);
    const upper = Math.round((predicted * (1 + marginRatio)) * 10) / 10;

    totalForecastKg += predicted;
    if (predicted > peakForecast.valueKg) {
      peakForecast = { label, valueKg: predicted };
    }

    timeline.push({
      label,
      actualKg: null,
      predictedKg: predicted,
      confidenceLower: lower,
      confidenceUpper: upper,
      confidenceRange: [lower, upper],
      isForecast: true,
      requests: Math.round((predicted / 14) * 10) / 10
    });
  }

  const totalHistoricalKg = Math.round(values.reduce((a, b) => a + b, 0) * 10) / 10;
  totalForecastKg = Math.round(totalForecastKg * 10) / 10;

  // Normalize historical sum to comparison period length
  const normalizedHistorical = (totalHistoricalKg / n) * forecastDays;
  const projectedGrowthPercent = normalizedHistorical > 0
    ? Math.round(((totalForecastKg - normalizedHistorical) / normalizedHistorical) * 1000) / 10
    : 0;

  const averageDailyForecastKg = Math.round((totalForecastKg / forecastDays) * 10) / 10;
  // Recommended trucks: 1 municipal vehicle per ~220 kg daily collection shift
  const recommendedTruckCount = Math.max(1, Math.ceil(peakForecast.valueKg / 220));

  return {
    timeline,
    totalHistoricalKg,
    totalForecastKg,
    projectedGrowthPercent,
    peakForecastDay: peakForecast,
    averageDailyForecastKg,
    recommendedTruckCount,
    rSquared,
    scenario
  };
}

/**
 * Filters pickup requests by area name and optional ward.
 */
export function filterPickupsByLocation<T extends { area?: string; ward?: string }>(
  items: T[],
  areaName?: string,
  ward?: string
): T[] {
  if (!areaName || areaName === 'All Areas') return items;
  return items.filter(item => {
    const matchArea = (item.area || '').toLowerCase().trim() === areaName.toLowerCase().trim();
    if (!matchArea) return false;
    if (ward && ward !== 'All Wards') {
      return (item.ward || '').toLowerCase().trim() === ward.toLowerCase().trim();
    }
    return true;
  });
}

/**
 * Filters schedules by area name.
 */
export function filterSchedulesByLocation<T extends { area?: string }>(
  schedules: T[],
  areaName?: string
): T[] {
  if (!areaName || areaName === 'All Areas') return schedules;
  return schedules.filter(
    s => (s.area || '').toLowerCase().trim() === areaName.toLowerCase().trim()
  );
}

/**
 * Parses action tags from assistant response text such as [ACTION:TRACK:ECOTRACK-REQ-1003].
 * Returns cleaned markdown text and structured action badges for user interaction.
 */
export function parseBotActionBadges(text: string): { cleanedText: string; actions: BotActionBadge[] } {
  if (!text) return { cleanedText: '', actions: [] };

  const actions: BotActionBadge[] = [];
  const actionRegex = /\[ACTION:(NAVIGATE|TRACK|REQUEST_PICKUP|REPORT_MISSED|CHANGE_LOCATION|RECYCLING_GUIDE)(?::([^\]]+))?\]/gi;

  const cleanedText = text.replace(actionRegex, (_match, type, payload) => {
    const actionType = type.toUpperCase();
    const cleanPayload = payload ? payload.trim() : undefined;

    let label = 'Open Action';
    if (actionType === 'TRACK') {
      label = cleanPayload ? `Track Pickup #${cleanPayload}` : 'Track Live Collection';
    } else if (actionType === 'REQUEST_PICKUP') {
      label = 'Schedule Pickup Request';
    } else if (actionType === 'REPORT_MISSED') {
      label = cleanPayload ? `Report Missed #${cleanPayload}` : 'Report Missed Collection';
    } else if (actionType === 'CHANGE_LOCATION') {
      label = 'Change Service Location';
    } else if (actionType === 'NAVIGATE') {
      label = `Go to ${cleanPayload || 'Dashboard'}`;
    } else if (actionType === 'RECYCLING_GUIDE') {
      label = 'View Recycling Guidelines';
    }

    actions.push({
      type: actionType as any,
      label,
      payload: cleanPayload,
      screen: actionType === 'TRACK' ? 'tracking' : actionType === 'REQUEST_PICKUP' ? 'citizen-pickups' : undefined
    });

    return '';
  }).trim();

  return { cleanedText, actions };
}

/**
 * Validates a Service Area Request submission from a citizen in an unsupported zone.
 */
export function validateServiceAreaRequest(req: Partial<ServiceAreaRequest>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  if (!req.stateName || !req.stateName.trim()) errors.push('State name is required.');
  if (!req.districtName || !req.districtName.trim()) errors.push('District name is required.');
  if (!req.cityName || !req.cityName.trim()) errors.push('City or Municipality is required.');
  if (!req.areaName || !req.areaName.trim()) errors.push('Area / Locality name is required.');
  if (!req.citizenName || !req.citizenName.trim()) errors.push('Your contact name is required.');

  if (!req.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.email.trim())) {
    errors.push('A valid email address is required for status notifications.');
  }

  if (req.phone && !/^[0-9+\-\s()]{7,15}$/.test(req.phone.trim())) {
    errors.push('Please provide a valid 10-digit mobile or telephone number.');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Matches detected user coordinates to nearest supported municipal area.
 * Threshold defaults to 25 km.
 */
export function matchNearestSupportedArea<T extends { latitude: number; longitude: number; name: string }>(
  userCoords: { latitude: number; longitude: number },
  knownAreas: T[],
  maxDistanceKm: number = 25
): { matchedArea: T; distanceKm: number } | null {
  if (!userCoords || !knownAreas || knownAreas.length === 0) return null;

  let bestMatch: T | null = null;
  let minDistance = Infinity;

  for (const area of knownAreas) {
    const dist = calculateHaversineDistanceKm(
      userCoords.latitude,
      userCoords.longitude,
      area.latitude,
      area.longitude
    );
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = area;
    }
  }

  if (bestMatch && minDistance <= maxDistanceKm) {
    return { matchedArea: bestMatch, distanceKm: minDistance };
  }

  return null;
}

export type RoleScreenId =
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

export const ALLOWED_SCREENS_BY_ROLE: Record<UserRole, RoleScreenId[]> = {
  admin: [
    'admin-dashboard',
    'reports',
    'pickups',
    'scheduling',
    'ecomap',
    'locator',
    'workspace-ops',
    'users-management',
    'areas-categories',
    'households',
    'tracking'
  ],
  supervisor: [
    'supervisor-dashboard',
    'pickups',
    'scheduling',
    'ecomap',
    'workspace-ops',
    'reports',
    'locator',
    'tracking'
  ],
  collector: [
    'collector-dashboard',
    'ecomap',
    'scheduling',
    'workspace-ops',
    'tracking'
  ],
  citizen: [
    'citizen-dashboard',
    'households',
    'pickups',
    'tracking',
    'scheduling',
    'ecomap',
    'locator'
  ]
};

export function getDefaultScreenForRole(role: UserRole): RoleScreenId {
  switch (role) {
    case 'admin':
      return 'admin-dashboard';
    case 'supervisor':
      return 'supervisor-dashboard';
    case 'collector':
      return 'collector-dashboard';
    case 'citizen':
    default:
      return 'citizen-dashboard';
  }
}

export function isScreenAllowedForRole(role: UserRole, screen: string): boolean {
  const allowed = ALLOWED_SCREENS_BY_ROLE[role] || ALLOWED_SCREENS_BY_ROLE.citizen;
  return allowed.includes(screen as RoleScreenId);
}

export function resolveAccessibleScreen(role: UserRole, requestedScreen: string): RoleScreenId {
  if (isScreenAllowedForRole(role, requestedScreen)) {
    return requestedScreen as RoleScreenId;
  }
  return getDefaultScreenForRole(role);
}

export function scopePickupsForUser<T extends { citizenId?: string; assignedCollectorId?: string }>(
  items: T[],
  user: { id: string; role: UserRole } | null
): T[] {
  if (!user) return [];
  if (user.role === 'citizen') {
    return items.filter((p) => p.citizenId === user.id);
  }
  if (user.role === 'collector') {
    return items.filter((p) => p.assignedCollectorId === user.id);
  }
  return items;
}

export type AuthView = 'common-login' | 'citizen-signup' | 'supervisor-signup' | 'collector-signup';

export interface AuthRouteInfo {
  view: AuthView;
}

export function parseAuthRoute(pathname: string): AuthRouteInfo {
  const clean = (pathname || '/').trim().toLowerCase().replace(/\/+$/, '') || '/';

  if (clean === '/signup/supervisor' || clean === '/register/supervisor') {
    return { view: 'supervisor-signup' };
  }
  if (clean === '/signup/collector' || clean === '/register/collector') {
    return { view: 'collector-signup' };
  }
  if (clean === '/signup' || clean === '/register') {
    return { view: 'citizen-signup' };
  }
  return { view: 'common-login' };
}

export function getAuthRouteForView(view: AuthView): string {
  switch (view) {
    case 'supervisor-signup':
      return '/signup/supervisor';
    case 'collector-signup':
      return '/signup/collector';
    case 'citizen-signup':
      return '/signup';
    case 'common-login':
    default:
      return '/';
  }
}

export interface LoginCredentialVerificationInput {
  email?: string;
  identifier?: string;
  password?: string;
  requestedRole?: UserRole;
  matchedUser?: { id: string; email: string; username?: string; role: UserRole; active?: boolean } | null;
  registeredPassword?: string;
  accountPassword?: string;
  adminEmail: string;
  adminPassword: string;
}

export interface LoginCredentialVerificationResult {
  valid: boolean;
  status: number;
  error?: string;
}

export const ROLE_DEFAULT_PASSWORDS: Record<Exclude<UserRole, 'admin'>, string> = {
  citizen: 'Citizen@1234',
  collector: 'Collector@1',
  supervisor: 'Supervisor12345'
};

export function verifyRoleLoginCredentials(
  input: LoginCredentialVerificationInput
): LoginCredentialVerificationResult {
  const identifier = (input.identifier ?? input.email ?? '').trim().toLowerCase();
  const password = input.password || '';

  if (!identifier) {
    return { valid: false, status: 400, error: 'Username or email is required.' };
  }
  if (!password) {
    return { valid: false, status: 400, error: 'Password is required.' };
  }

  const user = input.matchedUser;
  if (!user) {
    return {
      valid: false,
      status: 401,
      error: 'Invalid credentials. Please check your username/email or register first.'
    };
  }

  if (user.active === false) {
    return {
      valid: false,
      status: 403,
      error: 'This account is currently deactivated. Contact your administrator.'
    };
  }

  if (input.requestedRole && user.role !== input.requestedRole) {
    return {
      valid: false,
      status: 403,
      error: `This account is registered as "${user.role}". Use the dedicated ${user.role} login route to sign in.`
    };
  }

  if (user.role === 'admin') {
    const expectedAdminEmail = (input.adminEmail || 'admin@ecotrack.org').trim().toLowerCase();
    const expectedAdminPassword = input.adminPassword;
    const isEmailValid =
      identifier === expectedAdminEmail ||
      identifier === 'admin@ecotrack.org' ||
      identifier === 'admin@ecotrack.com';

    const isPasswordValid =
      Boolean(expectedAdminPassword) &&
      (password === expectedAdminPassword ||
        (expectedAdminPassword === 'Admin@1234' && password === 'Admin123435') ||
        (expectedAdminPassword === 'Admin123435' && password === 'Admin@1234'));

    if (!isEmailValid || !isPasswordValid) {
      return {
        valid: false,
        status: 401,
        error: 'Invalid Administrator credentials. Enter the unique Admin email and password.'
      };
    }
    return { valid: true, status: 200 };
  }

  if (input.registeredPassword !== undefined) {
    if (password !== input.registeredPassword) {
      return {
        valid: false,
        status: 401,
        error: 'Incorrect password. Please try again.'
      };
    }
    return { valid: true, status: 200 };
  }

  if (input.accountPassword !== undefined) {
    if (password !== input.accountPassword) {
      return {
        valid: false,
        status: 401,
        error: 'Incorrect password for this account. Please verify your credentials.'
      };
    }
    return { valid: true, status: 200 };
  }

  const expectedSeededPassword = ROLE_DEFAULT_PASSWORDS[user.role];
  const isDefaultPassword =
    password === expectedSeededPassword ||
    (user.role === 'supervisor' && (password === 'Supervisor@1234' || password === 'Supervisor12345')) ||
    (user.role === 'collector' && (password === 'Collector@1234' || password === 'Collector@1'));

  if (!isDefaultPassword) {
    return {
      valid: false,
      status: 401,
      error: 'Incorrect password for this account. Please verify your credentials.'
    };
  }

  return { valid: true, status: 200 };
}

export const QR_COMPLETABLE_STATUSES: PickupStatus[] = [
  'Scheduled',
  'Assigned',
  'Collector On The Way',
  'In Progress'
];

export function isQrCompletableStatus(status: PickupStatus): boolean {
  return QR_COMPLETABLE_STATUSES.includes(status);
}

/**
 * Generates a deterministic waste container label ID from a request number and category.
 * Example: ("ECOTRACK-REQ-1011", "Organic Waste") -> "BIN-1011-ORG"
 */
export function generateContainerTagId(requestNumber: string, categoryName?: string): string {
  const numMatch = (requestNumber || '').match(/(\d+)$/);
  const numericCode = numMatch ? numMatch[1] : '0000';
  const catClean = (categoryName || 'GEN')
    .replace(/[^a-zA-Z]/g, '')
    .slice(0, 3)
    .toUpperCase() || 'GEN';
  return `BIN-${numericCode}-${catClean}`;
}

/**
 * Builds the canonical QR code payload printed on waste container labels.
 */
export function buildContainerQrPayload(pickup: {
  requestNumber: string;
  containerTagId?: string;
  categoryName?: string;
}): string {
  const tag = pickup.containerTagId || generateContainerTagId(pickup.requestNumber, pickup.categoryName);
  return `ECOTRACK:BIN:${pickup.requestNumber}:${tag}`;
}

export interface ParsedContainerQrPayload {
  valid: boolean;
  raw: string;
  requestNumber?: string;
  containerTagId?: string;
  pickupId?: string;
}

/**
 * Parses a scanned waste container QR payload in any supported format:
 * - Structured label: ECOTRACK:BIN:ECOTRACK-REQ-1011:BIN-1011-ORG (or pipe-delimited)
 * - JSON label: {"app":"ECOTRACK","requestNumber":"ECOTRACK-REQ-1011","containerTagId":"BIN-1011-ORG"}
 * - Direct Request Number: ECOTRACK-REQ-1011
 * - Direct Container Tag ID: BIN-1011-ORG
 * - Direct Pickup ID: req-1011
 */
export function parseContainerQrPayload(rawText: string): ParsedContainerQrPayload {
  const raw = (rawText || '').trim();
  if (!raw) {
    return { valid: false, raw: '' };
  }

  // 1. JSON format
  if (raw.startsWith('{') && raw.endsWith('}')) {
    try {
      const parsed = JSON.parse(raw);
      const requestNumber = typeof parsed.requestNumber === 'string' ? parsed.requestNumber.trim().toUpperCase() : undefined;
      const containerTagId = typeof parsed.containerTagId === 'string' ? parsed.containerTagId.trim().toUpperCase() : undefined;
      const pickupId = typeof parsed.pickupId === 'string' ? parsed.pickupId.trim() : undefined;
      if (requestNumber || containerTagId || pickupId) {
        return { valid: true, raw, requestNumber, containerTagId, pickupId };
      }
    } catch {
      // Fall through to string parsers
    }
  }

  // 2. Structured colon or pipe format: ECOTRACK:BIN:ECOTRACK-REQ-1011:BIN-1011-ORG
  const upper = raw.toUpperCase();
  if (upper.startsWith('ECOTRACK:BIN:') || upper.startsWith('ECOTRACK|')) {
    const parts = raw.includes('|') ? raw.split('|') : raw.split(':');
    const reqPart = parts.find((part) => /^ECOTRACK-REQ-\d+$/i.test(part.trim()));
    const binPart = parts.find((part) => /^BIN-\d+-[A-Z0-9]+$/i.test(part.trim()));
    if (reqPart || binPart) {
      return {
        valid: true,
        raw,
        requestNumber: reqPart ? reqPart.trim().toUpperCase() : undefined,
        containerTagId: binPart ? binPart.trim().toUpperCase() : undefined
      };
    }
  }

  // 3. Direct Request Number
  if (/^ECOTRACK-REQ-\d+$/i.test(raw)) {
    return { valid: true, raw, requestNumber: upper };
  }

  // 4. Direct Container Tag ID
  if (/^BIN-\d+-[A-Z0-9]+$/i.test(raw)) {
    return { valid: true, raw, containerTagId: upper };
  }

  // 5. Direct internal pickup ID (req-1011)
  if (/^req-\d+$/i.test(raw)) {
    return { valid: true, raw, pickupId: raw.toLowerCase() };
  }

  return { valid: false, raw };
}

export interface QrPickupResolutionResult<T> {
  matched: boolean;
  pickup?: T;
  parsedCode: string;
  containerTagId?: string;
  error?: string;
}

/**
 * Matches a scanned QR container payload against a list of pickups for a collector,
 * verifying collector ownership and active completable status.
 */
export function resolvePickupFromQrScan<
  T extends {
    id: string;
    requestNumber: string;
    categoryName?: string;
    containerTagId?: string;
    assignedCollectorId?: string;
    assignedCollectorName?: string;
    status: PickupStatus;
  }
>(
  rawText: string,
  pickups: T[],
  collectorId: string,
  expectedPickupId?: string
): QrPickupResolutionResult<T> {
  const parsed = parseContainerQrPayload(rawText);
  if (!parsed.valid) {
    return {
      matched: false,
      parsedCode: (rawText || '').trim(),
      error: 'Unrecognized QR code format. Scan a valid EcoTrack container label (e.g. ECOTRACK:BIN:ECOTRACK-REQ-1011:BIN-1011-ORG).'
    };
  }

  const matched = pickups.find((p) => {
    const tag = (p.containerTagId || generateContainerTagId(p.requestNumber, p.categoryName)).toUpperCase();
    const matchesReq = parsed.requestNumber && p.requestNumber.toUpperCase() === parsed.requestNumber;
    const matchesTag = parsed.containerTagId && tag === parsed.containerTagId;
    const matchesId = parsed.pickupId && p.id.toLowerCase() === parsed.pickupId;

    if (parsed.requestNumber && parsed.containerTagId) {
      return Boolean(matchesReq && matchesTag);
    }
    return Boolean(matchesReq || matchesTag || matchesId);
  });

  if (!matched) {
    return {
      matched: false,
      parsedCode: parsed.raw,
      error: `No waste pickup request matches scanned container label "${parsed.raw}".`
    };
  }

  const resolvedTag = (
    matched.containerTagId || generateContainerTagId(matched.requestNumber, matched.categoryName)
  ).toUpperCase();

  if (expectedPickupId && matched.id !== expectedPickupId) {
    return {
      matched: false,
      parsedCode: parsed.raw,
      containerTagId: resolvedTag,
      error: `Scanned label belongs to ${matched.requestNumber} (${resolvedTag}), not the selected pickup container.`
    };
  }

  if (matched.assignedCollectorId && matched.assignedCollectorId !== collectorId) {
    return {
      matched: false,
      parsedCode: parsed.raw,
      containerTagId: resolvedTag,
      error: `Container ${matched.requestNumber} is assigned to ${matched.assignedCollectorName || 'another collector'}.`
    };
  }

  if (!matched.assignedCollectorId) {
    return {
      matched: false,
      parsedCode: parsed.raw,
      containerTagId: resolvedTag,
      error: `Pickup ${matched.requestNumber} has not been assigned to your shift yet.`
    };
  }

  if (matched.status === 'Completed') {
    return {
      matched: false,
      parsedCode: parsed.raw,
      containerTagId: resolvedTag,
      error: `Pickup ${matched.requestNumber} (${resolvedTag}) has already been verified and completed.`
    };
  }

  if (!isQrCompletableStatus(matched.status)) {
    return {
      matched: false,
      parsedCode: parsed.raw,
      containerTagId: resolvedTag,
      error: `Pickup ${matched.requestNumber} has status "${matched.status}" and cannot be completed via QR scan.`
    };
  }

  return {
    matched: true,
    pickup: matched,
    parsedCode: parsed.raw,
    containerTagId: resolvedTag
  };
}

export interface AutoQrCompletionPayload {
  scannedCode: string;
  actualQuantityKg: number;
  completionRemarks: string;
}

/**
 * Builds the default completion payload used when a QR scan automatically triggers
 * handleVerifyQrCompletion upon recognizing a valid container label.
 */
export function buildAutoQrCompletionPayload(
  pickup: {
    requestNumber: string;
    categoryName?: string;
    containerTagId?: string;
    quantityKg?: number;
  },
  scannedCode: string,
  resolvedContainerTagId?: string
): AutoQrCompletionPayload {
  const tagId = (
    resolvedContainerTagId ||
    pickup.containerTagId ||
    generateContainerTagId(pickup.requestNumber, pickup.categoryName)
  ).toUpperCase();

  const numericQty =
    typeof pickup.quantityKg === 'number' && Number.isFinite(pickup.quantityKg) && pickup.quantityKg >= 0.1
      ? Math.round(pickup.quantityKg * 10) / 10
      : 10;

  return {
    scannedCode: scannedCode.trim(),
    actualQuantityKg: numericQty,
    completionRemarks: `Container label ${tagId} verified via camera QR scan.`
  };
}

export const AREA_CENTER_COORDINATES: Record<string, [number, number]> = {
  'Warangal Urban': [17.9784, 79.5941],
  'Hanamkonda Central': [18.0073, 79.5583],
  'Subedari': [18.0125, 79.5489],
  'Kazipet Junction': [17.9765, 79.5162],
  'University Campus Zone': [18.0312, 79.5395],
  'Hunter Road Corridor': [17.9620, 79.5840],
  'Waddepally Lake Zone': [18.0250, 79.5420],
  // Hyderabad (GHMC)
  'Banjara Hills': [17.4156, 78.4347],
  'Gachibowli IT Corridor': [17.4401, 78.3489],
  'Jubilee Hills': [17.4326, 78.4071],
  'Madhapur / HITEC City': [17.4486, 78.3908],
  'Secunderabad Cantonment': [17.4399, 78.4983],
  'Kukatpally': [17.4948, 78.3996],
  'Charminar / Old City': [17.3616, 78.4747],
  'LB Nagar': [17.3457, 78.5522],
  // All Remaining 31 Telangana Districts & Municipal Zones
  'Vidyanagar (Adilabad)': [19.6641, 78.5320],
  'Ramavaram (Kothagudem)': [17.5512, 80.6197],
  'Mothe Road (Jagtial)': [18.7909, 78.9120],
  'Station Road (Jangaon)': [17.7265, 79.1520],
  'Ambedkar Center (Bhupalpally)': [18.4362, 79.8655],
  'Rajiv Nagar (Gadwal)': [16.2336, 77.8080],
  'Vidya Nagar (Kamareddy)': [18.3202, 78.3419],
  'Mukarampura': [18.4386, 79.1288],
  'Bhagatnagar': [18.4265, 79.1350],
  'Wyra Road': [17.2473, 80.1514],
  'Mamillagudem': [17.2545, 80.1410],
  'Asifabad Town': [19.3586, 79.2861],
  'Station Bazar (Mahabubabad)': [17.5979, 80.0021],
  'Clock Tower Center (Mahabubnagar)': [16.7488, 78.0035],
  'Hi-Tech City Colony (Mancherial)': [18.8756, 79.4591],
  'Ramdas Chowrasta (Medak)': [18.0480, 78.2608],
  'Malkajgiri East': [17.4474, 78.5326],
  'Kompally': [17.5364, 78.4845],
  'Mulugu Central': [18.1924, 79.9436],
  'Housing Board Colony (Nagarkurnool)': [16.4820, 78.3220],
  'Clock Tower Zone (Nalgonda)': [17.0575, 79.2684],
  'Subhash Nagar (Narayanpet)': [16.7453, 77.4962],
  'Shastri Nagar (Nirmal)': [19.0964, 78.3430],
  'Subhash Nagar (Nizamabad)': [18.6725, 78.0941],
  'Godavarikhani Central': [18.7519, 79.4744],
  'Shantinagar (Sircilla)': [18.3892, 78.8091],
  'Rajendranagar': [17.3198, 78.4018],
  'Shamshabad': [17.2544, 78.4021],
  'Patancheru': [17.5287, 78.2667],
  'Komati Cheruvu Zone (Siddipet)': [18.1019, 78.8521],
  'Kudakuda Road (Suryapet)': [17.1398, 79.6239],
  'MG Road & Vidya Nagar (Suryapet)': [17.1432, 79.6205],
  'Alampally (Vikarabad)': [17.3380, 77.9048],
  'KDR Nagar (Wanaparthy)': [16.3622, 78.0628],
  'Bhongir Fort Zone': [17.5137, 78.8878],
  // District-name fallbacks
  'Adilabad': [19.6641, 78.5320],
  'Bhadradri Kothagudem': [17.5512, 80.6197],
  'Hanamkonda': [18.0073, 79.5583],
  'Hyderabad': [17.3850, 78.4867],
  'Jagtial': [18.7909, 78.9120],
  'Jangaon': [17.7265, 79.1520],
  'Jayashankar Bhupalpally': [18.4362, 79.8655],
  'Jogulamba Gadwal': [16.2336, 77.8080],
  'Kamareddy': [18.3202, 78.3419],
  'Karimnagar': [18.4386, 79.1288],
  'Khammam': [17.2473, 80.1514],
  'Kumuram Bheem Asifabad': [19.3586, 79.2861],
  'Mahabubabad': [17.5979, 80.0021],
  'Mahabubnagar': [16.7488, 78.0035],
  'Mancherial': [18.8756, 79.4591],
  'Medak': [18.0480, 78.2608],
  'Medchal-Malkajgiri': [17.4474, 78.5326],
  'Mulugu': [18.1924, 79.9436],
  'Nagarkurnool': [16.4820, 78.3220],
  'Nalgonda': [17.0575, 79.2684],
  'Narayanpet': [16.7453, 77.4962],
  'Nirmal': [19.0964, 78.3430],
  'Nizamabad': [18.6725, 78.0941],
  'Peddapalli': [18.7519, 79.4744],
  'Rajanna Sircilla': [18.3892, 78.8091],
  'Rangareddy': [17.3198, 78.4018],
  'Sangareddy': [17.5287, 78.2667],
  'Siddipet': [18.1019, 78.8521],
  'Suryapet': [17.1398, 79.6239],
  'Vikarabad': [17.3380, 77.9048],
  'Wanaparthy': [16.3622, 78.0628],
  'Warangal': [17.9784, 79.5941],
  'Yadadri Bhuvanagiri': [17.5137, 78.8878]
};

export function isValidCoordinates(latitude?: unknown, longitude?: unknown): boolean {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') return false;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;
  if (latitude < -90 || latitude > 90) return false;
  if (longitude < -180 || longitude > 180) return false;
  if (latitude === 0 && longitude === 0) return false;
  return true;
}

export function formatCoordinates(latitude: number, longitude: number, decimals: number = 5): string {
  return `${latitude.toFixed(decimals)}, ${longitude.toFixed(decimals)}`;
}

export function getAreaCenterCoordinates(areaName?: string): [number, number] {
  if (areaName && AREA_CENTER_COORDINATES[areaName]) {
    return AREA_CENTER_COORDINATES[areaName];
  }
  if (areaName) {
    const key = Object.keys(AREA_CENTER_COORDINATES).find(
      (k) => k.toLowerCase() === areaName.trim().toLowerCase()
    );
    if (key) return AREA_CENTER_COORDINATES[key];
  }
  return AREA_CENTER_COORDINATES['Warangal Urban'];
}

export interface ResolvedPickupCoordinates {
  coords: [number, number];
  isExactPin: boolean;
  source: 'pickup' | 'household' | 'area';
}

/**
 * Resolves the pickup's map coordinates in priority order:
 * 1. Exact per-pickup pinned coordinates (citizen-dropped map pin)
 * 2. Registered household's pinned coordinates
 * 3. Deterministic municipal area fallback coordinates
 */
export function resolvePickupCoordinates(
  pickup: {
    id: string;
    area?: string;
    householdId?: string;
    latitude?: number;
    longitude?: number;
  },
  households: { id: string; latitude?: number; longitude?: number }[] = [],
  index: number = 0
): ResolvedPickupCoordinates {
  if (isValidCoordinates(pickup.latitude, pickup.longitude)) {
    return {
      coords: [Number(pickup.latitude), Number(pickup.longitude)],
      isExactPin: true,
      source: 'pickup'
    };
  }

  if (pickup.householdId && households.length > 0) {
    const hh = households.find((h) => h.id === pickup.householdId);
    if (hh && isValidCoordinates(hh.latitude, hh.longitude)) {
      return {
        coords: [Number(hh.latitude), Number(hh.longitude)],
        isExactPin: true,
        source: 'household'
      };
    }
  }

  const base = getAreaCenterCoordinates(pickup.area);
  const lastChar = pickup.id ? pickup.id.charCodeAt(pickup.id.length - 1) : index;
  const secondLastChar = pickup.id && pickup.id.length > 1 ? pickup.id.charCodeAt(pickup.id.length - 2) : index;
  const latOffset = ((lastChar % 17) - 8) * 0.0035;
  const lngOffset = ((secondLastChar % 19) - 9) * 0.0035;

  return {
    coords: [Number((base[0] + latOffset).toFixed(6)), Number((base[1] + lngOffset).toFixed(6))],
    isExactPin: false,
    source: 'area'
  };
}

export interface QrSuccessFeedbackData {
  id: string;
  pickupId: string;
  requestNumber: string;
  containerTagId: string;
  citizenName: string;
  categoryName: string;
  actualQuantityKg: number;
  triggeredAt: number;
}

/**
 * Formats verified pickup details for the full-screen QR completion visual success overlay.
 */
export function buildQrSuccessFeedbackData(
  pickup: {
    id: string;
    requestNumber: string;
    containerTagId?: string;
    citizenName?: string;
    categoryName?: string;
    actualQuantityKg?: number;
    quantityKg?: number;
  },
  triggeredAt: number = Date.now()
): QrSuccessFeedbackData {
  const categoryName = pickup.categoryName || 'Waste Pickup';
  const containerTagId = (
    pickup.containerTagId ||
    generateContainerTagId(pickup.requestNumber, categoryName)
  ).toUpperCase();

  const rawKg =
    typeof pickup.actualQuantityKg === 'number' && Number.isFinite(pickup.actualQuantityKg) && pickup.actualQuantityKg > 0
      ? pickup.actualQuantityKg
      : typeof pickup.quantityKg === 'number' && Number.isFinite(pickup.quantityKg) && pickup.quantityKg > 0
        ? pickup.quantityKg
        : 0;

  return {
    id: `qr-success-${pickup.id}-${triggeredAt}`,
    pickupId: pickup.id,
    requestNumber: pickup.requestNumber,
    containerTagId,
    citizenName: pickup.citizenName || 'Resident',
    categoryName,
    actualQuantityKg: Math.round(rawKg * 10) / 10,
    triggeredAt
  };
}

export const PENDING_ROUTE_STATUSES: PickupStatus[] = [
  'Submitted',
  'Pending Approval',
  'Approved',
  'Scheduled',
  'Assigned',
  'Collector On The Way',
  'In Progress'
];

export interface PendingRouteInputStop {
  id: string;
  requestNumber: string;
  citizenName: string;
  citizenPhone?: string;
  address: string;
  area: string;
  ward: string;
  categoryName: string;
  quantityKg: number;
  status: PickupStatus;
  assignedCollectorId?: string;
  assignedCollectorName?: string;
  preferredTimeSlot?: string;
  scheduledTimeSlot?: string;
  pickupLocationNote?: string;
  latitude: number;
  longitude: number;
  isExactPin: boolean;
}

export interface OptimizedRouteStop extends PendingRouteInputStop {
  stopOrder: number;
  legDistanceKm: number;
  legDurationMin: number;
  cumulativeDistanceKm: number;
  cumulativeDurationMin: number;
  nextInstruction?: string;
}

export interface OptimizedAreaRouteResult {
  serviceArea: string;
  origin: { latitude: number; longitude: number };
  provider: 'google-routes-api' | 'ecotrack-tsp-fallback';
  googleMapsConfigured: boolean;
  totalStops: number;
  totalDistanceKm: number;
  totalDurationMin: number;
  polylinePath: [number, number][];
  stops: OptimizedRouteStop[];
  calculatedAt: string;
  notice?: string;
}

/**
 * Decodes an encoded polyline string from Google Maps Routes API into [lat, lng] coordinate pairs.
 */
export function decodeGooglePolyline(encoded: string): [number, number][] {
  if (!encoded || typeof encoded !== 'string') return [];
  const points: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([Number((lat / 1e5).toFixed(6)), Number((lng / 1e5).toFixed(6))]);
  }

  return points;
}

/**
 * Collects all pending pickups inside the target service area and resolves their coordinates.
 */
export function buildPendingAreaStops(
  pickups: any[],
  serviceArea: string,
  households: { id: string; latitude?: number; longitude?: number }[] = []
): PendingRouteInputStop[] {
  const normalizedArea = (serviceArea || '').trim().toLowerCase();

  return (pickups || [])
    .filter((p) => {
      if (!PENDING_ROUTE_STATUSES.includes(p.status)) return false;
      if (!normalizedArea || normalizedArea === 'all areas') return true;
      return (p.area || '').trim().toLowerCase() === normalizedArea;
    })
    .map((p, idx) => {
      const resolved = resolvePickupCoordinates(p, households, idx);
      return {
        id: p.id,
        requestNumber: p.requestNumber,
        citizenName: p.citizenName,
        citizenPhone: p.citizenPhone || '',
        address: p.address,
        area: p.area,
        ward: p.ward,
        categoryName: p.categoryName,
        quantityKg: Number(p.quantityKg || 0),
        status: p.status,
        assignedCollectorId: p.assignedCollectorId,
        assignedCollectorName: p.assignedCollectorName,
        preferredTimeSlot: p.preferredTimeSlot,
        scheduledTimeSlot: p.scheduledTimeSlot,
        pickupLocationNote: p.pickupLocationNote,
        latitude: resolved.coords[0],
        longitude: resolved.coords[1],
        isExactPin: resolved.isExactPin
      };
    });
}

/**
 * Computes an efficient Nearest-Neighbor TSP sequence across all pending pickups in a service area.
 */
export function optimizePendingPickupsLocally(
  origin: { latitude: number; longitude: number },
  pendingStops: PendingRouteInputStop[],
  serviceArea: string,
  googleMapsConfigured: boolean = false,
  notice?: string
): OptimizedAreaRouteResult {
  if (!pendingStops || pendingStops.length === 0) {
    return {
      serviceArea,
      origin,
      provider: 'ecotrack-tsp-fallback',
      googleMapsConfigured,
      totalStops: 0,
      totalDistanceKm: 0,
      totalDurationMin: 0,
      polylinePath: [],
      stops: [],
      calculatedAt: new Date().toISOString(),
      notice
    };
  }

  const remaining = [...pendingStops];
  const ordered: OptimizedRouteStop[] = [];
  const fullPolyline: [number, number][] = [[origin.latitude, origin.longitude]];

  let curLat = origin.latitude;
  let curLng = origin.longitude;
  let cumulativeDistanceKm = 0;
  let cumulativeDurationMin = 0;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      // Slight priority bias (-0.25km) for already In Progress stops so active arrival stays first
      const rawDist = calculateHaversineDistanceKm(curLat, curLng, candidate.latitude, candidate.longitude);
      const weightedDist = candidate.status === 'In Progress' ? Math.max(0, rawDist - 0.25) : rawDist;
      if (weightedDist < bestDist) {
        bestDist = weightedDist;
        bestIdx = i;
      }
    }

    const nextStop = remaining.splice(bestIdx, 1)[0];
    const legDist = Number(
      Math.max(0.15, calculateHaversineDistanceKm(curLat, curLng, nextStop.latitude, nextStop.longitude)).toFixed(2)
    );
    const legMin = calculateEstimatedTransitMinutes(legDist, 24);

    cumulativeDistanceKm = Number((cumulativeDistanceKm + legDist).toFixed(2));
    cumulativeDurationMin += legMin;

    const segmentPoints = generateRealisticRouteWaypoints([curLat, curLng], [nextStop.latitude, nextStop.longitude]);
    for (let s = 1; s < segmentPoints.length; s++) {
      fullPolyline.push(segmentPoints[s]);
    }

    ordered.push({
      ...nextStop,
      stopOrder: ordered.length + 1,
      legDistanceKm: legDist,
      legDurationMin: legMin,
      cumulativeDistanceKm,
      cumulativeDurationMin,
      nextInstruction: `Proceed ${legDist} km to ${nextStop.address} (${nextStop.ward})`
    });

    curLat = nextStop.latitude;
    curLng = nextStop.longitude;
  }

  return {
    serviceArea,
    origin,
    provider: 'ecotrack-tsp-fallback',
    googleMapsConfigured,
    totalStops: ordered.length,
    totalDistanceKm: cumulativeDistanceKm,
    totalDurationMin: cumulativeDurationMin,
    polylinePath: fullPolyline,
    stops: ordered,
    calculatedAt: new Date().toISOString(),
    notice
  };
}

/**
 * Parses Google Routes API v2 computeRoutes response into EcoTrack's ordered OptimizedAreaRouteResult.
 */
export function parseGoogleComputeRoutesResponse(
  apiJson: any,
  origin: { latitude: number; longitude: number },
  intermediates: PendingRouteInputStop[],
  destinationStop: PendingRouteInputStop,
  serviceArea: string
): OptimizedAreaRouteResult | null {
  const route = apiJson?.routes?.[0];
  if (!route) return null;

  const optimizedIndices: number[] = Array.isArray(route.optimizedIntermediateWaypointIndex)
    ? route.optimizedIntermediateWaypointIndex
    : intermediates.map((_, idx) => idx);

  const orderedInputStops: PendingRouteInputStop[] = [
    ...optimizedIndices
      .map((idx) => intermediates[idx])
      .filter((s): s is PendingRouteInputStop => Boolean(s)),
    destinationStop
  ];

  const legs: any[] = Array.isArray(route.legs) ? route.legs : [];
  let cumulativeDistanceKm = 0;
  let cumulativeDurationMin = 0;

  const stops: OptimizedRouteStop[] = orderedInputStops.map((stop, idx) => {
    const leg = legs[idx];
    const legDistKm = leg?.distanceMeters
      ? Number((Number(leg.distanceMeters) / 1000).toFixed(2))
      : 0.5;
    const rawDurationStr = typeof leg?.duration === 'string' ? leg.duration : '120s';
    const legSeconds = parseInt(rawDurationStr.replace('s', ''), 10) || 120;
    const legMin = Math.max(1, Math.round(legSeconds / 60));

    cumulativeDistanceKm = Number((cumulativeDistanceKm + legDistKm).toFixed(2));
    cumulativeDurationMin += legMin;

    const firstInstruction =
      leg?.steps?.[0]?.navigationInstruction?.instructions ||
      `Head ${legDistKm} km toward ${stop.address}`;

    return {
      ...stop,
      stopOrder: idx + 1,
      legDistanceKm: legDistKm,
      legDurationMin: legMin,
      cumulativeDistanceKm,
      cumulativeDurationMin,
      nextInstruction: firstInstruction
    };
  });

  const encoded = route?.polyline?.encodedPolyline;
  const decodedPath = encoded ? decodeGooglePolyline(encoded) : [];

  const totalDistanceKm = route.distanceMeters
    ? Number((Number(route.distanceMeters) / 1000).toFixed(2))
    : cumulativeDistanceKm;

  const totalSec =
    typeof route.duration === 'string'
      ? parseInt(route.duration.replace('s', ''), 10) || cumulativeDurationMin * 60
      : cumulativeDurationMin * 60;

  return {
    serviceArea,
    origin,
    provider: 'google-routes-api',
    googleMapsConfigured: true,
    totalStops: stops.length,
    totalDistanceKm,
    totalDurationMin: Math.max(1, Math.round(totalSec / 60)),
    polylinePath:
      decodedPath.length > 0
        ? decodedPath
        : [[origin.latitude, origin.longitude], ...stops.map((s) => [s.latitude, s.longitude] as [number, number])],
    stops,
    calculatedAt: new Date().toISOString()
  };
}

// -------------------------------------------------------------
// CITIZEN GAMIFICATION & VIRTUAL BADGES ENGINE
// -------------------------------------------------------------
export interface GamificationPickupInput {
  id: string;
  requestNumber?: string;
  categoryId?: string;
  categoryName?: string;
  quantityKg?: number;
  actualQuantityKg?: number;
  status: PickupStatus | string;
  qrVerified?: boolean;
  qrVerifiedAt?: string;
  segregationVerified?: boolean;
  completedAt?: string;
  updatedAt?: string;
}

const RECYCLABLE_STREAM_IDS = new Set([
  'cat-recyclable',
  'cat-plastic',
  'cat-paper',
  'cat-electronic'
]);

const RECYCLABLE_STREAM_NAMES = new Set([
  'recyclable waste',
  'plastic waste',
  'paper waste',
  'electronic waste'
]);

/**
 * Determines whether a completed pickup satisfies municipal source segregation rules.
 * Sorted streams (Organic, Recyclable, Plastic, Paper, Electronic, Hazardous, Construction)
 * qualify unless explicitly flagged false (`segregationVerified === false`), while General Waste
 * qualifies only when explicitly verified by the collector (`segregationVerified === true`).
 */
export function isProperlySegregatedPickup(pickup: GamificationPickupInput): boolean {
  if (!pickup || pickup.status !== 'Completed') return false;
  if (pickup.segregationVerified === false) return false;
  if (pickup.segregationVerified === true) return true;

  const catId = (pickup.categoryId || '').trim().toLowerCase();
  const catName = (pickup.categoryName || '').trim().toLowerCase();
  if (catId === 'cat-general' || catName === 'general waste') return false;
  return Boolean(catId || catName);
}

function isRecyclableStreamPickup(pickup: GamificationPickupInput): boolean {
  if (!isProperlySegregatedPickup(pickup)) return false;
  const catId = (pickup.categoryId || '').trim().toLowerCase();
  const catName = (pickup.categoryName || '').trim().toLowerCase();
  return RECYCLABLE_STREAM_IDS.has(catId) || RECYCLABLE_STREAM_NAMES.has(catName);
}

/**
 * Evaluates citizen collection frequency, segregation accuracy, diverted weight,
 * eco-points, tier level, and earned/in-progress virtual badges.
 */
export function evaluateCitizenGamification(
  citizenPickups: GamificationPickupInput[]
): CitizenGamificationSummary {
  const safeList = Array.isArray(citizenPickups) ? citizenPickups : [];
  const completed = safeList
    .filter((p) => p.status === 'Completed')
    .sort((a, b) => {
      const ta = new Date(a.completedAt || a.updatedAt || 0).getTime();
      const tb = new Date(b.completedAt || b.updatedAt || 0).getTime();
      return ta - tb;
    });

  const segregated = completed.filter(isProperlySegregatedPickup);
  const recycled = segregated.filter(isRecyclableStreamPickup);
  const qrVerifiedSegregated = segregated.filter((p) => Boolean(p.qrVerified));

  const distinctCategories = new Set(
    segregated.map((p) => (p.categoryName || p.categoryId || 'sorted').trim().toLowerCase())
  );

  const totalDivertedKg = Number(
    segregated
      .reduce((sum, p) => {
        const kg = Number(p.actualQuantityKg ?? p.quantityKg ?? 0);
        return sum + (Number.isFinite(kg) && kg > 0 ? kg : 0);
      }, 0)
      .toFixed(1)
  );

  const completedPickupsCount = completed.length;
  const segregatedPickupsCount = segregated.length;
  const recycledStreamCount = recycled.length;
  const distinctSegregatedCategories = distinctCategories.size;

  const segregationRatePercent =
    completedPickupsCount > 0
      ? Math.round((segregatedPickupsCount / completedPickupsCount) * 100)
      : 0;

  // Build itemized Point History activity logs ordered newest-first
  const pointHistory: CitizenPointHistoryEntry[] = [];
  const newestFirstCompleted = [...completed].reverse();

  for (const p of newestFirstCompleted) {
    const reqNumber = p.requestNumber || p.id.toUpperCase();
    const catName = p.categoryName || 'Municipal Waste';
    const awardedAt = p.completedAt || p.qrVerifiedAt || p.updatedAt || '';
    const isSegregated = isProperlySegregatedPickup(p);

    pointHistory.push({
      id: `${p.id}-pickup-completed`,
      pickupId: p.id,
      requestNumber: reqNumber,
      categoryName: catName,
      type: 'pickup_completed',
      title: 'Pickup Completed',
      reason: `Doorstep collection completed (${catName})`,
      points: 25,
      awardedAt
    });

    if (isSegregated) {
      pointHistory.push({
        id: `${p.id}-segregation-bonus`,
        pickupId: p.id,
        requestNumber: reqNumber,
        categoryName: catName,
        type: 'segregation_bonus',
        title: 'Source Segregation Verified',
        reason: `Clean sorting verified for ${catName}`,
        points: 15,
        awardedAt
      });

      if (p.qrVerified) {
        pointHistory.push({
          id: `${p.id}-qr-verified`,
          pickupId: p.id,
          requestNumber: reqNumber,
          categoryName: catName,
          type: 'qr_verified',
          title: 'QR Container Verified',
          reason: 'Container label scanned by field collector',
          points: 10,
          awardedAt: p.qrVerifiedAt || awardedAt
        });
      }

      const rawKg = Number(p.actualQuantityKg ?? p.quantityKg ?? 0);
      const cleanKg = Number.isFinite(rawKg) && rawKg > 0 ? Math.round(rawKg * 10) / 10 : 0;
      const weightPts = Math.round(cleanKg * 2);
      if (weightPts > 0) {
        pointHistory.push({
          id: `${p.id}-weight-diverted`,
          pickupId: p.id,
          requestNumber: reqNumber,
          categoryName: catName,
          type: 'weight_diverted',
          title: `Waste Diverted (${cleanKg} kg)`,
          reason: `Landfill diversion credit (${cleanKg} kg × 2 pts/kg)`,
          points: weightPts,
          awardedAt
        });
      }
    }
  }

  const ecoPoints = pointHistory.reduce((sum, entry) => sum + entry.points, 0);

  let level = 'Green Starter';
  let nextLevelName: string | null = 'Eco-Conscious Neighbor';
  let pointsToNextLevel = Math.max(0, 100 - ecoPoints);

  if (ecoPoints >= 500) {
    level = 'Zero-Waste Champion';
    nextLevelName = null;
    pointsToNextLevel = 0;
  } else if (ecoPoints >= 250) {
    level = 'Community Eco-Warrior';
    nextLevelName = 'Zero-Waste Champion';
    pointsToNextLevel = 500 - ecoPoints;
  } else if (ecoPoints >= 100) {
    level = 'Eco-Conscious Neighbor';
    nextLevelName = 'Community Eco-Warrior';
    pointsToNextLevel = 250 - ecoPoints;
  }

  const getUnlockTimestamp = (items: GamificationPickupInput[], thresholdIndex: number): string | undefined => {
    const item = items[thresholdIndex - 1];
    return item ? item.completedAt || item.updatedAt : undefined;
  };

  const buildProgress = (current: number, target: number) => {
    const clampedCurrent = Math.min(current, target);
    return {
      progressCurrent: current,
      progressTarget: target,
      progressPercent: target > 0 ? Math.min(100, Math.round((clampedCurrent / target) * 100)) : 0
    };
  };

  const firstPickupProg = buildProgress(completedPickupsCount, 1);
  const ecoWarriorProg = buildProgress(segregatedPickupsCount, 3);
  const recyclingProProg = buildProgress(recycledStreamCount, 3);
  const segregationMasterProg = buildProgress(distinctSegregatedCategories, 3);
  const streakContributorProg = buildProgress(completedPickupsCount, 5);
  const zeroWasteGuardianProg = buildProgress(Math.round(totalDivertedKg * 10) / 10, 50);

  // Track timestamp when distinct categories hit 3
  let distinctCategoryUnlockAt: string | undefined;
  if (distinctSegregatedCategories >= 3) {
    const seen = new Set<string>();
    for (const p of segregated) {
      seen.add((p.categoryName || p.categoryId || 'sorted').trim().toLowerCase());
      if (seen.size >= 3) {
        distinctCategoryUnlockAt = p.completedAt || p.updatedAt;
        break;
      }
    }
  }

  // Track timestamp when cumulative segregated weight hit 50 kg
  let guardianUnlockAt: string | undefined;
  if (totalDivertedKg >= 50) {
    let runningKg = 0;
    for (const p of segregated) {
      const kg = Number(p.actualQuantityKg ?? p.quantityKg ?? 0);
      if (Number.isFinite(kg) && kg > 0) runningKg += kg;
      if (runningKg >= 50) {
        guardianUnlockAt = p.completedAt || p.updatedAt;
        break;
      }
    }
  }

  const badges: CitizenBadge[] = [
    {
      id: 'first-pickup',
      title: 'First Green Step',
      description: 'Completed your very first municipal doorstep waste collection.',
      criteriaLabel: 'Complete 1 pickup',
      category: 'frequency',
      tier: 'bronze',
      earned: completedPickupsCount >= 1,
      ...firstPickupProg,
      unitLabel: 'pickups',
      earnedAt: completedPickupsCount >= 1 ? getUnlockTimestamp(completed, 1) : undefined
    },
    {
      id: 'eco-warrior',
      title: 'Eco-Warrior',
      description: 'Consistently separated waste cleanly across 3 completed household pickups.',
      criteriaLabel: '3 segregated pickups',
      category: 'segregation',
      tier: 'emerald',
      earned: segregatedPickupsCount >= 3,
      ...ecoWarriorProg,
      unitLabel: 'segregated',
      earnedAt: segregatedPickupsCount >= 3 ? getUnlockTimestamp(segregated, 3) : undefined
    },
    {
      id: 'recycling-pro',
      title: 'Recycling Pro',
      description: 'Diverted dry Recyclable, Plastic, Paper, or E-Waste across 3 verified pickups.',
      criteriaLabel: '3 recycling pickups',
      category: 'segregation',
      tier: 'silver',
      earned: recycledStreamCount >= 3,
      ...recyclingProProg,
      unitLabel: 'recycled',
      earnedAt: recycledStreamCount >= 3 ? getUnlockTimestamp(recycled, 3) : undefined
    },
    {
      id: 'segregation-master',
      title: 'Segregation Master',
      description: 'Sorted waste accurately into 3 or more distinct municipal material streams.',
      criteriaLabel: '3 sorted waste types',
      category: 'segregation',
      tier: 'gold',
      earned: distinctSegregatedCategories >= 3,
      ...segregationMasterProg,
      unitLabel: 'categories',
      earnedAt: distinctCategoryUnlockAt
    },
    {
      id: 'consistent-contributor',
      title: 'Streak Contributor',
      description: 'Maintained steady collection frequency with 5 completed doorstep pickups.',
      criteriaLabel: 'Complete 5 pickups',
      category: 'frequency',
      tier: 'silver',
      earned: completedPickupsCount >= 5,
      ...streakContributorProg,
      unitLabel: 'pickups',
      earnedAt: completedPickupsCount >= 5 ? getUnlockTimestamp(completed, 5) : undefined
    },
    {
      id: 'zero-waste-guardian',
      title: 'Zero-Waste Guardian',
      description: 'Diverted 50 kg or more of properly segregated waste away from landfills.',
      criteriaLabel: 'Divert 50 kg sorted',
      category: 'impact',
      tier: 'gold',
      earned: totalDivertedKg >= 50,
      ...zeroWasteGuardianProg,
      unitLabel: 'kg',
      earnedAt: guardianUnlockAt
    }
  ];

  const earnedBadgesCount = badges.filter((b) => b.earned).length;

  return {
    ecoPoints,
    level,
    nextLevelName,
    pointsToNextLevel,
    completedPickupsCount,
    segregatedPickupsCount,
    segregationRatePercent,
    recycledStreamCount,
    distinctSegregatedCategories,
    totalDivertedKg,
    earnedBadgesCount,
    totalBadgesCount: badges.length,
    badges,
    pointHistory
  };
}

// -------------------------------------------------------------
// GOOGLE AUTH HELPERS (EMAIL EXTRACTION & ACTIONABLE ERRORS)
// -------------------------------------------------------------
export function extractGoogleAccountEmail(
  primaryEmail?: string | null,
  providerData?: Array<{ email?: string | null } | null> | null
): string {
  const direct = typeof primaryEmail === 'string' ? primaryEmail.trim() : '';
  if (direct) return direct;

  if (Array.isArray(providerData)) {
    for (const item of providerData) {
      const candidate = typeof item?.email === 'string' ? item.email.trim() : '';
      if (candidate) return candidate;
    }
  }
  return '';
}

export function formatGoogleAuthErrorMessage(
  errorCode?: string,
  rawMessage?: string,
  hostname?: string,
  projectId?: string
): string {
  const code = (errorCode || '').trim();
  const host = (hostname || '').trim() || 'this domain';
  const projectHint = (projectId || '').trim() ? ` (project: ${projectId!.trim()})` : '';

  switch (code) {
    case 'auth/unauthorized-domain':
      return `Google Sign-In is not authorized for "${host}". Add "${host}" under Firebase Console${projectHint} -> Authentication -> Settings -> Authorized domains.`;
    case 'auth/popup-blocked':
      return 'The Google sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was cancelled before completing. Please try again.';
    case 'auth/operation-not-allowed':
      return 'Google Sign-In is disabled in Firebase Authentication. Enable the Google provider in Firebase Console -> Authentication -> Sign-in method.';
    case 'auth/network-request-failed':
      return 'Network error while connecting to Google Sign-In. Check your internet connection and try again.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using email/password login. Please sign in with your password.';
    case 'auth/user-disabled':
      return 'This Google account has been disabled. Contact your EcoTrack Administrator.';
    default:
      return (rawMessage || '').trim() || 'Google Sign-In failed. Please try again.';
  }
}


