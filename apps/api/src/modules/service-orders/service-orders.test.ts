import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mock vars are available in the hoisted vi.mock factory
const { mockDbSelect, mockDbInsert, mockDbUpdate, mockDbDelete, mockDbTransaction, mockVehicle, mockServiceCatalogItem, mockCreateAccrualJournalEntry, mockCreateCashReceiptJournalEntry } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
  mockDbTransaction: vi.fn(),
  mockVehicle: {
    id: '22222222-2222-2222-2222-222222222222',
    customerId: '11111111-1111-1111-1111-111111111111',
    plateNumber: 'B 1234 XYZ',
    vehicleType: 'MOBIL',
    brand: 'Toyota',
    model: 'Avanza',
    year: 2022,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  mockServiceCatalogItem: {
    id: '66666666-6666-6666-6666-666666666666',
    name: 'Ganti Oli',
    description: 'Ganti oli mesin',
    defaultPrice: 50000,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  mockCreateAccrualJournalEntry: vi.fn().mockResolvedValue(undefined),
  mockCreateCashReceiptJournalEntry: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
    transaction: mockDbTransaction,
  },
}))

vi.mock('../../middleware/audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../vehicles/vehicles.service.js', () => ({
  getVehicleById: vi.fn().mockResolvedValue(mockVehicle),
}))

vi.mock('../service-catalog/service-catalog.service.js', () => ({
  getServiceItemById: vi.fn().mockResolvedValue(mockServiceCatalogItem),
}))

vi.mock('../inventory/movement.service.js', () => ({
  recordMovement: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../inventory/stock.service.js', () => ({
  invalidateStockCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../accounting/accounting.service.js', () => ({
  createAccrualJournalEntry: mockCreateAccrualJournalEntry,
  createCashReceiptJournalEntry: mockCreateCashReceiptJournalEntry,
}))

import {
  createServiceOrder,
  getServiceOrderById,
  getOpenServiceOrders,
  updateWorkStatus,
  assignMechanic,
  updateEstimate,
  addLineItem,
  removeLineItem,
  getLineItems,
  completeServiceOrder,
  recordServicePayment,
  getReceivables,
  getServiceHistory,
} from './service-orders.service.js'
import { getVehicleById } from '../vehicles/vehicles.service.js'
import { getServiceItemById } from '../service-catalog/service-catalog.service.js'
import { recordMovement } from '../inventory/movement.service.js'
import { invalidateStockCache } from '../inventory/stock.service.js'

const ORDER_ID = '33333333-3333-3333-3333-333333333333'
const USER_ID = '44444444-4444-4444-4444-444444444444'
const VEHICLE_ID = '22222222-2222-2222-2222-222222222222'
const MECHANIC_ID = '55555555-5555-5555-5555-555555555555'

