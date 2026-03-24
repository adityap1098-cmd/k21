---
estimated_steps: 5
estimated_files: 4
skills_used:
  - react-best-practices
---

# T01: Implement order/webhook query functions, add order detail route, extend test suite

**Slice:** S03 — Order Detail + Status Transitions
**Milestone:** M001

## Description

S02 left two empty stubs in `marketplace.service.ts` (`getChannelOrders` and `getWebhookEvents` both return `[]`) and two interface definitions that don't match the real DB schema. S03 replaces those stubs with real Drizzle queries, adds a `getOrderDetail` function, adds the missing `GET /channels/:id/orders/:orderId` route, and extends the test suite to cover all three new functions. No migrations or new files — all changes are in the existing marketplace module.

## Steps

1. **Fix `marketplace.service.ts` imports and interfaces**
   - Add `desc` and `sql` to the `drizzle-orm` import (currently only `and, eq` are imported).
   - Add `marketplaceWebhookEvents`, `MarketplaceOrder`, `MarketplaceOrderItem` to the schema import from `../../db/schema/marketplace.js`. All are already exported from that file.
   - Replace the `ChannelOrder` interface: rename `orderId` → `orderSn`, change `totalAmount: number` → `totalAmount: string`, add `buyerName: string | null` and `skuResolutionStatus: string`, change `createdAt: string` → `createdAt: Date`.
   - Replace the `WebhookEvent` interface: add `processingStatus: string` and `errorMessage: string | null`, change `channelId: string` → `channelId: string | null`, change `processedAt: string` → `processedAt: Date | null`, change `createdAt: string` → `createdAt: Date`.

2. **Implement `getChannelOrders(channelId, filters?)`**

   Replace the stub with:
   ```ts
   export async function getChannelOrders(
     channelId: string,
     filters?: { status?: string; limit?: number; offset?: number }
   ): Promise<{ data: ChannelOrder[]; total: number; limit: number; offset: number }> {
     const limit = filters?.limit ?? 20
     const offset = filters?.offset ?? 0
     const conditions = [eq(marketplaceOrders.channelId, channelId)]
     if (filters?.status) {
       conditions.push(eq(marketplaceOrders.status, filters.status as any))
     }
     const whereClause = and(...conditions)
     const [rows, countResult] = await Promise.all([
       db.select().from(marketplaceOrders)
         .where(whereClause)
         .orderBy(desc(marketplaceOrders.createdAt))
         .limit(limit)
         .offset(offset),
       db.select({ count: sql<number>`count(*)::int` })
         .from(marketplaceOrders)
         .where(whereClause),
     ])
     return { data: rows as ChannelOrder[], total: countResult[0]?.count ?? 0, limit, offset }
   }
   ```

3. **Implement `getWebhookEvents(channelId, filters?)` and `getOrderDetail(orderId)`**

   Replace the `getWebhookEvents` stub with the same paginated pattern, filtering on `marketplaceWebhookEvents.channelId` and optionally on `marketplaceWebhookEvents.eventType`. Default limit is 30.

   Add `getOrderDetail` after `getWebhookEvents`:
   ```ts
   export interface OrderDetail {
     order: MarketplaceOrder
     items: MarketplaceOrderItem[]
   }
   
   export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
     const [order] = await db
       .select()
       .from(marketplaceOrders)
       .where(eq(marketplaceOrders.id, orderId))
       .limit(1)
     if (!order) throw new Error('ORDER_NOT_FOUND')
     const items = await db
       .select()
       .from(marketplaceOrderItems)
       .where(eq(marketplaceOrderItems.orderId, orderId))
     return { order, items }
   }
   ```

