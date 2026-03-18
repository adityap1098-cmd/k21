---
phase: 03-pos-with-offline-mode
plan: "01"
subsystem: database
tags: [drizzle-orm, postgres, schema, migration, vitest, tdd]

# Dependency graph
requires:
  - phase: 02-product-inventory
    provides: productVariants table (variantId referenced without FK from transactionItems — circular dep avoidance)

provides:
  - Drizzle schema for 4 POS tables: shifts, transactions, transactionItems, transactionPayments
  - Drizzle schema for accounting stub: journalEntries
  - TypeScript types inferred from all 5 tables
  - Migration SQL 0002_pos_accounting_schema.sql with 3 enums and 5 CREATE TABLE statements
  - RED-state test stubs for pos.service.js and shifts.service.js behaviors

affects:
  - 03-02 (pos.service.ts uses Transaction/Shift types from schema)
  - 03-03 (shifts.service.ts imports from schema/pos.js)
  - 03-04 (void and router layers depend on schema types)
  - Phase 07 (accounting module will formalize journalEntries FK)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "No FK on transactionItems.variantId — cross-schema circular dep avoidance; enforced at service layer"
    - "No FK on journalEntries.transactionId — Phase 7 will formalize; stub pattern"
    - "Migration SQL placed in apps/api/drizzle/ (not apps/api/migrations/) — aligns with drizzle-kit output directory"
    - "UNIQUE constraint on transactions.client_uuid — idempotency key for offline sync deduplication"

key-files:
  created:
    - apps/api/src/db/schema/pos.ts
    - apps/api/src/db/schema/accounting.ts
    - apps/api/drizzle/0002_pos_accounting_schema.sql
    - apps/api/src/modules/pos/pos.test.ts
    - apps/api/src/modules/shifts/shifts.test.ts
  modified:
    - apps/api/src/db/schema/index.ts

key-decisions:
  - "Migration placed in apps/api/drizzle/ (drizzle-kit output dir) not apps/api/migrations/ as written in plan — plan path did not exist; Rule 3 auto-fix"
  - "transactionItems.variantId has no FK to productVariants — avoids cross-schema circular dependency; enforced at service layer"
  - "journalEntries has no FK to transactions — Phase 7 accounting module will formalize; stub pattern"
  - "UNIQUE constraint on transactions.client_uuid embedded in CREATE TABLE DDL — serves as offline sync idempotency key"
  - "shiftStatusEnum, transactionStatusEnum, paymentMethodEnum all defined in pos.ts — single source of truth for POS domain enums"

patterns-established:
  - "No-FK stub pattern: uuid columns with no FK reference when cross-schema cycles are possible or when formalization deferred to later phase"
  - "RED-state tests: vi.mock without factory causes import-not-found failures proving test infrastructure works before service exists"

requirements-completed: [POS-01, POS-02, POS-03, POS-04, POS-05, POS-06, POS-07, POS-08, POS-09, POS-10, POS-11]

# Metrics
duration: 3min
completed: 2026-03-18
---

# Phase 3 Plan 01: POS + Accounting Schema Summary

**Drizzle ORM schema for 5 POS/accounting tables with 3 enum types, migration SQL 0002, and RED-state Vitest stubs for completeSale/voidTransaction/shifts behaviors**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-18T08:12:20Z
- **Completed:** 2026-03-18T08:15:41Z
- **Tasks:** 2 (both pre-committed in prior session)
- **Files modified:** 6

## Accomplishments

- Created `pos.ts` with 4 POS tables (shifts, transactions, transactionItems, transactionPayments) and 3 pgEnum types (shiftStatus, transactionStatus, paymentMethod)
- Created `accounting.ts` with journalEntries stub table (no FK — Phase 7 formalization pattern)
- Created `0002_pos_accounting_schema.sql` with IF NOT EXISTS DDL for all 5 tables and UNIQUE constraint on client_uuid
- Created `pos.test.ts` and `shifts.test.ts` with 16 RED-state test stubs (all fail because service modules do not exist)

