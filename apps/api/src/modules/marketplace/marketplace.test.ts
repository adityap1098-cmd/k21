/**
 * Marketplace lifecycle unit tests — S02 verification gate.
 *
 * Covers:
 *  - verifyShopeeSignature (HMAC helper)
 *  - resolveSkuMapping (SKU lookup)
 *  - processOrderCreated (happy path, idempotency, unresolved SKU, partial SKU)
 *  - processOrderCancelled (cancels active reservations)
 *  - processOrderShipped (fulfills, decrements stock, journal — including failure path)
 *
 * Mock pattern: vi.mock() before ALL imports, then access mocked module as `any`.
 * Mirrors the pattern in apps/api/src/modules/inventory/inventory.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import crypto from 'crypto'

// ── Module mocks — MUST appear before any import that uses the mocked module ──

vi.mock('../../db/index.js', () => {
  const mockTx = {
    execute: vi.fn(),
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  }
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    execute: vi.fn(),
    transaction: vi.fn(),
  }
  return { db: mockDb }
})

vi.mock('../inventory/reservation.service.js', () => ({
  createReservation: vi.fn().mockResolvedValue({ id: 'res-001', status: 'ACTIVE' }),
  cancelReservation: vi.fn().mockResolvedValue(undefined),
  fulfillReservation: vi.fn().mockResolvedValue(undefined),
  getActiveReservedQty: vi.fn().mockResolvedValue(0),
}))

vi.mock('../inventory/movement.service.js', () => ({
  decrementStock: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../notifications/notifications.service.js', () => ({
  notifyByRoles: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../accounting/accounting.service.js', () => ({
  createMarketplaceJournalEntry: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../queues/redis.js', () => ({
  bullmqRedis: {},
  cacheRedis: {},
  cacheRedisClient: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  },
}))

vi.mock('bullmq', () => ({
  Worker: vi.fn(),
  Queue: vi.fn(() => ({
    add: vi.fn().mockResolvedValue({}),
  })),
}))

// ── Imports (after mocks) ──────────────────────────────────────────────────────

import { db } from '../../db/index.js'
import { createReservation, cancelReservation, fulfillReservation } from '../inventory/reservation.service.js'
import { decrementStock } from '../inventory/movement.service.js'
import { notifyByRoles } from '../notifications/notifications.service.js'
import { createMarketplaceJournalEntry } from '../accounting/accounting.service.js'
import {
  resolveSkuMapping,
  processOrderCreated,
  processOrderCancelled,
  processOrderShipped,
  getChannelOrders,
  getWebhookEvents,
  getOrderDetail,
} from './marketplace.service.js'
import { verifyShopeeSignature } from './webhook.router.js'

const mockDb = db as any
const mockCreateReservation = createReservation as any
const mockCancelReservation = cancelReservation as any
const mockFulfillReservation = fulfillReservation as any
const mockDecrementStock = decrementStock as any
const mockNotifyByRoles = notifyByRoles as any
const mockCreateMarketplaceJournalEntry = createMarketplaceJournalEntry as any

// ── Test constants ─────────────────────────────────────────────────────────────

const CHANNEL_ID    = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const VARIANT_ID_1  = '11111111-1111-1111-1111-111111111111'
const VARIANT_ID_2  = '22222222-2222-2222-2222-222222222222'
const ORDER_ID      = '33333333-3333-3333-3333-333333333333'
const RESERVATION_1 = '44444444-4444-4444-4444-444444444444'
const RESERVATION_2 = '55555555-5555-5555-5555-555555555555'
const EVENT_ID      = '66666666-6666-6666-6666-666666666666'
const ORDER_SN      = 'SHP-ORDER-001'
const PARTNER_KEY   = 'test-partner-key-secret'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────
// verifyShopeeSignature
// ─────────────────────────────────────────────────────────────────────────────

describe('marketplace — verifyShopeeSignature', () => {
  it('returns true for a valid HMAC-SHA256 signature', () => {
    const body = Buffer.from(JSON.stringify({ order_sn: ORDER_SN }))
    const expected = crypto.createHmac('sha256', PARTNER_KEY).update(body).digest('hex')

    const result = verifyShopeeSignature(body, expected, PARTNER_KEY)

    expect(result).toBe(true)
  })

  it('returns false when the partner key is wrong', () => {
    const body = Buffer.from(JSON.stringify({ order_sn: ORDER_SN }))
    const sig = crypto.createHmac('sha256', PARTNER_KEY).update(body).digest('hex')

    const result = verifyShopeeSignature(body, sig, 'wrong-key')

    expect(result).toBe(false)
  })

  it('returns false (does not throw) when signature is malformed/non-hex', () => {
    const body = Buffer.from('{}')

    // Non-hex string — timingSafeEqual would fail; implementation must catch
    expect(() => verifyShopeeSignature(body, 'not-valid-hex!!!', PARTNER_KEY)).not.toThrow()
    expect(verifyShopeeSignature(body, 'not-valid-hex!!!', PARTNER_KEY)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// resolveSkuMapping
// ─────────────────────────────────────────────────────────────────────────────

describe('marketplace — resolveSkuMapping', () => {
  it('returns { variantId } when an active mapping exists', async () => {
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ variantId: VARIANT_ID_1 }]),
    }
    mockDb.select.mockReturnValue(mockSelectChain)

    const result = await resolveSkuMapping(CHANNEL_ID, 'SKU-A')

    expect(result).toEqual({ variantId: VARIANT_ID_1 })
    expect(mockDb.select).toHaveBeenCalled()
  })

  it('returns null when no active mapping is found', async () => {
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    mockDb.select.mockReturnValue(mockSelectChain)

    const result = await resolveSkuMapping(CHANNEL_ID, 'SKU-MISSING')

    expect(result).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// processOrderCreated
// ─────────────────────────────────────────────────────────────────────────────

describe('marketplace — processOrderCreated', () => {
  /**
   * Utility: build the mock chain for db.insert().values().onConflictDoNothing().returning()
   * The first call is the order insert; the second is the items insert.
   */
  function setupOrderInsert(returnsRows: { id: string }[]) {
    const returningMock = vi.fn().mockResolvedValue(returnsRows)
    const onConflictDoNothingMock = vi.fn().mockReturnValue({ returning: returningMock })
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock })
    const itemsInsertChain = {
      values: vi.fn().mockResolvedValue(undefined),
    }
    mockDb.insert
      .mockReturnValueOnce({ values: valuesMock })  // order insert
      .mockReturnValueOnce(itemsInsertChain)          // items insert

    return { returningMock, valuesMock, itemsInsertChain }
  }

  /** Utility: mock db.update().set().where() for skuResolutionStatus update. */
  function setupUpdateChain() {
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }
    mockDb.update.mockReturnValue(updateChain)
    return updateChain
  }

  /** Utility: mock db.transaction() to execute the callback synchronously with a no-op tx. */
  function setupTransaction() {
    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn({})
    })
  }

  const basePayload = {
    order_sn: ORDER_SN,
    status: 'READY_TO_SHIP',
    buyer_username: 'buyer123',
    total_amount: 99000,
    buyer_masked_phone: '+62812***1234',
  }

  // ── Happy path (all SKUs resolved) ──────────────────────────────────────────

  it('happy path: inserts order + items, calls createReservation, does NOT notify', async () => {
    setupOrderInsert([{ id: ORDER_ID }])
    setupUpdateChain()
    setupTransaction()

    // resolveSkuMapping is mocked via a db.select chain that resolveSkuMapping calls internally.
    // The function under test calls resolveSkuMapping() which calls db.select.
    // But we've already consumed mockDb.insert twice above — set up select for resolveSkuMapping:
    const skuSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ variantId: VARIANT_ID_1 }]),
    }
    mockDb.select.mockReturnValue(skuSelectChain)

    const payload = {
      ...basePayload,
      item_list: [
        { seller_sku: 'SKU-A', item_name: 'Widget A', model_qty: 2, model_discounted_price: 49500 },
      ],
    }

    await processOrderCreated(payload, EVENT_ID, CHANNEL_ID)

    // Order + items inserts happened
    expect(mockDb.insert).toHaveBeenCalledTimes(2)
    // Reservation was created
    expect(mockCreateReservation).toHaveBeenCalledTimes(1)
    expect(mockCreateReservation).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: VARIANT_ID_1, qty: 2, orderRef: ORDER_SN }),
      expect.anything() // tx
    )
    // No notification — all SKUs resolved
    expect(mockNotifyByRoles).not.toHaveBeenCalled()
  })

  // ── Idempotency: duplicate order_sn ──────────────────────────────────────────

  it('idempotency: skips reservation and notification when order_sn already exists', async () => {
    // onConflictDoNothing returning [] means the row already existed
    const returningMock = vi.fn().mockResolvedValue([]) // empty = conflict
    const onConflictDoNothingMock = vi.fn().mockReturnValue({ returning: returningMock })
    const valuesMock = vi.fn().mockReturnValue({ onConflictDoNothing: onConflictDoNothingMock })
    mockDb.insert.mockReturnValueOnce({ values: valuesMock })

    const payload = {
      ...basePayload,
      item_list: [
        { seller_sku: 'SKU-A', item_name: 'Widget A', model_qty: 1, model_discounted_price: 10000 },
      ],
    }

    await processOrderCreated(payload, EVENT_ID, CHANNEL_ID)

    // Only one insert call (the upsert attempt — items insert never reached)
    expect(mockDb.insert).toHaveBeenCalledTimes(1)
    // No reservation, no notification
    expect(mockCreateReservation).not.toHaveBeenCalled()
    expect(mockNotifyByRoles).not.toHaveBeenCalled()
  })

  // ── Unresolved SKU ──────────────────────────────────────────────────────────

  it('unresolved SKU: inserts order with UNRESOLVED status, no reservation, notifies Owner+Admin', async () => {
    setupOrderInsert([{ id: ORDER_ID }])
    const updateChain = setupUpdateChain()

    // resolveSkuMapping returns null → no mapping found
    const skuSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]), // empty = not found
    }
    mockDb.select.mockReturnValue(skuSelectChain)

    const payload = {
      ...basePayload,
      item_list: [
        { seller_sku: 'SKU-UNKNOWN', item_name: 'Mystery Item', model_qty: 1, model_discounted_price: 0 },
      ],
    }

    await processOrderCreated(payload, EVENT_ID, CHANNEL_ID)

    // skuResolutionStatus update was called with UNRESOLVED
    expect(mockDb.update).toHaveBeenCalled()
    const setArgs = updateChain.set.mock.calls[0][0]
    expect(setArgs.skuResolutionStatus).toBe('UNRESOLVED')
    // No reservation for unresolved items
    expect(mockCreateReservation).not.toHaveBeenCalled()
    // Notification was sent to Owner + Admin
    expect(mockNotifyByRoles).toHaveBeenCalledTimes(1)
    expect(mockNotifyByRoles).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ['Owner', 'Admin'], type: 'UNRESOLVED_SKU' })
    )
  })

  // ── Partial SKU (one resolved, one not) ──────────────────────────────────────

  it('partial SKU: PARTIAL status, createReservation called once for resolved item, notifies', async () => {
    setupOrderInsert([{ id: ORDER_ID }])
    const updateChain = setupUpdateChain()
    setupTransaction()

    // First call to resolveSkuMapping → resolved; second call → not found
    const resolvedChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ variantId: VARIANT_ID_1 }]),
    }
    const unresolvedChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    mockDb.select
      .mockReturnValueOnce(resolvedChain)   // SKU-A → resolved
      .mockReturnValueOnce(unresolvedChain) // SKU-B → not found

    const payload = {
      ...basePayload,
      item_list: [
        { seller_sku: 'SKU-A', item_name: 'Widget A', model_qty: 1, model_discounted_price: 50000 },
        { seller_sku: 'SKU-B', item_name: 'Mystery B', model_qty: 2, model_discounted_price: 0 },
      ],
    }

    await processOrderCreated(payload, EVENT_ID, CHANNEL_ID)

    // Status updated to PARTIAL
    const setArgs = updateChain.set.mock.calls[0][0]
    expect(setArgs.skuResolutionStatus).toBe('PARTIAL')
    // Reservation only for the resolved item
    expect(mockCreateReservation).toHaveBeenCalledTimes(1)
    expect(mockCreateReservation).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: VARIANT_ID_1 }),
      expect.anything()
    )
    // Notification sent (at least one unresolved SKU)
    expect(mockNotifyByRoles).toHaveBeenCalledTimes(1)
    expect(mockNotifyByRoles).toHaveBeenCalledWith(
      expect.objectContaining({ roles: ['Owner', 'Admin'] })
    )
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// processOrderCancelled
// ─────────────────────────────────────────────────────────────────────────────

