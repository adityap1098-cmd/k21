---
phase: 02-product-inventory
plan: "05"
subsystem: inventory-complete
tags: [inventory, opname, bullmq, notifications, express-router, tdd]
dependency_graph:
  requires:
    - 02-04  # movement.service, stock.service, reservation.service
    - 02-01  # lowstock.queue, bullmqRedis
    - 02-02  # notifications schema, users schema
  provides:
    - runStockOpname (physical count reconciliation via ADJUSTMENT in single db.transaction)
    - processLowStockAlert (bulk-insert LOW_STOCK notifications for Owner/Admin users)
    - inventoryRouter (Express Router: /stock/:variantId, /opname, /movements, /reservations/:variantId)
  affects:
    - 03-pos  # inventoryRouter to be mounted in app.ts; decrementStock tested by POS
    - app.ts  # inventoryRouter ready to mount at /api/v1/inventory
tech_stack:
  added: []
  patterns:
    - TDD RED→GREEN: INV-08 test stubs replaced with real assertions before implementation
    - Single db.transaction for full opname batch (SELECT FOR UPDATE per item + ADJUSTMENT insert + UPDATE stock_qty)
    - BullMQ worker delegates to extracted processLowStockAlert for testability
    - Drizzle inArray() + and() for multi-condition Owner/Admin filter
    - inventoryRouter uses Zod body validation + role guard middleware
key_files:
  created:
    - apps/api/src/modules/inventory/lowstock.service.ts
    - apps/api/src/modules/inventory/inventory.router.ts
  modified:
    - apps/api/src/modules/inventory/opname.service.ts
    - apps/api/src/modules/inventory/index.ts
    - apps/api/src/queues/lowstock.queue.ts
    - apps/api/src/modules/inventory/inventory.test.ts
decisions:
  - "opname.service.ts signature changed from (counts, performedBy, approvedBy) to object param {items, performedBy, ipAddress} — matches plan 02-05 spec and test call sites"
  - "processLowStockAlert extracted to lowstock.service.ts — BullMQ worker calls it; enables unit testing without BullMQ connection"
  - "ADJUSTMENT direction for POST /movements: positive qty always increments (manual API route); opname uses explicit UPDATE to set physicalCount authoritative value"
metrics:
  duration: "4 minutes"
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_changed: 6
---

# Phase 02 Plan 05: Inventory Complete (Opname + Low-Stock + Router) Summary

**One-liner:** Stock opname reconciliation using db.transaction FOR UPDATE, extracted processLowStockAlert BullMQ handler, and Express inventory router — completing all 11 Phase 2 inventory requirements.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement opname service and low-stock worker handler | 2bd3b24 | opname.service.ts, lowstock.service.ts, lowstock.queue.ts, inventory.test.ts |
| 2 | Create inventory router and update index barrel | 20cff4c | inventory.router.ts, index.ts |

## What Was Built

### opname.service.ts (rewritten)

`runStockOpname({ items, performedBy, ipAddress })` — runs all items inside a single `db.transaction`. Per item: `tx.execute(sql\`SELECT ... FOR UPDATE\`)` acquires row-level lock, computes `discrepancy = physicalCount - stock_qty`. If discrepancy != 0: calls `recordMovement(tx, ADJUSTMENT)` with `qty = Math.abs(discrepancy)`, then `tx.execute(sql\`UPDATE ... SET stock_qty = physicalCount\`)` to set authoritative value. Zero-discrepancy items skipped. After transaction: `invalidateStockCache` for each adjusted variant. Returns `{ adjustments, opnameId }`.

### lowstock.service.ts (new)

`processLowStockAlert({ variantId, currentStock })` — queries `users` table with `and(inArray(users.role, ['Owner', 'Admin']), eq(users.isActive, true))`. Bulk-inserts one `LOW_STOCK` notification per recipient. Returns count of notifications created.

### lowstock.queue.ts (updated)

`createLowStockWorker()` — BullMQ Worker that calls `processLowStockAlert` for each job. Replaces the previous inline stub that only logged.

### inventory.router.ts (new)

Express Router with four routes:
- `GET /stock/:variantId` — `authenticate` → `getStockCached` → `{ variantId, stockQty }`
- `POST /opname` — `authenticate + requireRole(Admin, Owner, Warehouse Staff)` → Zod validation → `runStockOpname` → `{ adjustments, opnameId }`
- `POST /movements` — `authenticate + requireRole(Admin, Owner, Warehouse Staff)` → Zod validation → `recordMovement` + `UPDATE stock_qty` in single transaction
- `GET /reservations/:variantId` — `authenticate + requireRole(Admin, Owner, Warehouse Staff)` → `getActiveReservedQty` → `{ variantId, reservedQty }`

Error mapping: `INSUFFICIENT_STOCK` → 409, `REASON_REQUIRED` → 400, `APPROVER_REQUIRED` → 400, `VARIANT_NOT_FOUND` → 404.

### index.ts (updated)

Barrel now exports all 5 services plus `inventoryRouter`.

## Verification Results

- `pnpm --filter @k21/api test -- src/modules/inventory/inventory.test.ts` — 21 tests PASS (INV-01 through INV-08, all GREEN)
- `pnpm --filter @k21/api test` — 59/59 tests pass, no regressions
- `pnpm --filter @k21/api typecheck` — zero errors in new inventory files (pre-existing errors in other modules are out of scope)

## Deviations from Plan

### Auto-fixed Issues

None beyond the signature change for `runStockOpname`, which was the plan's intended spec.

**Note:** The plan shows `runStockOpname` with new object-param signature. The existing opname.service.ts from plan 02-04 used positional params. This plan rewrote it with the new signature — this was the intended work, not a deviation.

## Self-Check: PASSED

- FOUND: apps/api/src/modules/inventory/lowstock.service.ts
- FOUND: apps/api/src/modules/inventory/inventory.router.ts
- FOUND: apps/api/src/modules/inventory/opname.service.ts (rewritten)
- FOUND: apps/api/src/modules/inventory/index.ts (updated)
- FOUND: task1 commit 2bd3b24
- FOUND: task2 commit 20cff4c
