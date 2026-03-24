# S02: Webhook Receiver + Order Lifecycle

**Goal:** `POST /api/v1/webhooks/shopee` with a valid HMAC signature enqueues a BullMQ job; the worker handles the full order lifecycle (created → cancelled → shipped) with idempotency; all events logged; unresolved-SKU orders imported with flagged status and notification sent.

**Demo:** After T01–T03 complete: a simulated `curl` with a valid HMAC signature to `/api/v1/webhooks/shopee` returns 200 immediately. The queued BullMQ job creates a `marketplace_orders` row, active `stock_reservations`, and a `marketplace_webhook_events` row with `processing_status = 'PROCESSED'`. An `order.cancelled` job marks the reservation `CANCELLED`. An `order.shipped` job fulfills the reservation, decrements stock, and writes a `MARKETPLACE_SALE` journal entry. An order with an unresolved SKU imports with `sku_resolution_status = 'UNRESOLVED'` and triggers a notification. Duplicate webhook events do not double-reserve. All paths verified by Vitest unit tests.

## Must-Haves

- R005: HMAC-SHA256 signature verification; 401 on invalid signature; logged regardless
- R006: Every webhook logged in `marketplace_webhook_events` (verified or not); status updated to PROCESSED/FAILED by worker
- R007: BullMQ job enqueued on receipt, 200 returned immediately; worker registered at API startup
- R001: `marketplace_orders` row created on `order.created`; `marketplace_order_items` rows created
- R002: `stock_reservations` row created per resolved line item on `order.created`
- R003: Active reservations cancelled on `order.cancelled`
- R004: Reservation fulfilled + stock decremented + `MARKETPLACE_SALE` journal entry on `order.shipped`
- R012: Unresolved-SKU orders import without crashing; `sku_resolution_status` flagged; `notifyByRoles` called for Owner/Admin

## Proof Level

- This slice proves: integration (real DB + worker pipeline exercised end-to-end)
- Real runtime required: no (unit tests with mocked DB are sufficient for lifecycle coverage; HMAC verified by unit test)
- Human/UAT required: no

## Verification

All checks must pass before this slice is done:

```bash
cd apps/api && pnpm test --run src/modules/marketplace/marketplace.test.ts
```

Tests in `apps/api/src/modules/marketplace/marketplace.test.ts` must pass for:
- `processOrderCreated` — happy path (all SKUs resolved, reservation created)
- `processOrderCreated` — idempotency (duplicate `order_sn` → no double-reservation)
- `processOrderCreated` — unresolved SKU → `sku_resolution_status = 'UNRESOLVED'`, `notifyByRoles` called
- `processOrderCancelled` — active reservations cancelled
- `processOrderShipped` — reservation fulfilled, `decrementStock` called, journal entry inserted
- `verifyShopeeSignature` — valid HMAC → true; invalid → false
- `resolveSkuMapping` — found vs. not found

TypeScript clean:
```bash
cd apps/api && pnpm typecheck
```

## Observability / Diagnostics

- Runtime signals: `console.log('[marketplace-worker]', ...)` on job start and completion; `console.error` on failure with `jobId`, `eventType`, `error.message`. Event row updated with `processingStatus = 'FAILED'` + `errorMessage` on unhandled throw.
- Inspection surfaces: `SELECT * FROM marketplace_webhook_events ORDER BY created_at DESC LIMIT 20` — shows every inbound event with `processing_status` and `error_message`. `SELECT * FROM marketplace_orders ORDER BY created_at DESC LIMIT 10` — order import state. `SELECT * FROM stock_reservations WHERE order_ref LIKE 'shopee-%' ORDER BY reserved_at DESC` — reservation state.
- Failure visibility: Worker logs `[marketplace-worker] FAILED jobId=X eventType=Y error=Z`. Webhook event row carries `error_message` on failure. Idempotency skip is logged as `[marketplace-worker] duplicate order_sn — skipping`.
- Redaction constraints: `buyer_masked_phone` is already masked by Shopee — no additional redaction needed. HMAC key never logged.

## Integration Closure

- Upstream surfaces consumed: `apps/api/src/db/schema/marketplace.ts` (all 5 tables + enums), `reservation.service.ts` (`createReservation`, `cancelReservation`, `fulfillReservation`), `movement.service.ts` (`decrementStock`), `notifications.service.ts` (`notifyByRoles`), `queues/redis.ts` (`bullmqRedis`), seeded channel `id = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'`
- New wiring introduced: `webhookRouter` mounted on `app` BEFORE `app.use(express.json(...))` in `index.ts`; `createMarketplaceWorker()` registered in the startup block beside `createLowStockWorker()`
- What remains before the milestone is truly usable end-to-end: S03 (order list/detail endpoints) and S04 (frontend wiring)