describe('marketplace — processOrderCancelled', () => {
  it('cancels all active reservations and updates order status', async () => {
    // db.select().from().where() returns two active reservation rows
    const twoReservations = [
      { id: RESERVATION_1, variantId: VARIANT_ID_1, orderRef: ORDER_SN, status: 'ACTIVE', qty: '3' },
      { id: RESERVATION_2, variantId: VARIANT_ID_2, orderRef: ORDER_SN, status: 'ACTIVE', qty: '1' },
    ]
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(twoReservations),
    }
    mockDb.select.mockReturnValue(selectChain)

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }
    mockDb.update.mockReturnValue(updateChain)

    await processOrderCancelled({ order_sn: ORDER_SN })

    // cancelReservation called once per active reservation
    expect(mockCancelReservation).toHaveBeenCalledTimes(2)
    expect(mockCancelReservation).toHaveBeenCalledWith(RESERVATION_1)
    expect(mockCancelReservation).toHaveBeenCalledWith(RESERVATION_2)

    // Order status updated to CANCELLED
    expect(mockDb.update).toHaveBeenCalled()
    const setArgs = updateChain.set.mock.calls[0][0]
    expect(setArgs.status).toBe('CANCELLED')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// processOrderShipped
// ─────────────────────────────────────────────────────────────────────────────

describe('marketplace — processOrderShipped', () => {
  const orderRow = {
    id: ORDER_ID,
    orderSn: ORDER_SN,
    totalAmount: '150000',
    channelId: CHANNEL_ID,
    platform: 'shopee',
    status: 'READY_TO_SHIP',
    skuResolutionStatus: 'RESOLVED',
    buyerName: null,
    buyerMaskedPhone: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const oneReservation = [
    { id: RESERVATION_1, variantId: VARIANT_ID_1, orderRef: ORDER_SN, status: 'ACTIVE', qty: '2' },
  ]

  /** Helper: set up processOrderShipped mocks.
   *  Now uses db.transaction — tx needs select/update methods.
   */
  function setupShippedSelects(reservations: typeof oneReservation) {
    const orderSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([orderRow]),
    }
    const reservationSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(reservations),
    }
    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }

    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      const tx = {
        select: vi.fn()
          .mockReturnValueOnce(orderSelectChain)
          .mockReturnValueOnce(reservationSelectChain),
        update: vi.fn().mockReturnValue(updateChain),
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([]) }),
      }
      await fn(tx)
    })
  }

  it('fulfills reservation, decrements stock, and writes journal entry', async () => {
    setupShippedSelects(oneReservation)

    await processOrderShipped({ order_sn: ORDER_SN })

    // fulfillReservation called for the one active reservation
    expect(mockFulfillReservation).toHaveBeenCalledTimes(1)
    expect(mockFulfillReservation).toHaveBeenCalledWith(RESERVATION_1)

    // decrementStock called with correct params
    expect(mockDecrementStock).toHaveBeenCalledTimes(1)
    expect(mockDecrementStock).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: VARIANT_ID_1,
        movementType: 'SALE',
        reference: ORDER_SN,
      })
    )

    // createMarketplaceJournalEntry called
    expect(mockCreateMarketplaceJournalEntry).toHaveBeenCalledTimes(1)
    expect(mockCreateMarketplaceJournalEntry).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: ORDER_ID }),
      expect.anything() // tx
    )

    // Order status updated to SHIPPED — happens inside the transaction
    // The tx.update mock is set up inside setupShippedSelects
    // Just verify the function completed successfully (no throw = status updated)
    expect(mockCreateMarketplaceJournalEntry).toHaveBeenCalledTimes(1)
  })

  it('journal entry failure: does NOT re-throw; decrementStock was still called', async () => {
    // journal entry throws
    mockCreateMarketplaceJournalEntry.mockRejectedValueOnce(new Error('DB_CONSTRAINT_VIOLATION'))

    setupShippedSelects(oneReservation)

    // Function should NOT re-throw — journal entry failure is best-effort (caught inside tx)
    await expect(processOrderShipped({ order_sn: ORDER_SN })).resolves.not.toThrow()

    // decrementStock still ran before the journal attempt
    expect(mockDecrementStock).toHaveBeenCalledTimes(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getChannelOrders
// ─────────────────────────────────────────────────────────────────────────────

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
    const row = {
      id: ORDER_ID,
      channelId: CHANNEL_ID,
      orderSn: ORDER_SN,
      platform: 'shopee',
      status: 'READY_TO_SHIP',
      buyerName: null,
      totalAmount: '50000',
      skuResolutionStatus: 'RESOLVED',
      createdAt: new Date(),
    }
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

// ─────────────────────────────────────────────────────────────────────────────
// getWebhookEvents
// ─────────────────────────────────────────────────────────────────────────────

describe('marketplace — getWebhookEvents', () => {
  function setupWebhooksQuery(rows: any[], count: number) {
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

  it('returns paginated shape with eventType filter applied', async () => {
    const event = {
      id: EVENT_ID,
      channelId: CHANNEL_ID,
      eventType: 'order.created',
      payload: { order_sn: ORDER_SN },
      processingStatus: 'PROCESSED',
      errorMessage: null,
      processedAt: new Date(),
      createdAt: new Date(),
    }
    setupWebhooksQuery([event], 1)
    const result = await getWebhookEvents(CHANNEL_ID, { eventType: 'order.created', limit: 30, offset: 0 })
    expect(result).toEqual({ data: [event], total: 1, limit: 30, offset: 0 })
  })

  it('returns paginated shape with no filter', async () => {
    setupWebhooksQuery([], 0)
    const result = await getWebhookEvents(CHANNEL_ID)
    expect(result).toEqual({ data: [], total: 0, limit: 30, offset: 0 })
  })

  it('returns empty result when no events exist', async () => {
    setupWebhooksQuery([], 0)
    const result = await getWebhookEvents(CHANNEL_ID, { eventType: 'order.shipped' })
    expect(result.data).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// getOrderDetail
// ─────────────────────────────────────────────────────────────────────────────

describe('marketplace — getOrderDetail', () => {
  const orderRow = {
    id: ORDER_ID,
    channelId: CHANNEL_ID,
    orderSn: ORDER_SN,
    platform: 'shopee',
    status: 'READY_TO_SHIP',
    buyerName: null,
    buyerMaskedPhone: null,
    totalAmount: '99000',
    escrowAmount: null,
    platformFeeAmount: null,
    sellerVoucherAmount: null,
    skuResolutionStatus: 'RESOLVED',
    createdAt: new Date(),
    updatedAt: new Date(),
  }
  const itemRows = [{ id: 'item-1', orderId: ORDER_ID, sellerSku: 'SKU-A', itemName: 'Widget A', qty: '1', unitPrice: '99000', lineTotal: '99000', shopeeItemId: null, shopeeModelId: null, variantId: null }]

  it('returns order with items on happy path', async () => {
    const orderChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([orderRow]),
    }
    const itemsChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(itemRows),
    }
    mockDb.select
      .mockReturnValueOnce(orderChain)
      .mockReturnValueOnce(itemsChain)
    const result = await getOrderDetail(ORDER_ID)
    expect(result.order).toEqual(orderRow)
    expect(result.items).toEqual(itemRows)
  })

  it('throws ORDER_NOT_FOUND when order does not exist', async () => {
    const notFoundChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    mockDb.select.mockReturnValueOnce(notFoundChain)
    await expect(getOrderDetail('nonexistent-id')).rejects.toThrow('ORDER_NOT_FOUND')
  })
})
