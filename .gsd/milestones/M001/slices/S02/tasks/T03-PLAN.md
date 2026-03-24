---
estimated_steps: 4
estimated_files: 1
skills_used: []
---

# T03: Vitest Unit Tests for Full Order Lifecycle

**Slice:** S02 — Webhook Receiver + Order Lifecycle
**Milestone:** M001

## Description

Write the Vitest unit tests that form the slice's objective verification condition. Tests cover all lifecycle paths: happy path, idempotency, unresolved-SKU path, HMAC verification helper, and all three order state transitions. Uses the same mock-DB pattern established in `apps/api/src/modules/inventory/inventory.test.ts`.

This task depends on T01 and T02 outputs — the test file imports the functions that were written in those tasks.

## Steps

1. **Set up module mocks** — Before any imports: `vi.mock('../../db/index.js', ...)` with `mockDb` and `mockTx`. `vi.mock('../inventory/reservation.service.js', ...)`. `vi.mock('../inventory/movement.service.js', ...)`. `vi.mock('../notifications/notifications.service.js', ...)`. `vi.mock('../accounting/accounting.service.js', ...)`. `vi.mock('../../queues/redis.js', () => ({ bullmqRedis: {} }))`. `vi.mock('bullmq', () => ({ Worker: vi.fn(), Queue: vi.fn(() => ({ add: vi.fn().mockResolvedValue({}) })) }))`. Call `vi.clearAllMocks()` in `beforeEach`.

2. **Test `verifyShopeeSignature`** — Import from `webhook.router.ts`. Test valid HMAC returns true. Test wrong key returns false. Test malformed hex signature returns false (not a throw).

3. **Test `processOrderCreated`** — Four cases:
   - Happy path (all SKUs resolve via `resolveSkuMapping` mock returning `{ variantId: '...' }`): verify `db.insert` called for order + items, `createReservation` called, `notifyByRoles` NOT called.
   - Idempotency: mock `db.insert(...).onConflictDoNothing()` to return `[]` (empty = conflict). Verify `createReservation` NOT called, `notifyByRoles` NOT called.
   - Unresolved SKU (`resolveSkuMapping` returns null): verify order inserted with `skuResolutionStatus: 'UNRESOLVED'`, `createReservation` NOT called, `notifyByRoles` called with `roles: ['Owner', 'Admin']`.
   - Partial SKU (one resolved, one not): verify `skuResolutionStatus: 'PARTIAL'`, `createReservation` called once (resolved item only), `notifyByRoles` called.

4. **Test `processOrderCancelled` and `processOrderShipped`** — Two cases each:
   - `processOrderCancelled`: mock `db.select` returning two active reservation rows; verify `cancelReservation` called twice.
   - `processOrderShipped`: mock `db.select` returning one active reservation; verify `fulfillReservation` called once, `decrementStock` called once, `createMarketplaceJournalEntry` called once.
   - `processOrderShipped` journal failure: mock `createMarketplaceJournalEntry` to throw; verify the function does NOT re-throw (returns normally), and `decrementStock` was still called.

## Must-Haves

- [ ] All `vi.mock` calls appear before any `import` statements that use the mocked modules
- [ ] `verifyShopeeSignature` tests cover: valid key, wrong key, invalid hex (no throw)
- [ ] `processOrderCreated` covers: happy path, idempotency skip, unresolved SKU, partial SKU
- [ ] `processOrderCancelled` verifies `cancelReservation` called for each active reservation
- [ ] `processOrderShipped` verifies `fulfillReservation`, `decrementStock`, and `createMarketplaceJournalEntry` are all called
- [ ] `processOrderShipped` journal failure case verifies no re-throw
- [ ] `pnpm test --run src/modules/marketplace/marketplace.test.ts` exits 0 with no skipped tests

## Verification

- `cd apps/api && pnpm test --run src/modules/marketplace/marketplace.test.ts` — exits 0, all tests pass
- `grep -c "it(" apps/api/src/modules/marketplace/marketplace.test.ts` — returns >= 9 (at least 9 test cases)

## Inputs

- `apps/api/src/modules/marketplace/marketplace.service.ts` — T02 output: functions under test
- `apps/api/src/modules/marketplace/webhook.router.ts` — T01 output: `verifyShopeeSignature` under test
- `apps/api/src/modules/inventory/inventory.test.ts` — mock pattern reference (vi.mock before imports, mockDb shape, beforeEach clearAllMocks)

## Expected Output

- `apps/api/src/modules/marketplace/marketplace.test.ts` — new file: comprehensive lifecycle tests, all passing
