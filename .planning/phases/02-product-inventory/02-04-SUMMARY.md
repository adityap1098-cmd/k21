---
phase: 02-product-inventory
plan: "04"
subsystem: inventory-core
tags: [inventory, redis, bullmq, drizzle, concurrency, select-for-update, reservations]
dependency_graph:
  requires:
    - 02-01  # queues/redis.ts (cacheRedisClient), lowstock.queue.ts
    - 02-02  # inventoryMovements, stockReservations, productVariants schema
  provides:
    - getStockCached / invalidateStockCache (Redis-backed stock reads)
    - recordMovement (append-only inventory_movements)
    - decrementStock (SELECT FOR UPDATE concurrency-safe decrement)
    - createReservation / cancelReservation / fulfillReservation / getActiveReservedQty
    - runStockOpname (physical count reconciliation via ADJUSTMENT)
  affects:
    - 02-05  # notification service / router layer will call these services
    - 03-pos  # POS sale flow uses decrementStock
    - 04-procurement  # purchase orders use recordMovement(PURCHASE)
tech_stack:
  added: []
  patterns:
    - Redis cache-aside pattern for stock reads (TTL 300s)
    - Append-only inventory_movements table (no UPDATE/DELETE path)
    - SELECT FOR UPDATE inside db.transaction via tx.execute(sql`...`) — PgBouncer-safe
    - Available stock = stock_qty - SUM(active reservations) computed inside same transaction
    - BullMQ low-stock alert enqueued inside transaction for consistent stock value read
    - cacheRedisClient as ioredis instance separate from ConnectionOptions exports
key_files:
  created:
    - apps/api/src/modules/inventory/stock.service.ts
    - apps/api/src/modules/inventory/reservation.service.ts
    - apps/api/src/modules/inventory/movement.service.ts
    - apps/api/src/modules/inventory/opname.service.ts
    - apps/api/src/modules/inventory/index.ts
  modified:
    - apps/api/src/queues/redis.ts
    - apps/api/src/modules/inventory/inventory.test.ts
decisions:
  - "cacheRedisClient added as ioredis Redis instance to queues/redis.ts — ConnectionOptions shape does not expose .get/.setex/.del; a real ioredis instance is required for stock cache operations"
  - "Drizzle sql template object serialized via JSON.stringify for test assertion of FOR UPDATE — .toString() returns [object Object]; queryChunks are in the JSON representation"
  - "opname.service.ts included in plan scope — INV-08 stubs reference runStockOpname; created as minimal implementation to allow test file to load"
metrics:
  duration: "5 minutes"
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_changed: 7
---

# Phase 02 Plan 04: Inventory Core Services Summary

**One-liner:** Redis-cached stock reads, append-only movement recording with SELECT FOR UPDATE concurrency control, and reservation management — the concurrency-critical layer that prevents dual-sale overselling.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Implement stock cache service and reservation service | 55d16e3 | stock.service.ts, reservation.service.ts, redis.ts, inventory.test.ts |
| 2 | Implement movement service with FOR UPDATE concurrency control | ce1386b | movement.service.ts, opname.service.ts, index.ts |

## What Was Built

### stock.service.ts

`getStockCached(variantId)` — checks `cacheRedisClient.get(STOCK_KEY)`, returns integer; on miss queries `productVariants.stockQty` via Drizzle, calls `cacheRedisClient.setex(STOCK_KEY, 300, value)`, returns integer.

`invalidateStockCache(variantId)` — calls `cacheRedisClient.del(STOCK_KEY)`. Called by movement service after each successful transaction commit.

### reservation.service.ts

`getActiveReservedQty(tx, variantId)` — queries `stockReservations` WHERE status='ACTIVE' inside a passed transaction context, returns sum of qty (or 0).

`createReservation({ variantId, qty, orderRef }, tx)` — issues `SELECT stock_qty FOR UPDATE` inside the passed transaction, computes available (stock_qty - active reserved), throws `INSUFFICIENT_STOCK` if qty > available, inserts ACTIVE reservation, returns row.

