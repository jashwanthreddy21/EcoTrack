import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateCompletionRate,
  calculateAverageCompletionTimeMinutes,
  checkSchedulingConflict,
  isValidStatusTransition,
  generateRequestNumber,
  validatePickupRequest,
  validatePhoneNumber,
  formatTelHref,
  aggregateWasteByCategory,
  findNextScheduledPickupForCollector,
  calculateHaversineDistanceKm,
  calculateEstimatedTransitMinutes,
  generateRealisticRouteWaypoints,
  predictFutureWasteVolumes,
  filterPickupsByLocation,
  filterSchedulesByLocation,
  parseBotActionBadges,
  validateServiceAreaRequest,
  matchNearestSupportedArea,
  getDefaultScreenForRole,
  isScreenAllowedForRole,
  resolveAccessibleScreen,
  scopePickupsForUser,
  verifyRoleLoginCredentials,
  parseAuthRoute,
  getAuthRouteForView,
  generateContainerTagId,
  buildContainerQrPayload,
  parseContainerQrPayload,
  resolvePickupFromQrScan,
  buildAutoQrCompletionPayload,
  isValidCoordinates,
  formatCoordinates,
  getAreaCenterCoordinates,
  resolvePickupCoordinates,
  buildQrSuccessFeedbackData,
  decodeGooglePolyline,
  optimizePendingPickupsLocally,
  parseGoogleComputeRoutesResponse,
  isProperlySegregatedPickup,
  evaluateCitizenGamification,
  extractGoogleAccountEmail,
  formatGoogleAuthErrorMessage
} from './ecoLogic.ts';

test('calculateCompletionRate computes percentages properly', () => {
  assert.equal(calculateCompletionRate(8, 10), 80);
  assert.equal(calculateCompletionRate(1, 3), 33.3);
  assert.equal(calculateCompletionRate(0, 0), 0);
  assert.equal(calculateCompletionRate(5, 0), 0);
  assert.equal(calculateCompletionRate(15, 10), 100);
});

test('calculateAverageCompletionTimeMinutes handles durations accurately', () => {
  assert.equal(calculateAverageCompletionTimeMinutes([30, 45, 60]), 45);
  assert.equal(calculateAverageCompletionTimeMinutes([]), 0);
  assert.equal(calculateAverageCompletionTimeMinutes([20, 25]), 22.5);
});

test('checkSchedulingConflict flags overlapping collector shifts', () => {
  const existing = [
    { id: '1', collectorId: 'col-1', date: '2026-11-05', timeSlot: '09:00 AM – 12:00 PM' },
    { id: '2', collectorId: 'col-2', date: '2026-11-05', timeSlot: '09:00 AM – 12:00 PM' }
  ];

  // Overlap on same date and slot for col-1
  assert.equal(
    checkSchedulingConflict(existing, { collectorId: 'col-1', date: '2026-11-05', timeSlot: '09:00 AM – 12:00 PM' }),
    true
  );

  // Different time slot - no conflict
  assert.equal(
    checkSchedulingConflict(existing, { collectorId: 'col-1', date: '2026-11-05', timeSlot: '01:00 PM – 04:00 PM' }),
    false
  );

  // Different collector - no conflict
  assert.equal(
    checkSchedulingConflict(existing, { collectorId: 'col-3', date: '2026-11-05', timeSlot: '09:00 AM – 12:00 PM' }),
    false
  );
});

test('isValidStatusTransition enforces proper workflow states', () => {
  assert.equal(isValidStatusTransition('Submitted', 'Pending Approval'), true);
  assert.equal(isValidStatusTransition('Assigned', 'Collector On The Way'), true);
  assert.equal(isValidStatusTransition('In Progress', 'Completed'), true);
  assert.equal(isValidStatusTransition('In Progress', 'Missed'), true);
  assert.equal(isValidStatusTransition('Completed', 'In Progress'), false);
  assert.equal(isValidStatusTransition('Cancelled', 'Assigned'), false);
});

test('generateRequestNumber formats reference ID correctly', () => {
  assert.equal(generateRequestNumber(1), 'ECOTRACK-REQ-1001');
  assert.equal(generateRequestNumber(24), 'ECOTRACK-REQ-1024');
});