## Tasks

- [x] **T01: Webhook endpoint, HMAC verification, and accounting helper** `est:1h`
  - Why: The raw-body HMAC constraint is the slice's load-bearing risk. The webhook router must be mounted before `express.json()` in `index.ts`. The `createMarketplaceJournalEntry` helper must exist before T02's service code can reference it.
  - Files: `apps/api/src/modules/marketplace/webhook.router.ts`, `apps/api/src/modules/accounting/accounting.service.ts`, `apps/api/src/index.ts`, `apps/api/.env.example`
  - Do: Create `webhook.router.ts` with `express.raw({ type: 'application/json' })` as route-level middleware, HMAC verification using `crypto.timingSafeEqual`, event logging to `marketplace_webhook_events` (both valid and invalid), and BullMQ enqueue via `bullmqRedis`-connected queue. Mount the router on `app` directly (not on `v1Router`) BEFORE `app.use(express.json(...))`. Add `createMarketplaceJournalEntry` to `accounting.service.ts` (passes `transactionId: null`, `sourceId: orderId`, `sourceType: 'MARKETPLACE_SALE'`).
  - Verify: `cd apps/api && pnpm typecheck` exits 0; webhook route present at correct path in index.ts before express.json line
  - Done when: `typecheck` exits 0; `webhook.router.ts` exists with HMAC logic; `createMarketplaceJournalEntry` exported from `accounting.service.ts`; webhook router mounted before `express.json` in `index.ts`

- [x] **T02: Marketplace service functions and BullMQ worker** `est:1.5h`
  - Why: The domain logic layer and worker thin orchestrator. These produce the actual DB mutations that satisfy R001–R004 and R012. They depend on T01 (accounting helper) and the S01 schema.
  - Files: `apps/api/src/modules/marketplace/marketplace.service.ts`, `apps/api/src/queue/marketplace.worker.ts`, `apps/api/src/index.ts`
  - Do: Add `resolveSkuMapping()`, `processOrderCreated()`, `processOrderCancelled()`, `processOrderShipped()` to `marketplace.service.ts`. Create `apps/api/src/queue/marketplace.worker.ts` with `createMarketplaceWorker()` using `bullmqRedis` and queue name `'marketplace'`. Register the worker in `index.ts` startup block. Worker updates `marketplace_webhook_events.processingStatus` to `'PROCESSED'` or `'FAILED'` on completion.
  - Verify: `cd apps/api && pnpm typecheck` exits 0; `apps/api/src/queue/marketplace.worker.ts` exists
  - Done when: `typecheck` exits 0; all four service functions exported; worker file exists; `createMarketplaceWorker` registered in `index.ts` startup block

- [x] **T03: Vitest unit tests for the full lifecycle** `est:1h`
  - Why: Provides the slice's objective verification condition. Tests the happy path, idempotency, unresolved-SKU path, HMAC helper, and all three lifecycle transitions. Uses the same mock-DB pattern as `inventory.test.ts`.
  - Files: `apps/api/src/modules/marketplace/marketplace.test.ts`
  - Do: Write Vitest tests with mocked `db`, `reservation.service`, `movement.service`, `notifications.service`, `accounting.service`, and `queues/redis`. Cover all paths listed in the Verification section above. Mock pattern mirrors `inventory.test.ts` (`vi.mock` before imports, `vi.clearAllMocks()` in `beforeEach`).
  - Verify: `cd apps/api && pnpm test --run src/modules/marketplace/marketplace.test.ts` — all tests pass with no skipped tests
  - Done when: Test file exists; all described test cases present; `pnpm test --run` exits 0

## Files Likely Touched

- `apps/api/src/modules/marketplace/webhook.router.ts` (new)
- `apps/api/src/modules/marketplace/marketplace.service.ts` (extended)
- `apps/api/src/modules/marketplace/marketplace.test.ts` (new)
- `apps/api/src/queue/marketplace.worker.ts` (new)
- `apps/api/src/modules/accounting/accounting.service.ts` (extended)
- `apps/api/src/index.ts` (mount order + worker registration)
- `apps/api/.env.example` (add `SHOPEE_PARTNER_KEY`)
