# EcoTrack REST API Specifications

All endpoints use standard JSON payloads and HTTP response status codes.

---

## 1. Authentication
- `POST /api/auth/login`
  - Body: `{ email, password }`
  - Returns: `{ token, user }`
- `POST /api/auth/register`
  - Body: `{ name, email, phone, password, address, area, ward, pincode }`
  - Returns: `{ token, user, household }`
- `GET /api/auth/me`
  - Header: `Authorization: Bearer <token>`
  - Returns: `{ user }`

---

## 2. Municipal Pickup Requests
- `GET /api/pickups`
  - Query parameters: `citizenId`, `collectorId`, `status`, `area`, `search`
  - Returns: `{ pickups: PickupRequest[], total: number }`
- `GET /api/pickups/:id`
  - Returns: `{ pickup: PickupRequest }`
- `POST /api/pickups`
  - Body: `{ citizenId, householdId, categoryId, quantityKg, preferredDate, preferredTimeSlot, specialInstructions, imageUrl }`
  - Returns: 201 `{ pickup: PickupRequest }`
- `PATCH /api/pickups/:id/status`
  - Body: `{ status, actualQuantityKg, completionRemarks, missedReason, missedRemarks, changedBy, changedByName }`
  - Returns: `{ pickup: PickupRequest }`

---

## 3. Operational Assignments
- `POST /api/assignments`
  - Body: `{ pickupId, collectorId, scheduledDate, scheduledTimeSlot, supervisorId }`
  - Validates: Collision detection against collector's active shifts.
  - Returns: 200 `{ pickup: PickupRequest }` (or 409 Conflict if overlapping)

---

## 4. Statutory Reports
- `GET /api/reports/collection-schedule` (Report 1)
- `GET /api/reports/pickup-requests` (Report 2)
- `GET /api/reports/area-wise-waste` (Report 3)
- `GET /api/reports/collector-performance` (Report 4)

---

## 5. Analytics & Health
- `GET /api/analytics/dashboard` (KPIs, daily trends, waste categories breakdown)
- `GET /api/health`
- `POST /api/gemini/maps-grounding` (Gemini 3.8 Flash facility guidance)