4. **Update `marketplace.router.ts` and `index.ts`**

   In `marketplace.router.ts`:
   - Update the `import` to add `getOrderDetail` from `./marketplace.service.js`.
   - Update `channelFiltersSchema` — replace `status: z.string().optional()` with:
     ```ts
     status: z.enum([
       'PENDING', 'CONFIRMED', 'READY_TO_SHIP', 'SHIPPED',
       'DELIVERED', 'CANCELLED', 'RETURNED', 'STOCK_CONFLICT'
     ]).optional(),
     ```
   - Update the `GET /channels/:id/orders` handler: change `res.json({ success: true, data: orders, error: null })` to `res.json({ success: true, data: orders, error: null })` — `orders` is now already `{ data, total, limit, offset }` so the shape passes through correctly. No change needed if the handler just does `res.status(200).json({ success: true, data: orders, error: null })`.
   - Add the new route **after** `GET /channels/:id/orders` (but before `GET /channels/:id/webhooks` is fine):
     ```ts
     marketplaceRouter.get(
       '/channels/:id/orders/:orderId',
       authenticate,
       requireRole('Owner', 'Admin'),
       async (req, res) => {
         try {
           const detail = await getOrderDetail(req.params.orderId)
           res.status(200).json({ success: true, data: detail, error: null })
         } catch (err) {
           if ((err as Error).message === 'ORDER_NOT_FOUND') {
             res.status(404).json({ success: false, data: null, error: 'ORDER_NOT_FOUND' })
             return
           }
           console.error('[marketplace] GET /channels/:id/orders/:orderId failed:', err)
           res.status(500).json({ success: false, data: null, error: 'Internal server error' })
         }
       }
     )
     ```

   In `index.ts`, add `OrderDetail` to the re-export:
   ```ts
   export type { ChannelOrder, WebhookEvent, OrderDetail } from './marketplace.service.js'
   ```

5. **Extend `marketplace.test.ts` with three new `describe` blocks**

   Append after the existing `processOrderShipped` describe block. Do not modify existing tests.

   **`getChannelOrders` tests** — three cases: happy path with status filter, happy path without filter, empty result. The function calls `db.select` twice (via `Promise.all`); use `mockReturnValueOnce` for each in order (rows query first, count query second). The rows mock chain must end in `.offset()` → `mockResolvedValue(rows)`; the count mock chain must end in `.where()` → `mockResolvedValue([{ count: N }])`.

   ```ts
   describe('marketplace — getChannelOrders', () => {
     function setupOrdersQuery(rows: any[], count: number) {
       const rowsChain = {
         from: vi.fn().mockReturnThis(),
         where: vi.fn().mockReturnThis(),
         orderBy: vi.fn().mockReturnThis(),
         limit: vi.fn().mockReturnThis(),
         offset: vi.fn().mockResolvedValue(rows),
       }
       const countChain = {
         from: vi.fn().mockReturnThis(),
         where: vi.fn().mockResolvedValue([{ count }]),
       }
       mockDb.select
         .mockReturnValueOnce(rowsChain)
         .mockReturnValueOnce(countChain)
     }

     it('returns paginated shape with status filter applied', async () => {
       const row = { id: ORDER_ID, channelId: CHANNEL_ID, orderSn: ORDER_SN, platform: 'shopee',
                     status: 'READY_TO_SHIP', buyerName: null, totalAmount: '50000',
                     skuResolutionStatus: 'RESOLVED', createdAt: new Date() }
       setupOrdersQuery([row], 1)
       const result = await getChannelOrders(CHANNEL_ID, { status: 'READY_TO_SHIP', limit: 20, offset: 0 })
       expect(result).toEqual({ data: [row], total: 1, limit: 20, offset: 0 })
     })

     it('returns paginated shape with no filter', async () => {
       setupOrdersQuery([], 0)
       const result = await getChannelOrders(CHANNEL_ID)
       expect(result).toEqual({ data: [], total: 0, limit: 20, offset: 0 })
     })

     it('returns empty result when no orders exist', async () => {
       setupOrdersQuery([], 0)
       const result = await getChannelOrders(CHANNEL_ID, { status: 'SHIPPED' })
       expect(result.data).toHaveLength(0)
       expect(result.total).toBe(0)
     })
   })
   ```

   **`getWebhookEvents` tests** — same three-case pattern, filtering on `channelId` and optionally `eventType`.

   **`getOrderDetail` tests** — two cases:
   - Happy path: two sequential `db.select` calls (order lookup → items); returns `{ order, items }`.
   - NOT_FOUND: first `db.select` resolves to `[]`; function throws `Error('ORDER_NOT_FOUND')`.

   ```ts
   describe('marketplace — getOrderDetail', () => {
     const orderRow = { id: ORDER_ID, channelId: CHANNEL_ID, orderSn: ORDER_SN, /* ... */ }
     const itemRows = [{ id: 'item-1', orderId: ORDER_ID, sellerSku: 'SKU-A' }]

     it('returns order with items on happy path', async () => {
       const orderChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([orderRow]) }
       const itemsChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(itemRows) }
       mockDb.select.mockReturnValueOnce(orderChain).mockReturnValueOnce(itemsChain)
       const result = await getOrderDetail(ORDER_ID)
       expect(result.order).toEqual(orderRow)
       expect(result.items).toEqual(itemRows)
     })

     it('throws ORDER_NOT_FOUND when order does not exist', async () => {
       const notFoundChain = { from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(), limit: vi.fn().mockResolvedValue([]) }
       mockDb.select.mockReturnValueOnce(notFoundChain)
       await expect(getOrderDetail('nonexistent-id')).rejects.toThrow('ORDER_NOT_FOUND')
     })
   })
   ```

   Also add `getChannelOrders`, `getWebhookEvents`, `getOrderDetail` to the import block at the top of `marketplace.test.ts`.

