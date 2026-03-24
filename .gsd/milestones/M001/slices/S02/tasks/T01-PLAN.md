---
estimated_steps: 5
estimated_files: 4
skills_used:
  - best-practices
---

# T01: Webhook Endpoint, HMAC Verification, and Accounting Helper

**Slice:** S02 — Webhook Receiver + Order Lifecycle
**Milestone:** M001

## Description

Create `webhook.router.ts` with raw-body capture and HMAC-SHA256 verification, log every inbound event to `marketplace_webhook_events`, enqueue a BullMQ job on valid signature, and return 200 immediately. Mount the router on `app` BEFORE `app.use(express.json(...))` in `index.ts`. Add `createMarketplaceJournalEntry` to `accounting.service.ts` for use by the `order.shipped` handler in T02.

This task retires the slice's highest-risk constraint: the `express.json()` global middleware problem. If the webhook router is mounted after `express.json`, the raw body is already parsed and HMAC cannot be computed correctly.

## Steps

1. **Create `webhook.router.ts`** — Use `express.raw({ type: 'application/json' })` as the FIRST middleware on the route. Parse `req.body` (a Buffer) to JSON manually. Implement `verifyShopeeSignature(rawBody: Buffer, signature: string, partnerKey: string): boolean` using `crypto.createHmac + timingSafeEqual`. Wrap `timingSafeEqual` in a try/catch (returns false on invalid hex). Resolve `channelId` from `marketplace_channels WHERE shop_id = payload.shop_id`; use null if not found.

2. **Log webhook event first (before HMAC check)** — Insert a row into `marketplace_webhook_events` before returning 401 or 200. On invalid signature: `processingStatus = 'SKIPPED'`, `errorMessage = 'Invalid HMAC signature'`. On valid: `processingStatus = 'PENDING'`. Always log the event id — the worker will UPDATE this row to PROCESSED/FAILED.

3. **Enqueue BullMQ job** — Create a new `Queue('marketplace', { connection: bullmqRedis })` instance directly in `webhook.router.ts` (do NOT import `marketplaceQueue` from `queue/queues.ts` — that uses `redisConnection` which lacks `maxRetriesPerRequest: null`). Job data: `{ eventId: string; eventType: string; payload: unknown }`.

4. **Wire into `index.ts`** — Import `webhookRouter` and mount it with `app.use('/api/v1/webhooks', webhookRouter)`. This line MUST appear BEFORE `app.use(express.json({ limit: '1mb' }))`. Also add `SHOPEE_PARTNER_KEY` to `.env.example`.

5. **Add `createMarketplaceJournalEntry` to `accounting.service.ts`** — Signature: `createMarketplaceJournalEntry(params: { orderId: string; total: number }, tx: DrizzleTx): Promise<void>`. Inserts with `transactionId: null`, `sourceId: params.orderId`, `sourceType: 'MARKETPLACE_SALE'`, `amount: params.total` (caller passes integer — no conversion here), `debitCredit: 'DR'`, `status: 'PENDING'`. Re-uses the existing `DrizzleTx` type pattern in that file.

## Must-Haves

- [ ] `verifyShopeeSignature` uses `timingSafeEqual` wrapped in try/catch; returns `false` on any error
- [ ] Every inbound request — valid or not — is logged to `marketplace_webhook_events` before returning a response
- [ ] Invalid HMAC → 401 JSON response; `processingStatus = 'SKIPPED'` in the event log
- [ ] Valid HMAC → BullMQ job enqueued using `bullmqRedis` connection; 200 `{ success: true }` returned
- [ ] Webhook router mounted on `app` directly (not `v1Router`) BEFORE `app.use(express.json(...))` in `index.ts`
- [ ] `createMarketplaceJournalEntry` exported from `accounting.service.ts` with `transactionId: null`
- [ ] `pnpm typecheck` exits 0

## Verification

- `cd apps/api && pnpm typecheck` — must exit 0, no TS errors
- In `apps/api/src/index.ts`, the line `app.use('/api/v1/webhooks', webhookRouter)` appears BEFORE `app.use(express.json(...))`
- `apps/api/src/modules/marketplace/webhook.router.ts` exists and is non-empty
- `grep -q "createMarketplaceJournalEntry" apps/api/src/modules/accounting/accounting.service.ts`

## Observability Impact

- Signals added: every inbound webhook produces a `marketplace_webhook_events` row with `processingStatus` reflecting HMAC result. Invalid signatures produce a row with `errorMessage = 'Invalid HMAC signature'`.
- How a future agent inspects this: `SELECT processing_status, error_message, created_at FROM marketplace_webhook_events ORDER BY created_at DESC LIMIT 10`
- Failure state exposed: SKIPPED rows show rejected requests; missing rows after a POST indicate the router was not reached (mount-order bug)

## Inputs

- `apps/api/src/index.ts` — existing file to modify (webhook router mount point, must appear before express.json line ~36)
- `apps/api/src/db/schema/marketplace.ts` — table definitions for `marketplaceWebhookEvents`, `marketplaceChannels`
- `apps/api/src/modules/accounting/accounting.service.ts` — existing file to extend with `createMarketplaceJournalEntry`
- `apps/api/src/queues/redis.ts` — `bullmqRedis` connection config (required by new Queue in webhook router)
- `apps/api/.env.example` — add `SHOPEE_PARTNER_KEY`

## Expected Output

- `apps/api/src/modules/marketplace/webhook.router.ts` — new file: raw-body middleware, HMAC verification, event logging, BullMQ enqueue, 200 response
- `apps/api/src/modules/accounting/accounting.service.ts` — extended: `createMarketplaceJournalEntry` added
- `apps/api/src/index.ts` — modified: `webhookRouter` imported and mounted before `express.json`
- `apps/api/.env.example` — modified: `SHOPEE_PARTNER_KEY` entry added
