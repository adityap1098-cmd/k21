---
phase: 03-pos-with-offline-mode
plan: 03
subsystem: shifts
tags: [shifts, reconciliation, pos, cashier, tdd]
dependency_graph:
  requires: [03-01]
  provides: [shifts-module]
  affects: [apps/api/src/index.ts]
tech_stack:
  added: []
  patterns: [tdd-red-green, drizzle-orm-aggregate, express-router-zod]
key_files:
  created:
    - apps/api/src/modules/shifts/shifts.test.ts
    - apps/api/src/modules/shifts/shifts.service.ts
    - apps/api/src/modules/shifts/shifts.router.ts
    - apps/api/src/modules/shifts/index.ts
  modified: []
decisions:
  - aggregateReconciliation extracted as internal helper to avoid redundant SELECT when called from closeShift; getShiftReconciliation queries the shift row first then delegates to the same helper
  - closeShift uses db.update().returning() to get the closed shift without a second SELECT, then passes it directly to aggregateReconciliation
  - SHIFT_NOT_FOUND thrown for both non-existent and wrong-cashier scenarios (single error covers both unauthorized and not-found for security)
metrics:
  duration: 357s
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_created: 4
  files_modified: 0
---

# Phase 3 Plan 3: Shifts Module Summary

**One-liner:** Shifts service with open/close/reconciliation (CASH+TRANSFER+QRIS aggregation) behind Cashier-role Express router.

## Tasks Completed

| # | Name | Commit | Key Files |
|---|------|--------|-----------|
| 1 (RED) | shifts.test.ts — failing test stubs | 9ca1662 | shifts.test.ts |
| 1 (GREEN) | shifts.service.ts — full implementation | 9608e0d (03-01) | shifts.service.ts |
| 2 | shifts.router.ts + index.ts | c5947df | shifts.router.ts, index.ts |

## What Was Built

### shifts.service.ts
Four exported functions:
- `openShift({ cashierId, openingFloat })`: Guards against duplicate OPEN shifts per cashier; inserts new shift row; returns shift.
- `closeShift({ shiftId, cashierId, closingCash })`: Updates shift to CLOSED via `db.update().returning()`; throws `SHIFT_NOT_FOUND` if no rows updated; calls `aggregateReconciliation` with the returned shift (no extra SELECT).
- `getActiveShift(cashierId)`: Returns OPEN shift or null.
- `getShiftReconciliation(shiftId)`: Fetches shift, then calls `aggregateReconciliation`.

Internal `aggregateReconciliation(shift)`: Queries `transaction_payments` joined to `transactions` (where `status = COMPLETED` and `shiftId` matches), groups by payment method, sums amounts. Computes: `expectedCash = openingFloat + salesByCash`, `discrepancy = actualCash - expectedCash`.

### shifts.router.ts
Three endpoints:
- `POST /open` — Cashier only; Zod validates `openingFloat` (int >= 0); 201 on success; 409 on `SHIFT_ALREADY_OPEN`
- `POST /close` — Cashier only; Zod validates `shiftId` (uuid) + `closingCash` (int >= 0); 200 with reconciliation; 404/409 on errors
- `GET /:id/reconciliation` — Cashier|Owner|Admin; 200 with reconciliation; 404 if not found

### shifts/index.ts
Barrel re-exports: `export * from './shifts.service.js'` + `export * from './shifts.router.js'`

## Test Results

```
✓ shifts.test.ts (8 tests) — all GREEN
  - openShift: creates OPEN shift, throws SHIFT_ALREADY_OPEN
  - closeShift: returns reconciliation, throws SHIFT_NOT_FOUND
  - getActiveShift: returns OPEN shift or null
  - getShiftReconciliation: aggregates all 3 payment methods, computes discrepancy correctly
```

All 79 tests across 13 test files pass (full test suite).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] closeShift caused redundant db.select in getShiftReconciliation**
- **Found during:** Task 1 GREEN (test failure: `limit is not a function`)
- **Issue:** `closeShift` called `getShiftReconciliation(shiftId)` which queries `db.select` for the shift row again, but the test mock's `db.select` chain was configured only for the payment aggregation query (no `.limit()` on the second chain).
- **Fix:** Extracted `aggregateReconciliation(shift: Shift)` as an internal helper. `closeShift` passes the already-retrieved shift from `.returning()`. `getShiftReconciliation` still does its own SELECT for the public API use case.
- **Files modified:** shifts.service.ts
- **Commit:** Included in c5947df (service was already committed by 03-01 execution)

## Self-Check: PASSED

All created files exist on disk:
- FOUND: apps/api/src/modules/shifts/shifts.service.ts
- FOUND: apps/api/src/modules/shifts/shifts.router.ts
- FOUND: apps/api/src/modules/shifts/index.ts
- FOUND: apps/api/src/modules/shifts/shifts.test.ts

All commits verified:
- 9ca1662: test(03-03): add failing RED-state tests for shifts service
- c5947df: feat(03-03): add shifts router and barrel index