## Must-Haves

- [ ] `drizzle-orm` import in `marketplace.service.ts` includes `desc` and `sql`
- [ ] `ChannelOrder` interface has `orderSn` (not `orderId`), `buyerName`, `skuResolutionStatus`, correct types
- [ ] `WebhookEvent` interface has `processingStatus` and `errorMessage`
- [ ] `getChannelOrders` returns `{ data, total, limit, offset }` — no longer returns `ChannelOrder[]`
- [ ] `getWebhookEvents` returns `{ data, total, limit, offset }` — no longer returns `WebhookEvent[]`
- [ ] `getOrderDetail` throws `Error('ORDER_NOT_FOUND')` when order row is missing
- [ ] `OrderDetail` interface defined and exported from `marketplace.service.ts` and re-exported from `index.ts`
- [ ] `GET /channels/:id/orders/:orderId` route exists in `marketplace.router.ts` with 404 handling
- [ ] `channelFiltersSchema.status` uses `z.enum([...])` with the 8 live enum values
- [ ] `marketplace.test.ts` imports `getChannelOrders`, `getWebhookEvents`, `getOrderDetail`
- [ ] All new test cases pass — at least 6 new tests across the 3 new describe blocks

## Verification

```bash
cd apps/api && pnpm test --run marketplace.test.ts
cd apps/api && pnpm typecheck
```

Test run must show ≥ 18 tests passing (12 existing + ≥ 6 new). Typecheck must exit 0 with no errors.

## Inputs

- `apps/api/src/modules/marketplace/marketplace.service.ts` — contains the two stubs and wrong interfaces to replace
- `apps/api/src/modules/marketplace/marketplace.router.ts` — contains the routes to update and the new route to add
- `apps/api/src/modules/marketplace/marketplace.test.ts` — existing 12-test suite to extend
- `apps/api/src/modules/marketplace/index.ts` — exports to extend with `OrderDetail`
- `apps/api/src/db/schema/marketplace.ts` — source of `marketplaceWebhookEvents`, `MarketplaceOrder`, `MarketplaceOrderItem` types

## Expected Output

- `apps/api/src/modules/marketplace/marketplace.service.ts` — stubs replaced, interfaces fixed, `getOrderDetail` and `OrderDetail` added
- `apps/api/src/modules/marketplace/marketplace.router.ts` — new route added, Zod schema tightened
- `apps/api/src/modules/marketplace/marketplace.test.ts` — 3 new describe blocks appended, 3 new imports added
- `apps/api/src/modules/marketplace/index.ts` — `OrderDetail` added to re-export