const mockOrder = {
  id: ORDER_ID,
  orderNumber: 'SO-20260321-AB12',
  vehicleId: VEHICLE_ID,
  mechanicId: null,
  workStatus: 'BOOKING',
  paymentStatus: 'UNPAID',
  complaint: null,
  estimatedCompletionAt: null,
  estimatedCost: null,
  bookingDate: null,
  checkedInAt: null,
  completedAt: null,
  createdBy: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('service-orders service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset getVehicleById to default resolved value after clearAllMocks
    ;(getVehicleById as any).mockResolvedValue(mockVehicle)
    ;(getServiceItemById as any).mockResolvedValue(mockServiceCatalogItem)
  })

  describe('BKL-07: createServiceOrder walk-in', () => {
    it('creates order with workStatus BOOKING, paymentStatus UNPAID, calls logAudit CREATE', async () => {
      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockOrder]),
        }),
      })

      const result = await createServiceOrder(
        { vehicleId: VEHICLE_ID, createdBy: USER_ID },
        USER_ID,
        '127.0.0.1',
      )

      expect(result).toMatchObject({ workStatus: 'BOOKING', paymentStatus: 'UNPAID', vehicleId: VEHICLE_ID })
      expect(getVehicleById).toHaveBeenCalledWith(VEHICLE_ID)

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          tableName: 'service_orders',
        }),
      )
    })
  })

  describe('BKL-07: createServiceOrder booking', () => {
    it('sets bookingDate, workStatus BOOKING', async () => {
      const bookingDate = '2026-03-25T09:00:00.000Z'
      const orderWithBooking = { ...mockOrder, bookingDate: new Date(bookingDate) }

      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([orderWithBooking]),
        }),
      })

      const result = await createServiceOrder(
        { vehicleId: VEHICLE_ID, createdBy: USER_ID, bookingDate },
        USER_ID,
        '127.0.0.1',
      )

      expect(result).toMatchObject({ workStatus: 'BOOKING' })
      expect(result.bookingDate).toBeTruthy()
    })
  })

  describe('BKL-06: createServiceOrder vehicle-not-found', () => {
    it('throws VEHICLE_NOT_FOUND when vehicle does not exist', async () => {
      ;(getVehicleById as any).mockRejectedValueOnce(new Error('VEHICLE_NOT_FOUND'))

      await expect(
        createServiceOrder(
          { vehicleId: 'nonexistent-id', createdBy: USER_ID },
          USER_ID,
          '127.0.0.1',
        ),
      ).rejects.toThrow('VEHICLE_NOT_FOUND')
    })
  })

  describe('BKL-05: getServiceOrderById', () => {
    it('returns order when found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      })

      const result = await getServiceOrderById(ORDER_ID)
      expect(result).toMatchObject({ id: ORDER_ID, orderNumber: 'SO-20260321-AB12' })
    })

    it('throws SERVICE_ORDER_NOT_FOUND when not found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(getServiceOrderById('nonexistent-id')).rejects.toThrow('SERVICE_ORDER_NOT_FOUND')
    })
  })

  describe('BKL-05: getOpenServiceOrders', () => {
    it('returns non-completed orders', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockOrder]),
        }),
      })

      const result = await getOpenServiceOrders()
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ workStatus: 'BOOKING' })
    })
  })

  describe('BKL-05: updateWorkStatus', () => {
    it('valid transition BOOKING→CHECKED_IN — sets checkedInAt, calls logAudit UPDATE', async () => {
      const updatedOrder = { ...mockOrder, workStatus: 'CHECKED_IN', checkedInAt: new Date() }

      // getServiceOrderById select
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      })

      // update returning
      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedOrder]),
          }),
        }),
      })

      const result = await updateWorkStatus(ORDER_ID, 'CHECKED_IN', USER_ID, '127.0.0.1')

      expect(result).toMatchObject({ workStatus: 'CHECKED_IN' })
      expect(result.checkedInAt).toBeTruthy()

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          tableName: 'service_orders',
          oldValue: expect.objectContaining({ workStatus: 'BOOKING' }),
          newValue: expect.objectContaining({ workStatus: 'CHECKED_IN' }),
        }),
      )
    })

    it('COMPLETED — sets completedAt timestamp', async () => {
      const inProgressOrder = { ...mockOrder, workStatus: 'IN_PROGRESS' }
      const completedOrder = { ...mockOrder, workStatus: 'COMPLETED', completedAt: new Date() }

      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([inProgressOrder]),
          }),
        }),
      })

      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([completedOrder]),
          }),
        }),
      })

      const result = await updateWorkStatus(ORDER_ID, 'COMPLETED', USER_ID, '127.0.0.1')

      expect(result).toMatchObject({ workStatus: 'COMPLETED' })
      expect(result.completedAt).toBeTruthy()
    })

    it('invalid transition BOOKING→IN_PROGRESS — throws INVALID_STATUS_TRANSITION', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      })

      await expect(
        updateWorkStatus(ORDER_ID, 'IN_PROGRESS', USER_ID, '127.0.0.1'),
      ).rejects.toThrow('INVALID_STATUS_TRANSITION')
    })
  })

  describe('BKL-08: assignMechanic', () => {
    it('updates mechanicId, calls logAudit UPDATE', async () => {
      const updatedOrder = { ...mockOrder, mechanicId: MECHANIC_ID }

      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      })

      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedOrder]),
          }),
        }),
      })

      const result = await assignMechanic(ORDER_ID, MECHANIC_ID, USER_ID, '127.0.0.1')

      expect(result).toMatchObject({ mechanicId: MECHANIC_ID })

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          tableName: 'service_orders',
        }),
      )
    })
  })

  describe('BKL-09: updateEstimate', () => {
    it('updates estimate fields, calls logAudit UPDATE', async () => {
      const updatedOrder = {
        ...mockOrder,
        estimatedCompletionAt: new Date('2026-03-28T17:00:00.000Z'),
        estimatedCost: 500000,
      }

      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockOrder]),
          }),
        }),
      })

      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedOrder]),
          }),
        }),
      })

      const result = await updateEstimate(
        ORDER_ID,
        { estimatedCompletionAt: '2026-03-28T17:00:00.000Z', estimatedCost: 500000 },
        USER_ID,
        '127.0.0.1',
      )

      expect(result).toMatchObject({ estimatedCost: 500000 })
      expect(result.estimatedCompletionAt).toBeTruthy()

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          tableName: 'service_orders',
        }),
      )
    })
  })

  // --- Line Item Tests ---

  const CATALOG_ITEM_ID = '66666666-6666-6666-6666-666666666666'
  const VARIANT_ID = '77777777-7777-7777-7777-777777777777'
  const ITEM_ID = '88888888-8888-8888-8888-888888888888'

  const mockLineItem = {
    id: ITEM_ID,
    serviceOrderId: ORDER_ID,
    itemType: 'SERVICE',
    catalogItemId: CATALOG_ITEM_ID,
    variantId: null,
    description: 'Ganti Oli',
    qty: 1,
    unitPrice: 50000,
    lineTotal: 50000,
  }

  // Helper to mock getServiceOrderById (a select call inside addLineItem/removeLineItem)
  function mockGetOrderSelect(order = mockOrder) {
    mockDbSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([order]),
        }),
      }),
    })
  }

  describe('BKL-10: addLineItem', () => {
    it('SERVICE type with catalog default price', async () => {
      mockGetOrderSelect()
      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockLineItem]),
        }),
      })

      const result = await addLineItem(
        { serviceOrderId: ORDER_ID, itemType: 'SERVICE', catalogItemId: CATALOG_ITEM_ID, qty: 1 },
        USER_ID,
        '127.0.0.1',
      )

      expect(result).toMatchObject({ description: 'Ganti Oli', unitPrice: 50000, lineTotal: 50000 })
      expect(getServiceItemById).toHaveBeenCalledWith(CATALOG_ITEM_ID)

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          tableName: 'service_order_items',
        }),
      )
    })

    it('SERVICE type with overridden price (BKL-11 hybrid pricing)', async () => {
      const overriddenItem = { ...mockLineItem, unitPrice: 75000, lineTotal: 75000 }

      mockGetOrderSelect()
      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([overriddenItem]),
        }),
      })

      const result = await addLineItem(
        { serviceOrderId: ORDER_ID, itemType: 'SERVICE', catalogItemId: CATALOG_ITEM_ID, qty: 1, unitPrice: 75000 },
        USER_ID,
        '127.0.0.1',
      )

      expect(result).toMatchObject({ unitPrice: 75000, lineTotal: 75000 })
      // Still validates catalog item exists
      expect(getServiceItemById).toHaveBeenCalledWith(CATALOG_ITEM_ID)
    })

    it('PART type with variantId', async () => {
      const partItem = {
        ...mockLineItem,
        itemType: 'PART',
        catalogItemId: null,
        variantId: VARIANT_ID,
        description: 'Busi NGK CR7',
        unitPrice: 25000,
        qty: 4,
        lineTotal: 100000,
      }

      mockGetOrderSelect()
      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([partItem]),
        }),
      })

      const result = await addLineItem(
        { serviceOrderId: ORDER_ID, itemType: 'PART', variantId: VARIANT_ID, description: 'Busi NGK CR7', qty: 4, unitPrice: 25000 },
        USER_ID,
        '127.0.0.1',
      )

      expect(result).toMatchObject({ itemType: 'PART', variantId: VARIANT_ID, qty: 4, unitPrice: 25000, lineTotal: 100000 })
      // Should NOT call getServiceItemById for PART type
      expect(getServiceItemById).not.toHaveBeenCalled()
    })

    it('throws SERVICE_ORDER_NOT_FOUND for invalid order', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(
        addLineItem(
          { serviceOrderId: 'nonexistent-id', itemType: 'SERVICE', catalogItemId: CATALOG_ITEM_ID, qty: 1 },
          USER_ID,
          '127.0.0.1',
        ),
      ).rejects.toThrow('SERVICE_ORDER_NOT_FOUND')
    })

    it('SERVICE validates catalog item exists', async () => {
      mockGetOrderSelect()
      ;(getServiceItemById as any).mockRejectedValueOnce(new Error('SERVICE_CATALOG_ITEM_NOT_FOUND'))

      await expect(
        addLineItem(
          { serviceOrderId: ORDER_ID, itemType: 'SERVICE', catalogItemId: 'bad-catalog-id', qty: 1 },
          USER_ID,
          '127.0.0.1',
        ),
      ).rejects.toThrow('SERVICE_CATALOG_ITEM_NOT_FOUND')
    })
  })

  describe('BKL-10: removeLineItem', () => {
    it('deletes item and calls logAudit DELETE', async () => {
      // select to find item
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockLineItem]),
          }),
        }),
      })

      // delete returning
      mockDbDelete.mockReturnValueOnce({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockLineItem]),
        }),
      })

      const result = await removeLineItem(
        { serviceOrderId: ORDER_ID, itemId: ITEM_ID },
        USER_ID,
        '127.0.0.1',
      )

      expect(result).toMatchObject({ id: ITEM_ID })

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DELETE',
          tableName: 'service_order_items',
        }),
      )
    })

    it('throws LINE_ITEM_NOT_FOUND for wrong order', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(
        removeLineItem(
          { serviceOrderId: ORDER_ID, itemId: 'wrong-item-id' },
          USER_ID,
          '127.0.0.1',
        ),
      ).rejects.toThrow('LINE_ITEM_NOT_FOUND')
    })
  })

  describe('BKL-10: getLineItems', () => {
    it('returns items for order', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockLineItem]),
        }),
      })

      const result = await getLineItems(ORDER_ID)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ serviceOrderId: ORDER_ID, description: 'Ganti Oli' })
    })

    it('returns empty array when no items', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      const result = await getLineItems(ORDER_ID)
      expect(result).toHaveLength(0)
    })
  })

  // --- completeServiceOrder Tests (BKL-12) ---

  const VARIANT_ID_2 = '99999999-9999-9999-9999-999999999999'

  const mockPartItem = {
    id: ITEM_ID,
    serviceOrderId: ORDER_ID,
    itemType: 'PART',
    catalogItemId: null,
    variantId: VARIANT_ID,
    description: 'Busi NGK CR7',
    qty: 4,
    unitPrice: 25000,
    lineTotal: 100000,
  }

  const mockServiceItem = {
    id: 'aaaa1111-aaaa-1111-aaaa-111111111111',
    serviceOrderId: ORDER_ID,
    itemType: 'SERVICE',
    catalogItemId: CATALOG_ITEM_ID,
    variantId: null,
    description: 'Ganti Oli',
    qty: 1,
    unitPrice: 50000,
    lineTotal: 50000,
  }

  const inProgressOrder = { ...mockOrder, workStatus: 'IN_PROGRESS' }
  const completedOrder = { ...mockOrder, workStatus: 'COMPLETED', completedAt: new Date() }

  /**
   * Creates a mock transaction implementation. The `fn` callback receives a tx object
   * that mimics the drizzle tx with chained select/update/execute methods.
   * `txSelectResults` is an array of results returned by successive tx.select() calls.
   * `txExecuteResults` is an array of results returned by successive tx.execute() calls.
   * `txUpdateResult` is the result returned by tx.update().
   */
  function createTxMock(opts: {
    txSelectResults: any[]
    txExecuteResults?: any[]
    txUpdateResult?: any
  }) {
    const { txSelectResults, txExecuteResults = [], txUpdateResult = completedOrder } = opts
    let selectCallIdx = 0
    let executeCallIdx = 0

    mockDbTransaction.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn().mockImplementation(() => {
          const result = txSelectResults[selectCallIdx++]
          // Build the where() mock: .limit() chain for order fetch, direct resolve for line items
          if (result.hasLimit !== false) {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue(result.rows),
                }),
              }),
            }
          } else {
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockResolvedValue(result.rows),
              }),
            }
          }
        }),
        execute: vi.fn().mockImplementation(async () => {
          return txExecuteResults[executeCallIdx++] ?? undefined
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([txUpdateResult]),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([]),
          }),
        }),
      }
      return fn(tx)
    })
  }

  describe('BKL-12: completeServiceOrder', () => {
    it('PART items — decrements stock, calls recordMovement + invalidateStockCache', async () => {
      createTxMock({
        txSelectResults: [
          // 1st select: fetch order (with .limit)
          { rows: [inProgressOrder], hasLimit: true },
          // 2nd select: fetch line items (no .limit)
          { rows: [mockServiceItem, mockPartItem], hasLimit: false },
        ],
        txExecuteResults: [
          // FOR UPDATE: stock check
          [{ stock_qty: 100 }],
          // raw SQL decrement
          undefined,
        ],
      })

      const result = await completeServiceOrder(ORDER_ID, USER_ID, '127.0.0.1')

      expect(result).toMatchObject({ workStatus: 'COMPLETED' })

      // recordMovement called inside tx with SALE type
      expect(recordMovement).toHaveBeenCalledWith(
        expect.objectContaining({
          variantId: VARIANT_ID,
          movementType: 'SALE',
          qty: 4,
          reference: ORDER_ID,
          performedBy: USER_ID,
        }),
        expect.anything(), // tx object
      )

      // invalidateStockCache called AFTER transaction
      expect(invalidateStockCache).toHaveBeenCalledWith(VARIANT_ID)

      // logAudit called for completion
      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          tableName: 'service_orders',
          newValue: expect.objectContaining({ workStatus: 'COMPLETED' }),
        }),
      )
    })

    it('SERVICE-only order completes without inventory calls', async () => {
      createTxMock({
        txSelectResults: [
          { rows: [inProgressOrder], hasLimit: true },
          { rows: [mockServiceItem], hasLimit: false },
        ],
        txExecuteResults: [],
      })

      const result = await completeServiceOrder(ORDER_ID, USER_ID, '127.0.0.1')

      expect(result).toMatchObject({ workStatus: 'COMPLETED' })
      expect(recordMovement).not.toHaveBeenCalled()
      expect(invalidateStockCache).not.toHaveBeenCalled()
    })

    it('throws ORDER_NOT_IN_PROGRESS when order is BOOKING', async () => {
      createTxMock({
        txSelectResults: [
          { rows: [mockOrder], hasLimit: true }, // mockOrder has workStatus 'BOOKING'
        ],
      })

      await expect(
        completeServiceOrder(ORDER_ID, USER_ID, '127.0.0.1'),
      ).rejects.toThrow('ORDER_NOT_IN_PROGRESS')
    })

    it('throws SERVICE_ORDER_NOT_FOUND when order does not exist', async () => {
      createTxMock({
        txSelectResults: [
          { rows: [], hasLimit: true },
        ],
      })

      await expect(
        completeServiceOrder('nonexistent-id', USER_ID, '127.0.0.1'),
      ).rejects.toThrow('SERVICE_ORDER_NOT_FOUND')
    })

    it('throws INSUFFICIENT_STOCK when stock is too low', async () => {
      createTxMock({
        txSelectResults: [
          { rows: [inProgressOrder], hasLimit: true },
          { rows: [mockPartItem], hasLimit: false },
        ],
        txExecuteResults: [
          // FOR UPDATE: stock_qty is 1 but item.qty is 4
          [{ stock_qty: 1 }],
        ],
      })

      await expect(
        completeServiceOrder(ORDER_ID, USER_ID, '127.0.0.1'),
      ).rejects.toThrow('INSUFFICIENT_STOCK')

      // No inventory calls should have happened
      expect(recordMovement).not.toHaveBeenCalled()
    })

    it('cache invalidation deduplicated per unique variantId', async () => {
      const partItem2 = { ...mockPartItem, id: 'bbbb2222-bbbb-2222-bbbb-222222222222', qty: 2 }

      createTxMock({
        txSelectResults: [
          { rows: [inProgressOrder], hasLimit: true },
          // Two PART items with the same variantId
          { rows: [mockPartItem, partItem2], hasLimit: false },
        ],
        txExecuteResults: [
          // Loop 1 (FOR UPDATE): item 1, then item 2
          [{ stock_qty: 100 }],
          [{ stock_qty: 100 }],
          // Loop 2 (raw SQL decrement): item 1, then item 2
          undefined,
          undefined,
        ],
      })

      await completeServiceOrder(ORDER_ID, USER_ID, '127.0.0.1')

      // recordMovement called twice (once per PART item)
      expect(recordMovement).toHaveBeenCalledTimes(2)

      // invalidateStockCache called once (deduplicated — same variantId)
      expect(invalidateStockCache).toHaveBeenCalledTimes(1)
      expect(invalidateStockCache).toHaveBeenCalledWith(VARIANT_ID)
    })

    it('logAudit called with COMPLETED transition details', async () => {
      createTxMock({
        txSelectResults: [
          { rows: [inProgressOrder], hasLimit: true },
          { rows: [], hasLimit: false }, // no line items
        ],
      })

      await completeServiceOrder(ORDER_ID, USER_ID, '127.0.0.1')

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: USER_ID,
          action: 'UPDATE',
          tableName: 'service_orders',
          recordId: ORDER_ID,
          oldValue: { workStatus: 'IN_PROGRESS' },
          newValue: { workStatus: 'COMPLETED' },
          ipAddress: '127.0.0.1',
        }),
      )
    })
  })

  // --- BKL-18: Accrual journal on completion ---

  describe('BKL-18: accrual journal on completion', () => {
    it('completeServiceOrder creates accrual journal with correct total', async () => {
      const serviceItemA = { ...mockServiceItem, lineTotal: 50000 }
      const partItemA = { ...mockPartItem, lineTotal: 100000 }

      createTxMock({
        txSelectResults: [
          { rows: [inProgressOrder], hasLimit: true },
          { rows: [serviceItemA, partItemA], hasLimit: false },
        ],
        txExecuteResults: [
          [{ stock_qty: 100 }],
          undefined,
        ],
      })

      await completeServiceOrder(ORDER_ID, USER_ID, '127.0.0.1')

      expect(mockCreateAccrualJournalEntry).toHaveBeenCalledWith(
        { serviceOrderId: ORDER_ID, total: 150000, sourceType: 'SERVICE_COMPLETION' },
        expect.anything(), // tx object
      )
    })

    it('does not create accrual journal when total is 0', async () => {
      createTxMock({
        txSelectResults: [
          { rows: [inProgressOrder], hasLimit: true },
          { rows: [], hasLimit: false }, // no line items — total is 0
        ],
      })

      await completeServiceOrder(ORDER_ID, USER_ID, '127.0.0.1')

      expect(mockCreateAccrualJournalEntry).not.toHaveBeenCalled()
    })
  })

  // --- BKL-19/BKL-20: recordServicePayment ---

  describe('BKL-19/BKL-20: recordServicePayment', () => {
    const completedOrderForPayment = { ...mockOrder, workStatus: 'COMPLETED', completedAt: new Date() }
    const PAYMENT_ID = 'pppp1111-pppp-1111-pppp-111111111111'

    // Helper: mock the sequence of calls recordServicePayment makes:
    // 1. getServiceOrderById — select with limit
    // 2. existing payments select — select without limit (from servicePayments)
    // 3. getLineItems — select without limit (from serviceOrderItems)
    // 4. db.transaction (insert + update)
    function setupPaymentMocks(opts: {
      order?: any
      existingPayments?: any[]
      lineItems?: any[]
      txInsertResult?: any
    }) {
      const {
        order = completedOrderForPayment,
        existingPayments = [],
        lineItems = [{ ...mockServiceItem, lineTotal: 100000 }],
        txInsertResult = { id: PAYMENT_ID, serviceOrderId: ORDER_ID, amount: 50000, method: 'CASH' },
      } = opts

      // 1. getServiceOrderById — select.from.where.limit
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([order]),
          }),
        }),
      })

      // 2. existing payments — select.from.where (no limit)
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(existingPayments),
        }),
      })

      // 3. getLineItems — select.from.where (no limit)
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(lineItems),
        }),
      })

      // 4. db.transaction
      mockDbTransaction.mockImplementation(async (fn: any) => {
        const tx = {
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([txInsertResult]),
            }),
          }),
          update: vi.fn().mockReturnValue({
            set: vi.fn().mockReturnValue({
              where: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }
        return fn(tx)
      })
    }

    it('partial payment transitions paymentStatus to PARTIAL', async () => {
      setupPaymentMocks({
        existingPayments: [],
        lineItems: [{ ...mockServiceItem, lineTotal: 100000 }],
        txInsertResult: { id: PAYMENT_ID, serviceOrderId: ORDER_ID, amount: 50000, method: 'CASH' },
      })

      const result = await recordServicePayment(ORDER_ID, { amount: 50000, method: 'CASH' }, USER_ID, '127.0.0.1')

      expect(result.paymentStatus).toBe('PARTIAL')
    })

    it('full payment transitions paymentStatus to PAID', async () => {
      setupPaymentMocks({
        existingPayments: [],
        lineItems: [{ ...mockServiceItem, lineTotal: 100000 }],
        txInsertResult: { id: PAYMENT_ID, serviceOrderId: ORDER_ID, amount: 100000, method: 'TRANSFER' },
      })

      const result = await recordServicePayment(ORDER_ID, { amount: 100000, method: 'TRANSFER' }, USER_ID, '127.0.0.1')

      expect(result.paymentStatus).toBe('PAID')
    })

    it('second payment completes remaining balance → PAID', async () => {
      setupPaymentMocks({
        existingPayments: [{ id: 'prev-pay', serviceOrderId: ORDER_ID, amount: 60000 }],
        lineItems: [{ ...mockServiceItem, lineTotal: 100000 }],
        txInsertResult: { id: PAYMENT_ID, serviceOrderId: ORDER_ID, amount: 40000, method: 'QRIS' },
      })

      const result = await recordServicePayment(ORDER_ID, { amount: 40000, method: 'QRIS' }, USER_ID, '127.0.0.1')

      expect(result.paymentStatus).toBe('PAID')
    })

    it('rejects overpayment with OVERPAYMENT error', async () => {
      setupPaymentMocks({
        existingPayments: [],
        lineItems: [{ ...mockServiceItem, lineTotal: 100000 }],
      })

      await expect(
        recordServicePayment(ORDER_ID, { amount: 150000, method: 'CASH' }, USER_ID, '127.0.0.1'),
      ).rejects.toThrow('OVERPAYMENT')
    })

    it('rejects payment on non-COMPLETED order with ORDER_NOT_COMPLETED error', async () => {
      // getServiceOrderById returns IN_PROGRESS order
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([inProgressOrder]),
          }),
        }),
      })

      await expect(
        recordServicePayment(ORDER_ID, { amount: 50000, method: 'CASH' }, USER_ID, '127.0.0.1'),
      ).rejects.toThrow('ORDER_NOT_COMPLETED')
    })

    it('createCashReceiptJournalEntry called with correct params', async () => {
      setupPaymentMocks({
        existingPayments: [],
        lineItems: [{ ...mockServiceItem, lineTotal: 100000 }],
        txInsertResult: { id: PAYMENT_ID, serviceOrderId: ORDER_ID, amount: 50000, method: 'CASH' },
      })

      await recordServicePayment(ORDER_ID, { amount: 50000, method: 'CASH' }, USER_ID, '127.0.0.1')

      expect(mockCreateCashReceiptJournalEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          serviceOrderId: ORDER_ID,
          amount: 50000,
        }),
        expect.anything(), // tx
      )
    })

    it('logAudit called for payment creation', async () => {
      setupPaymentMocks({
        existingPayments: [],
        lineItems: [{ ...mockServiceItem, lineTotal: 100000 }],
      })

      await recordServicePayment(ORDER_ID, { amount: 50000, method: 'CASH' }, USER_ID, '127.0.0.1')

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          tableName: 'service_payments',
        }),
      )
    })
  })

  // --- BKL-21: getReceivables ---

  describe('BKL-21: getReceivables', () => {
    it('returns outstanding receivables per customer', async () => {
      // 1. Main query: select from serviceOrders join vehicles join customers
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          innerJoin: vi.fn().mockReturnValue({
            innerJoin: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                $dynamic: vi.fn().mockResolvedValue([
                  {
                    serviceOrderId: ORDER_ID,
                    orderNumber: 'SO-20260321-AB12',
                    customerId: '11111111-1111-1111-1111-111111111111',
                    customerName: 'John Doe',
                    vehicleId: VEHICLE_ID,
                    plateNumber: 'B 1234 XYZ',
                    workStatus: 'COMPLETED',
                    paymentStatus: 'PARTIAL',
                  },
                ]),
              }),
            }),
          }),
        }),
      })

      // 2. Line items for order total
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { lineTotal: 100000 },
            { lineTotal: 50000 },
          ]),
        }),
      })

      // 3. Payments for totalPaid
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([
            { amount: 60000 },
          ]),
        }),
      })

      const result = await getReceivables()

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        serviceOrderId: ORDER_ID,
        total: 150000,
        totalPaid: 60000,
        outstanding: 90000,
      })
    })
  })

  // --- BKL-15/BKL-22: getServiceHistory ---

  describe('BKL-15/BKL-22: getServiceHistory', () => {
    it('returns service history by plate number with paymentStatus', async () => {
      // 1. Find vehicle by plate
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockVehicle]),
          }),
        }),
      })

      // 2. Get orders for vehicle
      const orderA = { ...mockOrder, paymentStatus: 'PAID', createdAt: new Date('2026-01-01') }
      const orderB = { ...mockOrder, paymentStatus: 'UNPAID', createdAt: new Date('2026-03-01') }
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([orderA, orderB]),
        }),
      })

      const result = await getServiceHistory('B 1234 XYZ')

      expect(result).toHaveLength(2)
      // Should be sorted DESC by createdAt — orderB (March) first
      expect(result[0].paymentStatus).toBe('UNPAID')
      expect(result[1].paymentStatus).toBe('PAID')
    })

    it('returns empty array when vehicle not found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      const result = await getServiceHistory('Z 9999 XXX')
      expect(result).toHaveLength(0)
    })
  })
})