`cancelReservation(id)` and `fulfillReservation(id)` — set status and resolvedAt via `db.update()` (no transaction needed for status-only updates).

### movement.service.ts

`recordMovement(params, tx?)` — inserts append-only `inventory_movements` row. ADJUSTMENT without `reason` throws `REASON_REQUIRED`; without `approvedBy` throws `APPROVER_REQUIRED`. SALE and TRANSFER get negative qty; all others positive. Never calls `db.update` or `db.delete` on `inventoryMovements`.

`decrementStock(params)` — wraps all operations in `db.transaction`:
1. `tx.execute(sql\`SELECT ... FOR UPDATE\`)` — row-level lock
2. `getActiveReservedQty(tx, variantId)` — active reservation sum inside same transaction
3. available = stock_qty - reserved; throws `INSUFFICIENT_STOCK` if qty > available
4. `recordMovement(...)` — appends movement row
5. `tx.execute(sql\`UPDATE product_variants SET stock_qty = stock_qty - $qty\`)` — stock decrement
6. Enqueues BullMQ `check-low-stock` job if new stock <= lowStockThreshold

After transaction: `invalidateStockCache(variantId)`.

### opname.service.ts

`runStockOpname(counts, performedBy, approvedBy)` — iterates physical count array, skips variants where count matches current stock, inserts ADJUSTMENT movements for discrepancies, returns adjusted count.

### index.ts

Barrel export re-exporting all four service modules.

## Verification Results

- `pnpm --filter @k21/api test -- src/modules/inventory/inventory.test.ts` — 21 tests PASS (INV-01 through INV-07 fully tested; INV-08 stub tests kept as todo)
- `pnpm --filter @k21/api test` — 59/59 tests pass, no regressions
- `movement.service.ts` contains `sql\`SELECT ... FOR UPDATE\`` inside `db.transaction(async (tx) => { ... })`
- `recordMovement` has no reference to `db.update` or `db.delete` on `inventoryMovements` table

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] cacheRedis is ConnectionOptions, not a Redis client instance**
- **Found during:** Task 1 design
- **Issue:** Plan references `cacheRedis.get(...)` / `cacheRedis.setex(...)` / `cacheRedis.del(...)` but `queues/redis.ts` exports `cacheRedis` as a `ConnectionOptions` plain object (no Redis methods). BullMQ ConnectionOptions intentionally does not expose ioredis instance methods.
- **Fix:** Added `cacheRedisClient` export to `queues/redis.ts` — a proper `ioredis` Redis instance with `lazyConnect: true` for the same host/port/password. `stock.service.ts` imports `cacheRedisClient` (not `cacheRedis`).
- **Files modified:** `apps/api/src/queues/redis.ts`
- **Commit:** 55d16e3

**2. [Rule 1 - Bug] Drizzle sql template toString() returns [object Object]**
- **Found during:** Task 2, TDD assertion `expect(executeCall.toString()).toContain('FOR UPDATE')`
- **Issue:** Drizzle's `sql` tagged template returns an SQL object whose `.toString()` is `[object Object]` — the SQL text lives in internal `queryChunks`
- **Fix:** Updated test assertion to use `JSON.stringify(executeCall)` which serializes the queryChunks array containing the raw SQL strings including `FOR UPDATE`
- **Files modified:** `apps/api/src/modules/inventory/inventory.test.ts`
- **Commit:** 55d16e3 (test updated in same commit)

## Self-Check: PASSED

- FOUND: apps/api/src/modules/inventory/stock.service.ts
- FOUND: apps/api/src/modules/inventory/reservation.service.ts
- FOUND: apps/api/src/modules/inventory/movement.service.ts
- FOUND: apps/api/src/modules/inventory/opname.service.ts
- FOUND: apps/api/src/modules/inventory/index.ts
- FOUND: task1 commit 55d16e3
- FOUND: task2 commit ce1386b
