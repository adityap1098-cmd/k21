---
phase: 03-pos-with-offline-mode
plan: 02
subsystem: pos-sale-service
tags: [pos, accounting, drizzle, atomic-transaction, pgbouncer]
dependency_graph:
  requires: [03-01]
  provides: [completeSale, syncOfflineTx, voidTransaction, createJournalEntryStub, createJournalEntryReversal]
  affects: [pos-router (03-03), offline-sync-endpoint (03-04)]
tech_stack:
  added: []
  patterns: [db.transaction atomic wrapping, SELECT FOR UPDATE row-level lock, DrizzleTx propagation, idempotency via clientUuid]
key_files:
  created:
    - apps/api/src/modules/accounting/accounting.service.ts
    - apps/api/src/modules/accounting/index.ts
    - apps/api/src/modules/pos/pos.service.ts
    - apps/api/src/modules/pos/index.ts
    - apps/api/src/modules/pos/pos.test.ts (rewritten to DB-layer mocks for GREEN)
  modified: []
decisions:
  - "completeSale uses recordMovement(params, tx) + manual UPDATE SQL — never decrementStock() which opens its own db.transaction() causing nested transaction error in PgBouncer TRANSACTION mode"
  - "DrizzleTx cast via (tx as unknown as typeof db) required because Drizzle's transaction callback type does not expose .insert/.select directly in its type signature"
  - "voidTransaction included in pos.service.ts (plan 03-02) rather than waiting for 03-03 — test stubs reference it and it shares the same atomic tx pattern"
  - "pos.test.ts rewritten from vi.mock-without-factory RED stubs to DB-layer mocks — auto-mock pattern cannot make tests go GREEN; shifted to mock db + mock dependencies approach matching shifts.test.ts pattern"
metrics:
  duration: 7 minutes
  completed_date: "2026-03-18"
  tasks_completed: 2
  files_created: 5
  files_modified: 1
---

# Phase 3 Plan 02: Atomic POS Sale Service Summary

**One-liner:** Atomic PostgreSQL transaction wrapping stock lock, movement record, journal stub, and all POS inserts via completeSale() with idempotent clientUuid and PgBouncer-safe DrizzleTx propagation.

## What Was Built

### Task 1: Accounting Stub Service (commit: 1b11fcb)

`apps/api/src/modules/accounting/accounting.service.ts`:
- `createJournalEntryStub({ transactionId, total, sourceType? }, tx)` — inserts `journal_entries` row with status `PENDING` inside caller's transaction; sourceType defaults to `POS_SALE`
- `createJournalEntryReversal({ transactionId, total }, tx)` — inserts reversal row with sourceType `VOID` and negative amount
- Both functions accept `DrizzleTx` and MUST NOT open `db.transaction()` — critical for PgBouncer TRANSACTION pool mode

### Task 2: POS Sale Service (commit: 4254efb)

`apps/api/src/modules/pos/pos.service.ts`:
- `completeSale(params: CompleteSaleParams): Promise<Transaction>` — single `db.transaction()` callback performing:
  1. Idempotency check via `clientUuid` UNIQUE — returns existing if found
  2. Shift validation (OPEN status required) — throws `SHIFT_NOT_OPEN`
  3. `SELECT FOR UPDATE` per item — throws `INSUFFICIENT_STOCK` before any inserts
  4. Insert transaction header, items (bulk), payments (bulk)
  5. `recordMovement(..., tx)` + `UPDATE stock_qty` per item
  6. `createJournalEntryStub(..., tx)` — all inside same tx
- `syncOfflineTx(params)` — catches `INSUFFICIENT_STOCK` → `{ status: 'conflict' }`, otherwise `{ status: 'synced', transactionId }`
- `getTransactionByClientUuid(clientUuid)` — lookup by idempotency key
- `voidTransaction({ transactionId, voidReason, performedBy })` — RETURN movements + stock restore + journal reversal in one tx; throws `ALREADY_VOIDED` guard

## Success Criteria Verification

- [x] `completeSale` is idempotent: duplicate `clientUuid` returns existing transaction without error
- [x] Stock decrement + movement record + journal entry are in one PostgreSQL transaction
- [x] `INSUFFICIENT_STOCK` thrown before any inserts when stock insufficient
- [x] No nested `db.transaction()` calls — `recordMovement` and `createJournalEntryStub` called with outer `tx`
- [x] No `decrementStock()` calls in pos.service.ts (verified via grep)
- [x] `pnpm --filter @k21/api test -- pos.test.ts` → 9/9 tests pass (GREEN)
- [x] TypeScript: zero errors in new service files

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] pos.test.ts RED stub pattern incompatible with GREEN goal**
- **Found during:** Task 2 implementation
- **Issue:** The plan referenced pos.test.ts as using `vi.mock('./pos.service.js')` without factory (RED state). This auto-mock pattern returns `vi.fn()` stubs that cannot be made to pass behavioral assertions. The plan required tests to go GREEN after implementation.
- **Fix:** Rewrote pos.test.ts to use DB-layer mocks (same pattern as shifts.test.ts) — mock `../../db/index.js`, `movement.service.js`, and `accounting.service.js`; test actual pos.service.ts implementation.
- **Files modified:** `apps/api/src/modules/pos/pos.test.ts`
- **Commit:** 4254efb

**2. [Rule 3 - Blocking prerequisite] Plan 03-01 artifacts missing**
- **Found during:** Pre-execution check
- **Issue:** `apps/api/src/db/schema/pos.ts`, `accounting.ts`, and migration SQL did not exist because 03-01 had not been executed.
- **Fix:** Executed plan 03-01 tasks inline as a blocking prerequisite — created schema files, migration SQL, and updated schema/index.ts.
- **Files modified/created:** `pos.ts`, `accounting.ts`, `schema/index.ts`, `drizzle/0002_pos_accounting_schema.sql`, `pos.test.ts`
- **Commits:** 166b825, 9608e0d

**3. [Rule 2 - Missing functionality] voidTransaction implemented in 03-02**
- **Found during:** Task 2 (pos.test.ts includes voidTransaction tests)
- **Issue:** The test stubs in pos.test.ts reference `voidTransaction` which was planned for 03-03 but was needed to make the test file complete and testable.
- **Fix:** Implemented `voidTransaction` in pos.service.ts alongside completeSale — same atomic tx pattern, no additional dependencies.
- **Files modified:** `apps/api/src/modules/pos/pos.service.ts`

## Self-Check: PASSED

All created files verified on disk. All task commits verified in git log.

| Check | Result |
|-------|--------|
| accounting.service.ts exists | FOUND |
| accounting/index.ts exists | FOUND |
| pos.service.ts exists | FOUND |
| pos/index.ts exists | FOUND |
| schema/pos.ts exists | FOUND |
| schema/accounting.ts exists | FOUND |
| commit 1b11fcb (accounting service) | FOUND |
| commit 4254efb (pos service) | FOUND |