## Task Commits

1. **Task 1: Drizzle schema — POS + accounting tables** - `166b825` (feat)
   - pos.ts, accounting.ts, index.ts update, 0002 migration SQL, pos.test.ts
2. **Task 2: RED-state test stubs for POS and Shifts modules** - `9ca1662` (test)
   - shifts.test.ts (committed as part of 03-03 preparation but covers 03-01 spec)

## Files Created/Modified

- `apps/api/src/db/schema/pos.ts` — 4 POS tables + 3 enums; all types exported
- `apps/api/src/db/schema/accounting.ts` — journalEntries stub table + inferred types
- `apps/api/src/db/schema/index.ts` — added `export * from './pos.js'` and `export * from './accounting.js'`
- `apps/api/drizzle/0002_pos_accounting_schema.sql` — CREATE TYPE + CREATE TABLE IF NOT EXISTS for all 5 tables; UNIQUE constraint on client_uuid
- `apps/api/src/modules/pos/pos.test.ts` — 8 RED-state stubs for completeSale, syncOfflineTx, voidTransaction
- `apps/api/src/modules/shifts/shifts.test.ts` — 8 RED-state stubs for openShift, closeShift, getActiveShift, getShiftReconciliation

## Decisions Made

- Migration file placed in `apps/api/drizzle/` (drizzle-kit convention) rather than `apps/api/migrations/` as the plan specified — the migrations directory does not exist and drizzle-kit generates into drizzle/. This is a Rule 3 auto-fix (blocking path deviation).
- `transactionItems.variantId` has no FK to `productVariants` to avoid cross-schema import cycles between pos.ts and inventory.ts (which imports products.ts). Referential integrity enforced at service layer.
- `journalEntries` has no FK to `transactions` — Phase 7 will formalize the accounting module. Stub pattern consistent with the project's phase-based deferred formalization approach.
- `UNIQUE` constraint on `transactions.client_uuid` embedded directly in CREATE TABLE DDL (not as a separate ALTER TABLE) — simplifies the migration and serves as the idempotency key for offline sync.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Migration placed in apps/api/drizzle/ not apps/api/migrations/**
- **Found during:** Task 1 (Drizzle schema creation)
- **Issue:** Plan specified `apps/api/migrations/0003_pos_schema.sql` but `apps/api/migrations/` does not exist in the repo; all existing migrations are in `apps/api/drizzle/`
- **Fix:** Created migration as `apps/api/drizzle/0002_pos_accounting_schema.sql` (next sequential number after 0001)
- **Files modified:** apps/api/drizzle/0002_pos_accounting_schema.sql
- **Verification:** File exists alongside 0000 and 0001 migration files in drizzle/ directory
- **Committed in:** 166b825

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking path)
**Impact on plan:** Path correction only; all schema content matches plan spec. No functional scope change.

## Issues Encountered

None — plan executed cleanly with one path correction.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All 5 POS/accounting Drizzle tables compile cleanly (zero tsc errors in schema files)
- TypeScript types available for import by plan 03-02 (pos.service.ts) and 03-03 (shifts.service.ts)
- Migration SQL 0002 ready for deployment alongside existing 0000 and 0001 migrations
- RED-state tests in pos.test.ts and shifts.test.ts will turn GREEN as plan 03-02 and 03-03 implement their services

---
*Phase: 03-pos-with-offline-mode*
*Completed: 2026-03-18*

## Self-Check: PASSED

All files found:
- FOUND: apps/api/src/db/schema/pos.ts
- FOUND: apps/api/src/db/schema/accounting.ts
- FOUND: apps/api/drizzle/0002_pos_accounting_schema.sql
- FOUND: apps/api/src/modules/pos/pos.test.ts
- FOUND: apps/api/src/modules/shifts/shifts.test.ts

All commits found:
- FOUND: 166b825 (feat(03-01): add POS + accounting Drizzle schema and RED test stubs)
- FOUND: 9ca1662 (test(03-03): add failing RED-state tests for shifts service)
