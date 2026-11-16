# EcoTrack Automated Testing Strategy
## Unit, Integration, and Regression Verification

---

## 1. Unit Testing with Node Built-in Test Runner
Unit tests verify decoupled business logic without browser overhead:
```bash
npx --yes tsx --test src/utils/ecoLogic.test.ts
```

### Coverage:
1. `calculateCompletionRate`: Formula `(completed / total) * 100`, zero-safe division.
2. `calculateAverageCompletionTimeMinutes`: Duration aggregation.
3. `checkSchedulingConflict`: Detects overlapping collector assignments on same date and time slot.
4. `isValidStatusTransition`: Enforces the 11-step pickup lifecycle state machine.
5. `generateRequestNumber`: Generates unique `ECOTRACK-REQ-1001` format.
6. `validatePickupRequest`: Validates required fields, limits (max 500kg).
7. `aggregateWasteByCategory`: Aggregates completed vs pending weights for reporting.

---

## 2. API Integration Testing
Endpoints tested via Supertest / HTTP curl:
- `POST /api/auth/login`
- `POST /api/pickups`
- `PATCH /api/pickups/:id/status`
- `POST /api/assignments`
- `GET /api/reports/collector-performance`
