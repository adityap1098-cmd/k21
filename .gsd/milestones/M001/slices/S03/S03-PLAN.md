# S03: Order Detail + Status Transitions

**Goal:** Expose real order list, order detail, and webhook event endpoints so S04 can wire the frontend to live data.
**Demo:** `GET /api/v1/marketplace/channels/:id/orders` returns paginated DB rows with `skuResolutionStatus`. `GET /api/v1/marketplace/channels/:id/orders/:orderId` returns an order with its items. `GET /api/v1/marketplace/channels/:id/webhooks` returns paginated webhook events with `processingStatus`. All three unit test groups pass.

## Must-Haves

- `getChannelOrders()` returns `{ data, total, limit, offset }` with optional status filter (live DB enum values only)
- `getWebhookEvents()` returns `{ data, total, limit, offset }` with optional eventType filter
- `getOrderDetail(orderId)` returns `{ order, items }` and throws `ORDER_NOT_FOUND` for unknown IDs
- `ChannelOrder` interface corrected: `orderSn` (not `orderId`), adds `buyerName` and `skuResolutionStatus`
- `WebhookEvent` interface corrected: adds `processingStatus` and `errorMessage`
- `GET /channels/:id/orders/:orderId` route added (404 on not-found, Owner/Admin only)
- Router response shapes updated to forward the paginated `{ data, total, limit, offset }` object
- `channelFiltersSchema` uses `z.enum([...])` with the 8 live status values (not `z.string()`)
- `OrderDetail` type exported from `index.ts`
- Vitest tests for all three new service functions pass

## Verification

```bash
cd apps/api && pnpm test --run marketplace.test.ts
cd apps/api && pnpm typecheck
```

Both must exit 0. Test count for the file rises from 12 to at least 18 (3 new groups × at least 2 tests each).

```bash
# Failure-path diagnostic: verify ORDER_NOT_FOUND test case exists and passes
cd apps/api && pnpm test --run marketplace.test.ts --reporter=verbose 2>&1 | grep -E "ORDER_NOT_FOUND|getOrderDetail"
```

This grep must produce output showing the `getOrderDetail` describe block and the `ORDER_NOT_FOUND` test case as passing.

## Tasks

- [x] **T01: Implement order/webhook query functions, add order detail route, extend test suite** `est:1h`
  - Why: Replaces the two empty stubs left by S02, adds the missing order detail endpoint, and fixes two broken interface definitions. This is the entire S03 scope.
  - Files: `apps/api/src/modules/marketplace/marketplace.service.ts`, `apps/api/src/modules/marketplace/marketplace.router.ts`, `apps/api/src/modules/marketplace/index.ts`, `apps/api/src/modules/marketplace/marketplace.test.ts`
  - Do: See T01-PLAN.md for full steps.
  - Verify: `cd apps/api && pnpm test --run marketplace.test.ts` (≥18 tests pass) + `pnpm typecheck` (exit 0)
  - Done when: Both commands pass, router file contains a `/channels/:id/orders/:orderId` route, and `getChannelOrders` / `getWebhookEvents` each call `db.select` with the channelId condition.

## Observability / Diagnostics

### Runtime Signals

| Surface | What it emits | When |
|---|---|---|
| `console.error('[marketplace] GET /channels/:id/orders/:orderId failed:', err)` | Unhandled error from `getOrderDetail` | 500 path on the new detail route |
| HTTP 404 body `{ error: 'ORDER_NOT_FOUND' }` | Missing order ID | Client requested a non-existent orderId |
| HTTP 400 body `{ error: '...' }` | Invalid `status` query param | Caller passes a value not in the 8-value enum |

### Inspection Surface

- Query `GET /api/v1/marketplace/channels/:id/orders?status=PENDING&limit=20` — the response body now includes `total`, `limit`, and `offset` pagination fields alongside `data`; a missing `total` key means the stub is still live.
- Query `GET /api/v1/marketplace/channels/:id/webhooks` — each event in `data` now includes `processingStatus` and `errorMessage`.
- `pnpm test --run marketplace.test.ts --reporter=verbose` shows the three new `describe` blocks and their individual pass/fail state.

### Failure Visibility

- `ORDER_NOT_FOUND` surfaces as a structured 404 JSON body (not an HTML Express default) so API clients can distinguish it from auth failures.
- DB errors from `getChannelOrders` / `getWebhookEvents` propagate as 500 with `console.error` log lines that include the route prefix `[marketplace]`.

### Redaction Constraints

- `buyerName` and `buyerMaskedPhone` are already masked at ingestion time (Shopee provides masked phone). No additional redaction needed in query paths.
- Do NOT log full `payload` JSONB from webhook events — may contain PII.

## Files Likely Touched

- `apps/api/src/modules/marketplace/marketplace.service.ts`
- `apps/api/src/modules/marketplace/marketplace.router.ts`
- `apps/api/src/modules/marketplace/index.ts`
- `apps/api/src/modules/marketplace/marketplace.test.ts`