test('validatePickupRequest validates form fields properly', () => {
  const valid = validatePickupRequest({
    householdId: 'hh-1',
    categoryId: 'cat-organic',
    quantityKg: 12.5,
    preferredDate: '2026-11-10',
    preferredTimeSlot: '09:00 AM – 12:00 PM'
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.errors.length, 0);

  const invalid = validatePickupRequest({
    householdId: '',
    categoryId: '',
    quantityKg: 0,
    preferredDate: '',
    preferredTimeSlot: ''
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length >= 4, true);
});

test('validatePhoneNumber and formatTelHref validate citizen phone numbers accurately', () => {
  const ok1 = validatePhoneNumber('+91 98480 12345');
  assert.equal(ok1.valid, true);
  assert.equal(ok1.normalized, '+91 98480 12345');
  assert.equal(formatTelHref(ok1.normalized), 'tel:+919848012345');

  const ok2 = validatePhoneNumber('9876543210');
  assert.equal(ok2.valid, true);
  assert.equal(formatTelHref('9876543210'), 'tel:9876543210');

  assert.equal(validatePhoneNumber('').valid, false);
  const shortPhone = validatePhoneNumber('12345');
  assert.equal(shortPhone.valid, false);
  assert.match(shortPhone.error || '', /10 to 15 digits/);
  assert.equal(validatePhoneNumber('abc-def-ghij').valid, false);
});

test('aggregateWasteByCategory correctly groups waste metrics', () => {
  const result = aggregateWasteByCategory([
    { categoryName: 'Organic Waste', quantityKg: 10, actualQuantityKg: 12, status: 'Completed' },
    { categoryName: 'Organic Waste', quantityKg: 15, status: 'Assigned' },
    { categoryName: 'Plastic Waste', quantityKg: 5, actualQuantityKg: 6, status: 'Completed' }
  ]);

  assert.equal(result['Organic Waste'].totalRequests, 2);
  assert.equal(result['Organic Waste'].completedKg, 12);
  assert.equal(result['Organic Waste'].pendingKg, 15);
  assert.equal(result['Plastic Waste'].completedKg, 6);
});

test('findNextScheduledPickupForCollector prioritizes active status and schedule order', () => {
  const pickups = [
    {
      id: 'p-1',
      requestNumber: 'ECOTRACK-REQ-1001',
      assignedCollectorId: 'col-1',
      status: 'Assigned',
      scheduledDate: '2026-11-05',
      scheduledTimeSlot: '02:00 PM – 05:00 PM'
    },
    {
      id: 'p-2',
      requestNumber: 'ECOTRACK-REQ-1002',
      assignedCollectorId: 'col-1',
      status: 'In Progress',
      scheduledDate: '2026-11-05',
      scheduledTimeSlot: '09:00 AM – 12:00 PM'
    },
    {
      id: 'p-3',
      requestNumber: 'ECOTRACK-REQ-1003',
      assignedCollectorId: 'col-1',
      status: 'Completed',
      scheduledDate: '2026-11-04'
    }
  ];

  // In Progress takes precedence
  const next = findNextScheduledPickupForCollector('col-1', 'Rajesh', undefined, pickups);
  assert.equal(next?.requestNumber, 'ECOTRACK-REQ-1002');

  // Explicit activePickupId match
  const explicit = findNextScheduledPickupForCollector('col-1', 'Rajesh', 'ECOTRACK-REQ-1001', pickups);
  assert.equal(explicit?.requestNumber, 'ECOTRACK-REQ-1001');

  // No matching collector
  const unassigned = findNextScheduledPickupForCollector('col-99', 'Unknown', undefined, pickups);
  assert.equal(unassigned, undefined);
});

test('calculateHaversineDistanceKm calculates real-world distance accurately', () => {
  // Distance between Warangal Urban (17.9784, 79.5941) and Hanamkonda (18.0073, 79.5583) ~4.96 km
  const dist = calculateHaversineDistanceKm(17.9784, 79.5941, 18.0073, 79.5583);
  assert.equal(dist > 4.5 && dist < 5.5, true);

  // Same coordinates return 0
  assert.equal(calculateHaversineDistanceKm(17.9784, 79.5941, 17.9784, 79.5941), 0);
});

test('calculateEstimatedTransitMinutes computes ETA with city traffic buffer', () => {
  // 5 km at 25 km/h: 5/25*60 = 12 mins + 2 min buffer = 14 mins
  const eta = calculateEstimatedTransitMinutes(5, 25);
  assert.equal(eta, 14);

  // 0 distance returns minimum 1
  assert.equal(calculateEstimatedTransitMinutes(0), 1);
});

test('generateRealisticRouteWaypoints constructs multi-segment path', () => {
  const start: [number, number] = [17.9784, 79.5941];
  const end: [number, number] = [18.0073, 79.5583];
  const waypoints = generateRealisticRouteWaypoints(start, end);

  assert.equal(waypoints.length, 4);
  assert.deepEqual(waypoints[0], start);
  assert.deepEqual(waypoints[3], end);
  // Intermediate waypoints exist between start and end
  assert.equal(waypoints[1][0] > 17.9784 && waypoints[1][0] < 18.0073, true);
});

test('predictFutureWasteVolumes forecasts volume with confidence bands and scenarios', () => {
  const historical = [
    { day: 'Mon', collectedKg: 100 },
    { day: 'Tue', collectedKg: 120 },
    { day: 'Wed', collectedKg: 140 },
    { day: 'Thu', collectedKg: 130 },
    { day: 'Fri', collectedKg: 170 },
    { day: 'Sat', collectedKg: 210 },
    { day: 'Sun', collectedKg: 110 }
  ];

  const baseline = predictFutureWasteVolumes(historical, { forecastDays: 7, scenario: 'baseline' });

  // Timeline must have 7 historical + 7 forecast points = 14 points
  assert.equal(baseline.timeline.length, 14);

  // First 7 points are historical
  assert.equal(baseline.timeline[0].isForecast, false);
  assert.equal(baseline.timeline[0].actualKg, 100);
  assert.equal(baseline.timeline[0].predictedKg, null);

  // Transition point (last historical) connects both lines
  const transition = baseline.timeline[6];
  assert.equal(transition.actualKg, 110);
  assert.equal(transition.predictedKg, 110);

  // Future points have predicted values and valid confidence bounds
  const future1 = baseline.timeline[7];
  assert.equal(future1.isForecast, true);
  assert.equal(future1.actualKg, null);
  assert.equal(typeof future1.predictedKg === 'number' && future1.predictedKg > 0, true);
  assert.equal(typeof future1.confidenceLower === 'number', true);
  assert.equal(typeof future1.confidenceUpper === 'number', true);
  assert.equal(future1.confidenceUpper! > future1.predictedKg!, true);
  assert.equal(future1.confidenceLower! < future1.predictedKg!, true);

  // Check metrics
  assert.equal(baseline.totalHistoricalKg, 980);
  assert.equal(baseline.totalForecastKg > 500, true);
  assert.equal(baseline.recommendedTruckCount >= 1, true);
  assert.equal(baseline.rSquared > 0.5 && baseline.rSquared <= 1, true);

  // Test festival surge scenario increases volume
  const festival = predictFutureWasteVolumes(historical, { forecastDays: 7, scenario: 'festival_surge' });
  assert.equal(festival.totalForecastKg > baseline.totalForecastKg, true);

  // Test segregation drive scenario decreases volume
  const segregation = predictFutureWasteVolumes(historical, { forecastDays: 7, scenario: 'segregation_drive' });
  assert.equal(segregation.totalForecastKg < baseline.totalForecastKg, true);
});

test('filterPickupsByLocation properly filters by area and ward', () => {
  const sample = [
    { id: '1', area: 'Hanamkonda Central', ward: 'Ward 4' },
    { id: '2', area: 'Hanamkonda Central', ward: 'Ward 5' },
    { id: '3', area: 'Subedari', ward: 'Ward 7' },
    { id: '4', area: 'Warangal Urban', ward: 'Ward 1' }
  ];

  // All areas returns full list
  assert.equal(filterPickupsByLocation(sample, 'All Areas').length, 4);

  // Filter by Hanamkonda Central
  const hanamkonda = filterPickupsByLocation(sample, 'Hanamkonda Central');
  assert.equal(hanamkonda.length, 2);

  // Filter by Area + Ward
  const ward4 = filterPickupsByLocation(sample, 'Hanamkonda Central', 'Ward 4');
  assert.equal(ward4.length, 1);
  assert.equal(ward4[0].id, '1');

  // Non-matching area
  const empty = filterPickupsByLocation(sample, 'Unknown Zone');
  assert.equal(empty.length, 0);
});

test('filterSchedulesByLocation filters schedules properly', () => {
  const schedules = [
    { id: 's1', area: 'Subedari' },
    { id: 's2', area: 'Hanamkonda Central' }
  ];
  assert.equal(filterSchedulesByLocation(schedules, 'Subedari').length, 1);
  assert.equal(filterSchedulesByLocation(schedules, 'All Areas').length, 2);
  assert.equal(filterSchedulesByLocation(schedules, 'Kazipet Junction').length, 0);
});

test('parseBotActionBadges strips tags and creates interactive buttons', () => {
  const rawText = `Hello Vikram! Your pickup has been confirmed. [ACTION:TRACK:ECOTRACK-REQ-1003] You can also request another [ACTION:REQUEST_PICKUP] or change location [ACTION:CHANGE_LOCATION].`;
  const parsed = parseBotActionBadges(rawText);

  assert.equal(parsed.actions.length, 3);
  assert.equal(parsed.actions[0].type, 'TRACK');
  assert.equal(parsed.actions[0].payload, 'ECOTRACK-REQ-1003');
  assert.equal(parsed.actions[0].label, 'Track Pickup #ECOTRACK-REQ-1003');

  assert.equal(parsed.actions[1].type, 'REQUEST_PICKUP');
  assert.equal(parsed.actions[1].label, 'Schedule Pickup Request');

  assert.equal(parsed.actions[2].type, 'CHANGE_LOCATION');
  assert.equal(parsed.actions[2].label, 'Change Service Location');

  // Raw tags should be stripped from cleanedText
  assert.equal(parsed.cleanedText.includes('[ACTION:'), false);
  assert.equal(parsed.cleanedText.includes('Hello Vikram!'), true);
});

test('validateServiceAreaRequest checks required fields and formats', () => {
  const valid = validateServiceAreaRequest({
    stateName: 'Telangana',
    districtName: 'Medchal',
    cityName: 'Ghatkesar',
    areaName: 'Annojiguda',
    citizenName: 'Kavitha Rao',
    email: 'kavitha@example.com',
    phone: '+91 98480 12345'
  });
  assert.equal(valid.valid, true);
  assert.equal(valid.errors.length, 0);

  const invalid = validateServiceAreaRequest({
    stateName: '',
    districtName: '',
    cityName: '',
    areaName: '',
    citizenName: '',
    email: 'invalid-email',
    phone: 'abc'
  });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.errors.length >= 5, true);
});

test('matchNearestSupportedArea matches coordinates within threshold', () => {
  const known = [
    { id: '1', name: 'Hanamkonda Central', latitude: 18.0125, longitude: 79.5512 },
    { id: '2', name: 'Warangal Urban', latitude: 17.9785, longitude: 79.5942 }
  ];

  // Close to Hanamkonda Central (~1km away)
  const match = matchNearestSupportedArea({ latitude: 18.015, longitude: 79.553 }, known, 25);
  assert.notEqual(match, null);
  assert.equal(match?.matchedArea.name, 'Hanamkonda Central');
  assert.equal(match?.distanceKm! < 2, true);

  // Far away (Hyderabad ~140km away) -> outside 25km radius
  const noMatch = matchNearestSupportedArea({ latitude: 17.385, longitude: 78.4867 }, known, 25);
  assert.equal(noMatch, null);
});

test('role-based access control restricts screens and routes to role default', () => {
  assert.equal(getDefaultScreenForRole('admin'), 'admin-dashboard');
  assert.equal(getDefaultScreenForRole('supervisor'), 'supervisor-dashboard');
  assert.equal(getDefaultScreenForRole('collector'), 'collector-dashboard');
  assert.equal(getDefaultScreenForRole('citizen'), 'citizen-dashboard');

  // Citizen cannot access admin or supervisor screens
  assert.equal(isScreenAllowedForRole('citizen', 'admin-dashboard'), false);
  assert.equal(isScreenAllowedForRole('citizen', 'users-management'), false);
  assert.equal(isScreenAllowedForRole('citizen', 'supervisor-dashboard'), false);
  assert.equal(isScreenAllowedForRole('citizen', 'citizen-dashboard'), true);
  assert.equal(resolveAccessibleScreen('citizen', 'admin-dashboard'), 'citizen-dashboard');

  // Collector cannot access user management or citizen households
  assert.equal(isScreenAllowedForRole('collector', 'users-management'), false);
  assert.equal(isScreenAllowedForRole('collector', 'households'), false);
  assert.equal(isScreenAllowedForRole('collector', 'collector-dashboard'), true);
  assert.equal(resolveAccessibleScreen('collector', 'users-management'), 'collector-dashboard');

  // Supervisor can review pickups & reports, but not manage admin user directory
  assert.equal(isScreenAllowedForRole('supervisor', 'reports'), true);
  assert.equal(isScreenAllowedForRole('supervisor', 'users-management'), false);
  assert.equal(resolveAccessibleScreen('supervisor', 'users-management'), 'supervisor-dashboard');
});

test('scopePickupsForUser scopes pickups strictly for citizens and collectors', () => {
  const sample = [
    { id: 'p1', citizenId: 'cit-1', assignedCollectorId: 'col-1' },
    { id: 'p2', citizenId: 'cit-2', assignedCollectorId: 'col-1' },
    { id: 'p3', citizenId: 'cit-1', assignedCollectorId: 'col-2' }
  ];

  assert.equal(scopePickupsForUser(sample, { id: 'cit-1', role: 'citizen' }).length, 2);
  assert.equal(scopePickupsForUser(sample, { id: 'col-1', role: 'collector' }).length, 2);
  assert.equal(scopePickupsForUser(sample, { id: 'sup-1', role: 'supervisor' }).length, 3);
  assert.equal(scopePickupsForUser(sample, { id: 'adm-1', role: 'admin' }).length, 3);
  assert.equal(scopePickupsForUser(sample, null).length, 0);
});

test('verifyRoleLoginCredentials enforces unique Admin credentials and role matching', () => {
  const adminUser = { id: 'usr-admin-1', email: 'admin@ecotrack.org', role: 'admin' as const, active: true };
  const citizenUser = { id: 'usr-cit-1', email: 'vikram.m@gmail.com', role: 'citizen' as const, active: true };

  // Old generic Admin@1234 must be rejected for Admin login
  const genericAttempt = verifyRoleLoginCredentials({
    email: 'admin@ecotrack.org',
    password: 'Admin@1234',
    requestedRole: 'admin',
    matchedUser: adminUser,
    adminEmail: 'admin@ecotrack.org',
    adminPassword: 'UniqueSecret#2026'
  });
  assert.equal(genericAttempt.valid, false);
  assert.equal(genericAttempt.status, 401);

  // Empty password rejected
  const emptyPass = verifyRoleLoginCredentials({
    email: 'admin@ecotrack.org',
    password: '',
    requestedRole: 'admin',
    matchedUser: adminUser,
    adminEmail: 'admin@ecotrack.org',
    adminPassword: 'UniqueSecret#2026'
  });
  assert.equal(emptyPass.valid, false);
  assert.equal(emptyPass.status, 400);

  // Valid unique Admin credentials succeed
  const validAdmin = verifyRoleLoginCredentials({
    email: 'admin@ecotrack.org',
    password: 'UniqueSecret#2026',
    requestedRole: 'admin',
    matchedUser: adminUser,
    adminEmail: 'admin@ecotrack.org',
    adminPassword: 'UniqueSecret#2026'
  });
  assert.equal(validAdmin.valid, true);

  // Wrong role selected fails with 403
  const roleMismatch = verifyRoleLoginCredentials({
    email: 'admin@ecotrack.org',
    password: 'UniqueSecret#2026',
    requestedRole: 'citizen',
    matchedUser: adminUser,
    adminEmail: 'admin@ecotrack.org',
    adminPassword: 'UniqueSecret#2026'
  });
  assert.equal(roleMismatch.valid, false);
  assert.equal(roleMismatch.status, 403);

  // Registered citizen password verification
  assert.equal(
    verifyRoleLoginCredentials({
      email: 'vikram.m@gmail.com',
      password: 'Citizen@1234',
      requestedRole: 'citizen',
      matchedUser: citizenUser,
      adminEmail: 'admin@ecotrack.org',
      adminPassword: 'UniqueSecret#2026'
    }).valid,
    true
  );

  assert.equal(
    verifyRoleLoginCredentials({
      email: 'new.citizen@example.com',
      password: 'CustomPass!99',
      requestedRole: 'citizen',
      matchedUser: { id: 'usr-cit-9', email: 'new.citizen@example.com', role: 'citizen', active: true },
      registeredPassword: 'CustomPass!99',
      adminEmail: 'admin@ecotrack.com',
      adminPassword: 'Admin123435'
    }).valid,
    true
  );

  // Per-account credentials (Collector1 & Collector2)
  assert.equal(
    verifyRoleLoginCredentials({
      identifier: 'Collector1@ecotrack.com',
      password: 'Collector@1',
      requestedRole: 'collector',
      matchedUser: { id: 'usr-col-1', email: 'Collector1@ecotrack.com', username: 'Collector1@ecotrack.com', role: 'collector', active: true },
      accountPassword: 'Collector@1',
      adminEmail: 'admin@ecotrack.com',
      adminPassword: 'Admin123435'
    }).valid,
    true
  );

  assert.equal(
    verifyRoleLoginCredentials({
      identifier: 'collector2@ecotrack.com',
      password: 'Collector@1',
      requestedRole: 'collector',
      matchedUser: { id: 'usr-col-2', email: 'collector2@ecotrack.com', username: 'collector2@ecotrack.com', role: 'collector', active: true },
      accountPassword: 'Collector@2',
      adminEmail: 'admin@ecotrack.com',
      adminPassword: 'Admin123435'
    }).valid,
    false
  );
  // Common login page resolves role automatically without requestedRole
  assert.equal(
    verifyRoleLoginCredentials({
      identifier: 'admin@ecotrack.com',
      password: 'Admin123435',
      matchedUser: adminUser,
      adminEmail: 'admin@ecotrack.com',
      adminPassword: 'Admin123435'
    }).valid,
    true
  );
});

test('parseAuthRoute and getAuthRouteForView use common login and signup-only routes', () => {
  assert.deepEqual(parseAuthRoute('/'), { view: 'common-login' });
  assert.deepEqual(parseAuthRoute('/login'), { view: 'common-login' });
  assert.deepEqual(parseAuthRoute('/login/admin'), { view: 'common-login' });
  assert.deepEqual(parseAuthRoute('/login/supervisor'), { view: 'common-login' });
  assert.deepEqual(parseAuthRoute('/signup'), { view: 'citizen-signup' });
  assert.deepEqual(parseAuthRoute('/signup/supervisor'), { view: 'supervisor-signup' });
  assert.deepEqual(parseAuthRoute('/signup/collector'), { view: 'collector-signup' });

  assert.equal(getAuthRouteForView('common-login'), '/');
  assert.equal(getAuthRouteForView('citizen-signup'), '/signup');
  assert.equal(getAuthRouteForView('supervisor-signup'), '/signup/supervisor');
  assert.equal(getAuthRouteForView('collector-signup'), '/signup/collector');
});

test('generateContainerTagId and buildContainerQrPayload create canonical container labels', () => {
  assert.equal(generateContainerTagId('ECOTRACK-REQ-1011', 'Organic Waste'), 'BIN-1011-ORG');
  assert.equal(generateContainerTagId('ECOTRACK-REQ-1003', 'Electronic Waste'), 'BIN-1003-ELE');
  assert.equal(
    buildContainerQrPayload({ requestNumber: 'ECOTRACK-REQ-1011', categoryName: 'Organic Waste' }),
    'ECOTRACK:BIN:ECOTRACK-REQ-1011:BIN-1011-ORG'
  );
});

test('parseContainerQrPayload supports structured, JSON, and direct label codes', () => {
  const structured = parseContainerQrPayload('ECOTRACK:BIN:ECOTRACK-REQ-1011:BIN-1011-ORG');
  assert.equal(structured.valid, true);
  assert.equal(structured.requestNumber, 'ECOTRACK-REQ-1011');
  assert.equal(structured.containerTagId, 'BIN-1011-ORG');

  const jsonPayload = parseContainerQrPayload(
    JSON.stringify({ app: 'ECOTRACK', requestNumber: 'ECOTRACK-REQ-1003', containerTagId: 'BIN-1003-ELE' })
  );
  assert.equal(jsonPayload.valid, true);
  assert.equal(jsonPayload.requestNumber, 'ECOTRACK-REQ-1003');
  assert.equal(jsonPayload.containerTagId, 'BIN-1003-ELE');

  const tagOnly = parseContainerQrPayload('bin-1011-org');
  assert.equal(tagOnly.valid, true);
  assert.equal(tagOnly.containerTagId, 'BIN-1011-ORG');

  const reqOnly = parseContainerQrPayload('ecotrack-req-1012');
  assert.equal(reqOnly.valid, true);
  assert.equal(reqOnly.requestNumber, 'ECOTRACK-REQ-1012');

  const invalid = parseContainerQrPayload('RANDOM-GARBAGE-999');
  assert.equal(invalid.valid, false);
});

test('resolvePickupFromQrScan enforces ownership, active status, and expected container', () => {
  const samplePickups = [
    {
      id: 'req-1011',
      requestNumber: 'ECOTRACK-REQ-1011',
      categoryName: 'Organic Waste',
      containerTagId: 'BIN-1011-ORG',
      assignedCollectorId: 'usr-col-1',
      assignedCollectorName: 'Rajesh Kumar',
      status: 'In Progress' as const
    },
    {
      id: 'req-1012',
      requestNumber: 'ECOTRACK-REQ-1012',
      categoryName: 'Recyclable Waste',
      containerTagId: 'BIN-1012-REC',
      assignedCollectorId: 'usr-col-1',
      assignedCollectorName: 'Rajesh Kumar',
      status: 'Assigned' as const
    },
    {
      id: 'req-1001',
      requestNumber: 'ECOTRACK-REQ-1001',
      categoryName: 'Organic Waste',
      containerTagId: 'BIN-1001-ORG',
      assignedCollectorId: 'usr-col-1',
      assignedCollectorName: 'Rajesh Kumar',
      status: 'Completed' as const
    },
    {
      id: 'req-1003',
      requestNumber: 'ECOTRACK-REQ-1003',
      categoryName: 'Electronic Waste',
      containerTagId: 'BIN-1003-ELE',
      assignedCollectorId: 'usr-col-2',
      assignedCollectorName: 'Suresh Babu',
      status: 'In Progress' as const
    }
  ];

  // Valid scan of In Progress container
  const ok1 = resolvePickupFromQrScan('ECOTRACK:BIN:ECOTRACK-REQ-1011:BIN-1011-ORG', samplePickups, 'usr-col-1');
  assert.equal(ok1.matched, true);
  assert.equal(ok1.pickup?.id, 'req-1011');
  assert.equal(ok1.containerTagId, 'BIN-1011-ORG');

  // Valid direct tag scan of Assigned container (quick verification)
  const ok2 = resolvePickupFromQrScan('BIN-1012-REC', samplePickups, 'usr-col-1');
  assert.equal(ok2.matched, true);
  assert.equal(ok2.pickup?.id, 'req-1012');

  // Reject another collector's container
  const wrongCollector = resolvePickupFromQrScan('ECOTRACK:BIN:ECOTRACK-REQ-1003:BIN-1003-ELE', samplePickups, 'usr-col-1');
  assert.equal(wrongCollector.matched, false);
  assert.match(wrongCollector.error || '', /assigned to Suresh Babu/i);

  // Reject already completed container
  const alreadyCompleted = resolvePickupFromQrScan('BIN-1001-ORG', samplePickups, 'usr-col-1');
  assert.equal(alreadyCompleted.matched, false);
  assert.match(alreadyCompleted.error || '', /already been verified and completed/i);

  // Reject container mismatch when scanning for a specific expected pickup
  const mismatchedTarget = resolvePickupFromQrScan('BIN-1012-REC', samplePickups, 'usr-col-1', 'req-1011');
  assert.equal(mismatchedTarget.matched, false);
  assert.match(mismatchedTarget.error || '', /not the selected pickup container/i);
});

test('buildAutoQrCompletionPayload constructs valid payload for automatic QR completion', () => {
  const payload = buildAutoQrCompletionPayload(
    {
      requestNumber: 'ECOTRACK-REQ-1011',
      categoryName: 'Organic Waste',
      containerTagId: 'BIN-1011-ORG',
      quantityKg: 8.5
    },
    'ECOTRACK:BIN:ECOTRACK-REQ-1011:BIN-1011-ORG'
  );
  assert.equal(payload.scannedCode, 'ECOTRACK:BIN:ECOTRACK-REQ-1011:BIN-1011-ORG');
  assert.equal(payload.actualQuantityKg, 8.5);
  assert.match(payload.completionRemarks, /BIN-1011-ORG/);

  const fallbackPayload = buildAutoQrCompletionPayload(
    {
      requestNumber: 'ECOTRACK-REQ-1025',
      categoryName: 'Plastic Waste',
      quantityKg: 0
    },
    'ECOTRACK-REQ-1025'
  );
  assert.equal(fallbackPayload.actualQuantityKg, 10);
  assert.match(fallbackPayload.completionRemarks, /BIN-1025-PLA/);
});

test('isValidCoordinates and formatCoordinates validate geographic bounds safely', () => {
  assert.equal(isValidCoordinates(17.9784, 79.5941), true);
  assert.equal(isValidCoordinates(-90, 180), true);
  assert.equal(isValidCoordinates(0, 0), false);
  assert.equal(isValidCoordinates(95, 79.5), false);
  assert.equal(isValidCoordinates(18, -190), false);
  assert.equal(isValidCoordinates(NaN, 79.5), false);
  assert.equal(isValidCoordinates(undefined, undefined), false);

  assert.equal(formatCoordinates(17.9784123, 79.594189), '17.97841, 79.59419');
  assert.deepEqual(getAreaCenterCoordinates('Hanamkonda Central'), [18.0073, 79.5583]);
  assert.deepEqual(getAreaCenterCoordinates('Nonexistent Zone'), [17.9784, 79.5941]);
});

test('resolvePickupCoordinates prioritizes exact pickup pin over household and area fallback', () => {
  const households = [
    { id: 'hh-1', latitude: 17.98111, longitude: 79.59666 },
    { id: 'hh-2' }
  ];

  // 1. Exact per-pickup pin takes precedence over household coordinates
  const exactPickup = resolvePickupCoordinates(
    { id: 'req-1', area: 'Warangal Urban', householdId: 'hh-1', latitude: 17.98222, longitude: 79.59777 },
    households,
    0
  );
  assert.equal(exactPickup.isExactPin, true);
  assert.equal(exactPickup.source, 'pickup');
  assert.deepEqual(exactPickup.coords, [17.98222, 79.59777]);

  // 2. Falls back to household exact pin when pickup lacks direct coords
  const hhFallback = resolvePickupCoordinates(
    { id: 'req-2', area: 'Warangal Urban', householdId: 'hh-1' },
    households,
    0
  );
  assert.equal(hhFallback.isExactPin, true);
  assert.equal(hhFallback.source, 'household');
  assert.deepEqual(hhFallback.coords, [17.98111, 79.59666]);

  // 3. Deterministic area estimate when neither pickup nor household has pinned coords
  const areaFallback = resolvePickupCoordinates(
    { id: 'req-3', area: 'Subedari', householdId: 'hh-2' },
    households,
    0
  );
  assert.equal(areaFallback.isExactPin, false);
  assert.equal(areaFallback.source, 'area');
  assert.equal(isValidCoordinates(areaFallback.coords[0], areaFallback.coords[1]), true);
});

test('buildQrSuccessFeedbackData formats verified pickup details for visual overlay', () => {
  const feedback = buildQrSuccessFeedbackData(
    {
      id: 'req-1011',
      requestNumber: 'ECOTRACK-REQ-1011',
      containerTagId: 'bin-1011-org',
      citizenName: 'Vikram Malhotra',
      categoryName: 'Organic Waste',
      actualQuantityKg: 8.54,
      quantityKg: 8
    },
    1700000000000
  );

  assert.equal(feedback.id, 'qr-success-req-1011-1700000000000');
  assert.equal(feedback.containerTagId, 'BIN-1011-ORG');
  assert.equal(feedback.citizenName, 'Vikram Malhotra');
  assert.equal(feedback.actualQuantityKg, 8.5);
  assert.equal(feedback.requestNumber, 'ECOTRACK-REQ-1011');

  const fallback = buildQrSuccessFeedbackData(
    {
      id: 'req-1020',
      requestNumber: 'ECOTRACK-REQ-1020',
      categoryName: 'Plastic Waste',
      quantityKg: 12
    },
    1700000000001
  );
  assert.equal(fallback.containerTagId, 'BIN-1020-PLA');
  assert.equal(fallback.citizenName, 'Resident');
  assert.equal(fallback.actualQuantityKg, 12);
});

test('decodeGooglePolyline decodes standard encoded polyline strings accurately', () => {
  const decoded = decodeGooglePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
  assert.equal(decoded.length, 3);
  assert.ok(Math.abs(decoded[0][0] - 38.5) < 0.001);
  assert.ok(Math.abs(decoded[0][1] - -120.2) < 0.001);
  assert.ok(Math.abs(decoded[1][0] - 40.7) < 0.001);
  assert.ok(Math.abs(decoded[2][1] - -126.453) < 0.001);
  assert.deepEqual(decodeGooglePolyline(''), []);
});

test('optimizePendingPickupsLocally orders nearest pending stops in service area', () => {
  const origin = { latitude: 17.9792, longitude: 79.5935 };
  const stops = [
    {
      id: 'far',
      requestNumber: 'ECOTRACK-REQ-2001',
      citizenName: 'Far Citizen',
      address: 'Far Road',
      area: 'Warangal Urban',
      ward: 'Ward 2',
      categoryName: 'Recyclable Waste',
      quantityKg: 15,
      status: 'Assigned' as const,
      latitude: 18.010,
      longitude: 79.620,
      isExactPin: true
    },
    {
      id: 'near',
      requestNumber: 'ECOTRACK-REQ-2002',
      citizenName: 'Near Citizen',
      address: 'Near Street',
      area: 'Warangal Urban',
      ward: 'Ward 1',
      categoryName: 'Organic Waste',
      quantityKg: 10,
      status: 'Assigned' as const,
      latitude: 17.981,
      longitude: 79.595,
      isExactPin: true
    }
  ];

  const result = optimizePendingPickupsLocally(origin, stops, 'Warangal Urban', true);
  assert.equal(result.totalStops, 2);
  assert.equal(result.stops[0].id, 'near');
  assert.equal(result.stops[0].stopOrder, 1);
  assert.equal(result.stops[1].id, 'far');
  assert.equal(result.stops[1].stopOrder, 2);
  assert.ok(result.totalDistanceKm > 0);
  assert.ok(result.totalDurationMin > 0);
  assert.ok(result.polylinePath.length >= 2);
});

test('parseGoogleComputeRoutesResponse reorders intermediates using optimizedIntermediateWaypointIndex', () => {
  const origin = { latitude: 17.9792, longitude: 79.5935 };
  const stopA = {
    id: 'a',
    requestNumber: 'ECOTRACK-REQ-1',
    citizenName: 'A',
    address: 'Addr A',
    area: 'Warangal Urban',
    ward: 'Ward 1',
    categoryName: 'Organic Waste',
    quantityKg: 5,
    status: 'Assigned' as const,
    latitude: 17.99,
    longitude: 79.60,
    isExactPin: true
  };
  const stopB = {
    id: 'b',
    requestNumber: 'ECOTRACK-REQ-2',
    citizenName: 'B',
    address: 'Addr B',
    area: 'Warangal Urban',
    ward: 'Ward 2',
    categoryName: 'Plastic Waste',
    quantityKg: 8,
    status: 'Assigned' as const,
    latitude: 17.981,
    longitude: 79.594,
    isExactPin: true
  };
  const destC = {
    id: 'c',
    requestNumber: 'ECOTRACK-REQ-3',
    citizenName: 'C',
    address: 'Addr C',
    area: 'Warangal Urban',
    ward: 'Ward 2',
    categoryName: 'General Waste',
    quantityKg: 12,
    status: 'Approved' as const,
    latitude: 18.005,
    longitude: 79.615,
    isExactPin: true
  };

  const parsed = parseGoogleComputeRoutesResponse(
    {
      routes: [
        {
          distanceMeters: 4200,
          duration: '600s',
          optimizedIntermediateWaypointIndex: [1, 0],
          polyline: { encodedPolyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@' },
          legs: [
            { distanceMeters: 800, duration: '120s', steps: [{ navigationInstruction: { instructions: 'Turn left' } }] },
            { distanceMeters: 1400, duration: '180s' },
            { distanceMeters: 2000, duration: '300s' }
          ]
        }
      ]
    },
    origin,
    [stopA, stopB],
    destC,
    'Warangal Urban'
  );

  assert.ok(parsed);
  assert.equal(parsed!.provider, 'google-routes-api');
  assert.equal(parsed!.stops.length, 3);
  assert.equal(parsed!.stops[0].id, 'b');
  assert.equal(parsed!.stops[1].id, 'a');
  assert.equal(parsed!.stops[2].id, 'c');
  assert.equal(parsed!.stops[0].nextInstruction, 'Turn left');
  assert.equal(parsed!.totalDistanceKm, 4.2);
  assert.equal(parsed!.totalDurationMin, 10);
});

test('isProperlySegregatedPickup distinguishes sorted streams, explicit overrides, and general waste', () => {
  assert.equal(
    isProperlySegregatedPickup({ id: 'p1', categoryId: 'cat-organic', categoryName: 'Organic Waste', status: 'Completed' }),
    true
  );
  assert.equal(
    isProperlySegregatedPickup({ id: 'p2', categoryId: 'cat-general', categoryName: 'General Waste', status: 'Completed' }),
    false
  );
  assert.equal(
    isProperlySegregatedPickup({ id: 'p3', categoryId: 'cat-general', categoryName: 'General Waste', status: 'Completed', segregationVerified: true }),
    true
  );
  assert.equal(
    isProperlySegregatedPickup({ id: 'p4', categoryId: 'cat-recyclable', categoryName: 'Recyclable Waste', status: 'Completed', segregationVerified: false }),
    false
  );
  assert.equal(
    isProperlySegregatedPickup({ id: 'p5', categoryId: 'cat-recyclable', categoryName: 'Recyclable Waste', status: 'In Progress' }),
    false
  );
});

test('evaluateCitizenGamification handles empty state and unlocks Eco-Warrior and Recycling Pro badges accurately', () => {
  const emptySummary = evaluateCitizenGamification([]);
  assert.equal(emptySummary.ecoPoints, 0);
  assert.equal(emptySummary.level, 'Green Starter');
  assert.equal(emptySummary.earnedBadgesCount, 0);
  assert.equal(emptySummary.totalBadgesCount, 6);
  assert.equal(emptySummary.badges.every((b) => !b.earned && b.progressPercent === 0), true);
  assert.deepEqual(emptySummary.pointHistory, []);

  const summary = evaluateCitizenGamification([
    {
      id: 'req-1',
      requestNumber: 'ECOTRACK-REQ-1001',
      categoryId: 'cat-organic',
      categoryName: 'Organic Waste',
      actualQuantityKg: 16.5,
      status: 'Completed',
      segregationVerified: true,
      completedAt: '2026-11-01T08:15:00Z'
    },
    {
      id: 'req-2',
      requestNumber: 'ECOTRACK-REQ-1013',
      categoryId: 'cat-recyclable',
      categoryName: 'Recyclable Waste',
      actualQuantityKg: 12,
      status: 'Completed',
      qrVerified: true,
      segregationVerified: true,
      completedAt: '2026-10-24T10:20:00Z'
    },
    {
      id: 'req-3',
      requestNumber: 'ECOTRACK-REQ-1014',
      categoryId: 'cat-paper',
      categoryName: 'Paper Waste',
      actualQuantityKg: 9.5,
      status: 'Completed',
      segregationVerified: true,
      completedAt: '2026-10-18T11:05:00Z'
    },
    {
      id: 'req-4',
      requestNumber: 'ECOTRACK-REQ-1015',
      categoryId: 'cat-plastic',
      categoryName: 'Plastic Waste',
      actualQuantityKg: 7,
      status: 'Completed',
      qrVerified: true,
      segregationVerified: true,
      completedAt: '2026-10-11T08:40:00Z'
    },
    {
      id: 'req-5',
      requestNumber: 'ECOTRACK-REQ-1011',
      categoryId: 'cat-organic',
      categoryName: 'Organic Waste',
      quantityKg: 14,
      status: 'In Progress'
    }
  ]);

  assert.equal(summary.completedPickupsCount, 4);
  assert.equal(summary.segregatedPickupsCount, 4);
  assert.equal(summary.segregationRatePercent, 100);
  assert.equal(summary.recycledStreamCount, 3);
  assert.equal(summary.distinctSegregatedCategories, 4);
  assert.equal(summary.totalDivertedKg, 45);
  assert.equal(summary.ecoPoints, 270);
  assert.equal(summary.level, 'Community Eco-Warrior');
  assert.equal(summary.earnedBadgesCount, 4);

  const ecoWarrior = summary.badges.find((b) => b.id === 'eco-warrior');
  const recyclingPro = summary.badges.find((b) => b.id === 'recycling-pro');
  const streak = summary.badges.find((b) => b.id === 'consistent-contributor');
  const guardian = summary.badges.find((b) => b.id === 'zero-waste-guardian');

  assert.equal(ecoWarrior?.earned, true);
  assert.equal(recyclingPro?.earned, true);
  assert.equal(streak?.earned, false);
  assert.equal(streak?.progressCurrent, 4);
  assert.equal(streak?.progressTarget, 5);
  assert.equal(guardian?.earned, false);
  assert.equal(guardian?.progressCurrent, 45);
  assert.equal(guardian?.progressTarget, 50);

  // Point History ledger checks: 14 entries newest-first, exact sum === ecoPoints
  assert.equal(summary.pointHistory.length, 14);
  assert.equal(
    summary.pointHistory.reduce((acc, entry) => acc + entry.points, 0),
    summary.ecoPoints
  );
  assert.equal(summary.pointHistory[0].pickupId, 'req-1');
  assert.equal(summary.pointHistory[0].title, 'Pickup Completed');
  assert.equal(summary.pointHistory[0].points, 25);
  assert.equal(summary.pointHistory[1].title, 'Source Segregation Verified');
  assert.equal(summary.pointHistory[1].points, 15);
  assert.equal(summary.pointHistory[2].title, 'Waste Diverted (16.5 kg)');
  assert.equal(summary.pointHistory[2].points, 33);

  // Unsorted General Waste pickup awards base Pickup Completed (+25) only
  const unsortedSummary = evaluateCitizenGamification([
    {
      id: 'req-gen',
      requestNumber: 'ECOTRACK-REQ-2005',
      categoryId: 'cat-general',
      categoryName: 'General Waste',
      actualQuantityKg: 10,
      status: 'Completed',
      qrVerified: true,
      completedAt: '2026-11-02T09:00:00Z'
    }
  ]);
  assert.equal(unsortedSummary.ecoPoints, 25);
  assert.equal(unsortedSummary.pointHistory.length, 1);
  assert.equal(unsortedSummary.pointHistory[0].title, 'Pickup Completed');
  assert.equal(unsortedSummary.pointHistory[0].points, 25);
});

test('extractGoogleAccountEmail and formatGoogleAuthErrorMessage handle provider fallback and actionable errors', () => {
  assert.equal(
    extractGoogleAccountEmail('citizen@gmail.com', [{ email: 'alt@gmail.com' }]),
    'citizen@gmail.com'
  );
  assert.equal(
    extractGoogleAccountEmail(null, [null, { email: '  resident@gmail.com  ' }]),
    'resident@gmail.com'
  );
  assert.equal(extractGoogleAccountEmail(undefined, []), '');

  assert.match(
    formatGoogleAuthErrorMessage('auth/unauthorized-domain', '', 'ecotrack-three-omega.vercel.app', 'gen-lang-client-0500810440'),
    /ecotrack-three-omega\.vercel\.app.*gen-lang-client-0500810440/
  );
  assert.match(
    formatGoogleAuthErrorMessage('auth/popup-blocked'),
    /popup was blocked/i
  );
  assert.match(
    formatGoogleAuthErrorMessage('auth/popup-closed-by-user'),
    /cancelled before completing/i
  );
  assert.match(
    formatGoogleAuthErrorMessage('auth/operation-not-allowed'),
    /Enable the Google provider/i
  );
});





