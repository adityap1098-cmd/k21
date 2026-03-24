---
estimated_steps: 5
estimated_files: 3
skills_used:
  - best-practices
---

# T02: Marketplace Service Functions and BullMQ Worker

**Slice:** S02 — Webhook Receiver + Order Lifecycle
**Milestone:** M001

## Description

Add the four domain-logic functions to `marketplace.service.ts` and create the BullMQ worker in `apps/api/src/queue/marketplace.worker.ts`. The worker is a thin orchestrator — it reads the job data, calls the appropriate service function, and updates the webhook event status on completion or failure.

This task produces the DB mutations that satisfy R001–R004 and R012. It depends on T01 (webhook router exists, `createMarketplaceJournalEntry` exported, BullMQ queue defined).

## Steps

1. **Add `resolveSkuMapping(channelId, sellerSku)` to `marketplace.service.ts`** — Query `marketplace_sku_mappings WHERE channel_id = ? AND seller_sku = ? AND is_active = true`. Return `{ variantId: string } | null`. No transaction needed (read-only lookup).

2. **Add `processOrderCreated(payload, eventId)` to `marketplace.service.ts`** — Steps:
   - Extract `order_sn`, `status`, `buyer_username`, `item_list`, `total_amount` from the Shopee `order.created` payload. Map `code = 3` → `order.created`.
   - Upsert order using `.onConflictDoNothing()` on `order_sn`. If the returned array is empty, log `[marketplace-service] duplicate order_sn — skipping` and return early.
   - For each item in `item_list`, call `resolveSkuMapping(channelId, item.seller_sku)`.
   - Determine `skuResolutionStatus`: all resolved → `'RESOLVED'`; none resolved → `'UNRESOLVED'`; mixed → `'PARTIAL'`.
   - Insert `marketplace_order_items` rows (variantId may be null for unresolved items).
   - For resolved items only: call `createReservation({ variantId, qty, orderRef: order_sn }, tx)` inside a `db.transaction()`.
   - If `skuResolutionStatus !== 'RESOLVED'`: call `notifyByRoles({ roles: ['Owner', 'Admin'], type: 'UNRESOLVED_SKU', payload: { orderId, orderSn: order_sn } })`.

3. **Add `processOrderCancelled(payload)` to `marketplace.service.ts`** — Extract `order_sn`. Query `stock_reservations WHERE order_ref = order_sn AND status = 'ACTIVE'`. For each, call `cancelReservation(reservation.id)`. Update `marketplace_orders.status = 'CANCELLED'` where `order_sn = ?`.

4. **Add `processOrderShipped(payload)` to `marketplace.service.ts`** — Extract `order_sn`. Query `stock_reservations WHERE order_ref = order_sn AND status = 'ACTIVE'`. For each, call `fulfillReservation(reservation.id)`, then `decrementStock({ variantId, qty, movementType: 'SALE', reference: order_sn, performedBy: 'marketplace-worker' })`. After all reservations fulfilled: call `createMarketplaceJournalEntry({ orderId: order.id, total: Math.round(Number(order.totalAmount)) }, tx)` in a new `db.transaction()`. Update order status to `'SHIPPED'`. If `createMarketplaceJournalEntry` throws, log the error but do not re-throw (best-effort accounting — `decrementStock` has already committed).

5. **Create `apps/api/src/queue/marketplace.worker.ts`** — Export `createMarketplaceWorker()`. Pattern mirrors `apps/api/src/queues/lowstock.queue.ts`. Use `bullmqRedis` from `../../queues/redis.js` and queue name `'marketplace'`. On job start: log `[marketplace-worker] processing jobId=X eventType=Y`. On completion: UPDATE `marketplace_webhook_events SET processing_status = 'PROCESSED', processed_at = now() WHERE id = job.data.eventId`. On error: UPDATE to `FAILED`, set `error_message`. Register in `index.ts` startup block alongside `createLowStockWorker()`.

## Must-Haves

- [ ] `processOrderCreated` uses `.onConflictDoNothing()` and returns early (with log) on duplicate `order_sn`
- [ ] `processOrderCreated` calls `createReservation` inside a transaction for resolved items only
- [ ] `processOrderCreated` calls `notifyByRoles` with `roles: ['Owner', 'Admin']` when `skuResolutionStatus !== 'RESOLVED'`
- [ ] `processOrderShipped` calls `decrementStock` then `createMarketplaceJournalEntry`; journal entry failure is caught and logged, not re-thrown
- [ ] Worker updates `marketplace_webhook_events.processingStatus` to `'PROCESSED'` or `'FAILED'` on every job completion
- [ ] Worker uses `bullmqRedis` from `queues/redis.ts` (not `redisConnection` from `queue/connection.ts`)
- [ ] `createMarketplaceWorker()` registered in `apps/api/src/index.ts` startup block
- [ ] `pnpm typecheck` exits 0

## Verification

- `cd apps/api && pnpm typecheck` — must exit 0
- `test -f apps/api/src/queue/marketplace.worker.ts` — file exists
- `grep -q "createMarketplaceWorker" apps/api/src/index.ts` — worker registered at startup
- `grep -q "processOrderCreated\|processOrderCancelled\|processOrderShipped" apps/api/src/modules/marketplace/marketplace.service.ts` — functions exported

## Observability Impact

- Signals added: `[marketplace-worker] processing jobId=... eventType=...` on job start; `[marketplace-worker] FAILED jobId=... error=...` on unhandled throw; `[marketplace-service] duplicate order_sn — skipping` on idempotency skip.
- How a future agent inspects this: `SELECT processing_status, error_message, processed_at FROM marketplace_webhook_events ORDER BY created_at DESC` shows each job's outcome. `SELECT sku_resolution_status, status FROM marketplace_orders ORDER BY created_at DESC` shows import state.
- Failure state exposed: FAILED rows carry `error_message` text. PENDING rows that never transition indicate the worker crashed or was not started.

## Inputs

- `apps/api/src/modules/marketplace/webhook.router.ts` — T01 output: confirms BullMQ job shape `{ eventId, eventType, payload }`
- `apps/api/src/modules/accounting/accounting.service.ts` — T01 output: `createMarketplaceJournalEntry` to call in `processOrderShipped`
- `apps/api/src/db/schema/marketplace.ts` — table defs: `marketplaceOrders`, `marketplaceOrderItems`, `marketplaceSkuMappings`, `marketplaceWebhookEvents`
- `apps/api/src/modules/inventory/reservation.service.ts` — `createReservation`, `cancelReservation`, `fulfillReservation`
- `apps/api/src/modules/inventory/movement.service.ts` — `decrementStock`
- `apps/api/src/modules/notifications/notifications.service.ts` — `notifyByRoles`
- `apps/api/src/queues/lowstock.queue.ts` — worker pattern to mirror
- `apps/api/src/queues/redis.ts` — `bullmqRedis` connection
- `apps/api/src/index.ts` — startup block for worker registration

## Expected Output

- `apps/api/src/modules/marketplace/marketplace.service.ts` — extended: `resolveSkuMapping`, `processOrderCreated`, `processOrderCancelled`, `processOrderShipped` added
- `apps/api/src/queue/marketplace.worker.ts` — new file: `createMarketplaceWorker()` export
- `apps/api/src/index.ts` — modified: `createMarketplaceWorker` imported and registered in startup block with graceful shutdown
