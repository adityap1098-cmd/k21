import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DB before importing services
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

vi.mock('../../queues/lowstock.queue.js', () => ({
  lowStockQueue: { add: vi.fn().mockResolvedValue(undefined) },
}))

// Mock the redis client used in stock.service
vi.mock('../../queues/redis.js', () => ({
  bullmqRedis: {},
  cacheRedis: {},
  cacheRedisClient: {
    get: vi.fn(),
    setex: vi.fn(),
    del: vi.fn(),
  },
}))

import { db } from '../../db/index.js'
import { cacheRedisClient } from '../../queues/redis.js'
import { lowStockQueue } from '../../queues/lowstock.queue.js'
import { getStockCached, invalidateStockCache } from './stock.service.js'
import { recordMovement, decrementStock } from './movement.service.js'
import { createReservation, cancelReservation, fulfillReservation, getActiveReservedQty } from './reservation.service.js'
import { runStockOpname } from './opname.service.js'
import { processLowStockAlert } from './lowstock.service.js'

const mockDb = db as any
const mockCache = cacheRedisClient as any
const mockQueue = lowStockQueue as any

const VARIANT_ID = '11111111-1111-1111-1111-111111111111'
const USER_ID = '22222222-2222-2222-2222-222222222222'
const ORDER_REF = 'ORDER-001'
const RESERVATION_ID = '33333333-3333-3333-3333-333333333333'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('inventory — INV-01: Redis stock cache', () => {
  it('getStockCached returns cached value on Redis hit without hitting Postgres', async () => {
    mockCache.get.mockResolvedValue('42')
    mockDb.select.mockReturnThis()

    const result = await getStockCached(VARIANT_ID)

    expect(mockCache.get).toHaveBeenCalledWith(`stock:variant:${VARIANT_ID}`)
    expect(result).toBe(42)
    // Should NOT have queried Postgres
    expect(mockDb.select).not.toHaveBeenCalled()
  })

  it('getStockCached falls back to Postgres on Redis miss and populates cache', async () => {
    mockCache.get.mockResolvedValue(null)
    mockCache.setex.mockResolvedValue('OK')

    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ stockQty: 15 }]),
    }
    mockDb.select.mockReturnValue(mockSelectChain)

    const result = await getStockCached(VARIANT_ID)

    expect(mockCache.get).toHaveBeenCalledWith(`stock:variant:${VARIANT_ID}`)
    expect(mockDb.select).toHaveBeenCalled()
    expect(mockCache.setex).toHaveBeenCalledWith(`stock:variant:${VARIANT_ID}`, 300, '15')
    expect(result).toBe(15)
  })

  it('invalidateStockCache deletes the key from Redis', async () => {
    mockCache.del.mockResolvedValue(1)

    await invalidateStockCache(VARIANT_ID)

    expect(mockCache.del).toHaveBeenCalledWith(`stock:variant:${VARIANT_ID}`)
  })
})

describe('inventory — INV-02: append-only movements', () => {
  it('recordMovement inserts a new inventory_movements row', async () => {
    const mockInsertChain = {
      values: vi.fn().mockResolvedValue(undefined),
    }
    mockDb.insert.mockReturnValue(mockInsertChain)

    await recordMovement({
      variantId: VARIANT_ID,
      movementType: 'PURCHASE',
      qty: 10,
      performedBy: USER_ID,
    })

    expect(mockDb.insert).toHaveBeenCalled()
    expect(mockInsertChain.values).toHaveBeenCalled()
    const insertedValues = mockInsertChain.values.mock.calls[0][0]
    expect(insertedValues.variantId).toBe(VARIANT_ID)
    expect(insertedValues.movementType).toBe('PURCHASE')
  })

  it('recordMovement does not call db.update or db.delete on inventory_movements', async () => {
    const mockInsertChain = {
      values: vi.fn().mockResolvedValue(undefined),
    }
    mockDb.insert.mockReturnValue(mockInsertChain)

    await recordMovement({
      variantId: VARIANT_ID,
      movementType: 'PURCHASE',
      qty: 10,
      performedBy: USER_ID,
    })

    // update should never be called in the context of movements
    expect(mockDb.update).not.toHaveBeenCalled()
  })
})

describe('inventory — INV-03: movement types', () => {
  it('accepts SALE, PURCHASE, TRANSFER, RETURN, ADJUSTMENT movement types', async () => {
    const mockInsertChain = { values: vi.fn().mockResolvedValue(undefined) }
    mockDb.insert.mockReturnValue(mockInsertChain)

    for (const type of ['SALE', 'PURCHASE', 'TRANSFER', 'RETURN'] as const) {
      await expect(
        recordMovement({ variantId: VARIANT_ID, movementType: type, qty: 5, performedBy: USER_ID })
      ).resolves.not.toThrow()
    }

    // ADJUSTMENT requires reason + approvedBy
    await expect(
      recordMovement({
        variantId: VARIANT_ID,
        movementType: 'ADJUSTMENT',
        qty: 5,
        performedBy: USER_ID,
        reason: 'Stock count correction',
        approvedBy: USER_ID,
      })
    ).resolves.not.toThrow()
  })

  it('qty is negative for SALE and TRANSFER, positive for PURCHASE, RETURN, ADJUSTMENT', async () => {
    const mockInsertChain = { values: vi.fn().mockResolvedValue(undefined) }
    mockDb.insert.mockReturnValue(mockInsertChain)

    const cases: Array<{ type: 'SALE' | 'PURCHASE' | 'TRANSFER' | 'RETURN' | 'ADJUSTMENT'; expectedSign: number }> = [
      { type: 'SALE', expectedSign: -1 },
      { type: 'TRANSFER', expectedSign: -1 },
      { type: 'PURCHASE', expectedSign: 1 },
      { type: 'RETURN', expectedSign: 1 },
    ]

    for (const { type, expectedSign } of cases) {
      mockInsertChain.values.mockClear()
      await recordMovement({ variantId: VARIANT_ID, movementType: type, qty: 5, performedBy: USER_ID })
      const inserted = mockInsertChain.values.mock.calls[0][0]
      expect(Math.sign(inserted.qty)).toBe(expectedSign)
    }

    // ADJUSTMENT: positive
    mockInsertChain.values.mockClear()
    await recordMovement({
      variantId: VARIANT_ID,
      movementType: 'ADJUSTMENT',
      qty: 5,
      performedBy: USER_ID,
      reason: 'correction',
      approvedBy: USER_ID,
    })
    const adjustInserted = mockInsertChain.values.mock.calls[0][0]
    expect(Math.sign(adjustInserted.qty)).toBe(1)
  })
})

describe('inventory — INV-04: ADJUSTMENT validation', () => {
  it('recordMovement with ADJUSTMENT and no reason throws REASON_REQUIRED', async () => {
    await expect(
      recordMovement({
        variantId: VARIANT_ID,
        movementType: 'ADJUSTMENT',
        qty: 5,
        performedBy: USER_ID,
        approvedBy: USER_ID,
        // no reason
      })
    ).rejects.toThrow('REASON_REQUIRED')
  })

  it('recordMovement with ADJUSTMENT and no approvedBy throws APPROVER_REQUIRED', async () => {
    await expect(
      recordMovement({
        variantId: VARIANT_ID,
        movementType: 'ADJUSTMENT',
        qty: 5,
        performedBy: USER_ID,
        reason: 'Stock correction',
        // no approvedBy
      })
    ).rejects.toThrow('APPROVER_REQUIRED')
  })
})

describe('inventory — INV-05: concurrent decrement', () => {
  it('decrementStock uses SELECT FOR UPDATE inside a transaction', async () => {
    const mockTx = {
      execute: vi.fn(),
      insert: vi.fn(),
    }
    mockTx.execute
      .mockResolvedValueOnce([{ id: VARIANT_ID, stock_qty: 10, low_stock_threshold: null }]) // FOR UPDATE
      .mockResolvedValueOnce(undefined) // UPDATE stock_qty
    const mockTxInsert = { values: vi.fn().mockResolvedValue(undefined) }
    mockTx.insert.mockReturnValue(mockTxInsert)

    // Mock getActiveReservedQty tx.select chain
    const mockTxSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }
    ;(mockTx as any).select = vi.fn().mockReturnValue(mockTxSelectChain)

    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn(mockTx)
    })

    mockCache.del.mockResolvedValue(1)

    await decrementStock({
      variantId: VARIANT_ID,
      qty: 3,
      movementType: 'SALE',
      performedBy: USER_ID,
    })

    // Verify transaction was used
    expect(mockDb.transaction).toHaveBeenCalled()
    // Verify execute was called (FOR UPDATE is via tx.execute with a sql template)
    expect(mockTx.execute).toHaveBeenCalled()
    // Drizzle sql`` returns an object with queryChunks — check the SQL content
    const executeCall = mockTx.execute.mock.calls[0][0]
    // The sql template object stores chunks; serialize to check for FOR UPDATE
    const sqlText = JSON.stringify(executeCall)
    expect(sqlText).toContain('FOR UPDATE')
  })

  it('decrementStock throws INSUFFICIENT_STOCK when available qty < requested qty', async () => {
    const mockTx = {
      execute: vi.fn(),
      insert: vi.fn(),
      select: vi.fn(),
    }
    // Stock is 5, reservations are 3 → available is 2, requesting 4
    mockTx.execute.mockResolvedValueOnce([{ id: VARIANT_ID, stock_qty: 5, low_stock_threshold: null }])

    const mockTxSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ qty: 3 }]),
    }
    mockTx.select.mockReturnValue(mockTxSelectChain)

    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn(mockTx)
    })

    await expect(
      decrementStock({
        variantId: VARIANT_ID,
        qty: 4,
        movementType: 'SALE',
        performedBy: USER_ID,
      })
    ).rejects.toThrow('INSUFFICIENT_STOCK')
  })

  it('decrementStock accounts for active reservations in available qty calculation', async () => {
    const mockTx = {
      execute: vi.fn(),
      insert: vi.fn(),
      select: vi.fn(),
    }
    // Stock is 10, reservations are 7 → available is 3, requesting 3 (exact fit)
    mockTx.execute
      .mockResolvedValueOnce([{ id: VARIANT_ID, stock_qty: 10, low_stock_threshold: null }])
      .mockResolvedValueOnce(undefined) // UPDATE

    const mockTxSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ qty: 7 }]),
    }
    mockTx.select.mockReturnValue(mockTxSelectChain)

    const mockTxInsert = { values: vi.fn().mockResolvedValue(undefined) }
    mockTx.insert.mockReturnValue(mockTxInsert)

    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn(mockTx)
    })
    mockCache.del.mockResolvedValue(1)

    // Should succeed (3 available, requesting 3)
    await expect(
      decrementStock({
        variantId: VARIANT_ID,
        qty: 3,
        movementType: 'SALE',
        performedBy: USER_ID,
      })
    ).resolves.not.toThrow()
  })
})

describe('inventory — INV-06: stock reservations', () => {
  it('createReservation inserts stock_reservations row with ACTIVE status', async () => {
    const mockTx = {
      execute: vi.fn(),
      select: vi.fn(),
      insert: vi.fn(),
    }
    // FOR UPDATE returns stock_qty = 20
    mockTx.execute.mockResolvedValueOnce([{ id: VARIANT_ID, stock_qty: 20 }])
    // getActiveReservedQty returns 0
    const mockTxSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }
    mockTx.select.mockReturnValue(mockTxSelectChain)
    const reservation = {
      id: RESERVATION_ID,
      variantId: VARIANT_ID,
      qty: 5,
      orderRef: ORDER_REF,
      status: 'ACTIVE',
      reservedAt: new Date(),
      resolvedAt: null,
    }
    const mockTxInsert = { values: vi.fn().mockReturnThis(), returning: vi.fn().mockResolvedValue([reservation]) }
    mockTx.insert.mockReturnValue(mockTxInsert)

    const result = await createReservation({ variantId: VARIANT_ID, qty: 5, orderRef: ORDER_REF }, mockTx as any)

    expect(mockTx.insert).toHaveBeenCalled()
    expect(result.status).toBe('ACTIVE')
    expect(result.variantId).toBe(VARIANT_ID)
  })

  it('createReservation throws INSUFFICIENT_STOCK when available < qty', async () => {
    const mockTx = {
      execute: vi.fn(),
      select: vi.fn(),
      insert: vi.fn(),
    }
    // Stock = 5, reserved = 4, available = 1, requesting 2
    mockTx.execute.mockResolvedValueOnce([{ id: VARIANT_ID, stock_qty: 5 }])
    const mockTxSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([{ qty: 4 }]),
    }
    mockTx.select.mockReturnValue(mockTxSelectChain)

    await expect(
      createReservation({ variantId: VARIANT_ID, qty: 2, orderRef: ORDER_REF }, mockTx as any)
    ).rejects.toThrow('INSUFFICIENT_STOCK')
  })

  it('cancelReservation sets status to CANCELLED and sets resolvedAt', async () => {
    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }
    mockDb.update.mockReturnValue(mockUpdateChain)

    await cancelReservation(RESERVATION_ID)

    expect(mockDb.update).toHaveBeenCalled()
    const setCall = mockUpdateChain.set.mock.calls[0][0]
    expect(setCall.status).toBe('CANCELLED')
    expect(setCall.resolvedAt).toBeInstanceOf(Date)
  })

  it('fulfillReservation sets status to FULFILLED and sets resolvedAt', async () => {
    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue(undefined),
    }
    mockDb.update.mockReturnValue(mockUpdateChain)

    await fulfillReservation(RESERVATION_ID)

    expect(mockDb.update).toHaveBeenCalled()
    const setCall = mockUpdateChain.set.mock.calls[0][0]
    expect(setCall.status).toBe('FULFILLED')
    expect(setCall.resolvedAt).toBeInstanceOf(Date)
  })
})

describe('inventory — INV-07: low-stock alerts', () => {
  it('decrementStock enqueues low-stock BullMQ job when stock drops below threshold', async () => {
    const mockTx = {
      execute: vi.fn(),
      insert: vi.fn(),
      select: vi.fn(),
    }
    // Stock = 5, threshold = 3, decrement by 3 → new stock = 2 <= threshold → enqueue
    mockTx.execute
      .mockResolvedValueOnce([{ id: VARIANT_ID, stock_qty: 5, low_stock_threshold: 3 }])
      .mockResolvedValueOnce(undefined)

    const mockTxSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }
    mockTx.select.mockReturnValue(mockTxSelectChain)

    const mockTxInsert = { values: vi.fn().mockResolvedValue(undefined) }
    mockTx.insert.mockReturnValue(mockTxInsert)

    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn(mockTx)
    })
    mockCache.del.mockResolvedValue(1)

    await decrementStock({ variantId: VARIANT_ID, qty: 3, movementType: 'SALE', performedBy: USER_ID })

    expect(mockQueue.add).toHaveBeenCalledWith('check-low-stock', {
      variantId: VARIANT_ID,
      currentStock: 2,
    })
  })

  it('decrementStock does not enqueue when lowStockThreshold is null', async () => {
    const mockTx = {
      execute: vi.fn(),
      insert: vi.fn(),
      select: vi.fn(),
    }
    mockTx.execute
      .mockResolvedValueOnce([{ id: VARIANT_ID, stock_qty: 10, low_stock_threshold: null }])
      .mockResolvedValueOnce(undefined)

    const mockTxSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockResolvedValue([]),
    }
    mockTx.select.mockReturnValue(mockTxSelectChain)

    const mockTxInsert = { values: vi.fn().mockResolvedValue(undefined) }
    mockTx.insert.mockReturnValue(mockTxInsert)

    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn(mockTx)
    })
    mockCache.del.mockResolvedValue(1)

    await decrementStock({ variantId: VARIANT_ID, qty: 5, movementType: 'SALE', performedBy: USER_ID })

    expect(mockQueue.add).not.toHaveBeenCalled()
  })
})

describe('inventory — INV-08: stock opname', () => {
  it('runStockOpname inserts ADJUSTMENT movements for variants with discrepancy', async () => {
    const VARIANT_A = '44444444-4444-4444-4444-444444444444'
    const mockTx = {
      execute: vi.fn(),
      insert: vi.fn(),
    }
    // FOR UPDATE returns stock_qty=10 for variant A
    mockTx.execute
      .mockResolvedValueOnce([{ id: VARIANT_A, stock_qty: 10 }])  // SELECT FOR UPDATE
      .mockResolvedValueOnce(undefined)                             // UPDATE stock_qty

    const mockTxInsert = { values: vi.fn().mockResolvedValue(undefined) }
    mockTx.insert.mockReturnValue(mockTxInsert)

    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn(mockTx)
    })
    mockCache.del.mockResolvedValue(1)

    // physicalCount=15, stock=10 → discrepancy=5 → ADJUSTMENT inserted
    const result = await runStockOpname({
      items: [{ variantId: VARIANT_A, physicalCount: 15 }],
      performedBy: USER_ID,
      ipAddress: '127.0.0.1',
    })

    expect(mockDb.transaction).toHaveBeenCalled()
    expect(mockTx.execute).toHaveBeenCalled()
    expect(mockTx.insert).toHaveBeenCalled()
    const insertedValues = mockTxInsert.values.mock.calls[0][0]
    expect(insertedValues.movementType).toBe('ADJUSTMENT')
    expect(result.adjustments).toBe(1)
    expect(result.opnameId).toBeTruthy()
  })

  it('runStockOpname skips variants where physicalCount matches current stock', async () => {
    const VARIANT_B = '55555555-5555-5555-5555-555555555555'
    const mockTx = {
      execute: vi.fn(),
      insert: vi.fn(),
    }
    // FOR UPDATE returns stock_qty=10 — same as physicalCount → no discrepancy
    mockTx.execute.mockResolvedValueOnce([{ id: VARIANT_B, stock_qty: 10 }])
    const mockTxInsert = { values: vi.fn().mockResolvedValue(undefined) }
    mockTx.insert.mockReturnValue(mockTxInsert)

    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn(mockTx)
    })
    mockCache.del.mockResolvedValue(1)

    const result = await runStockOpname({
      items: [{ variantId: VARIANT_B, physicalCount: 10 }],
      performedBy: USER_ID,
      ipAddress: '127.0.0.1',
    })

    // No insert should happen for zero-discrepancy variant
    expect(mockTxInsert.values).not.toHaveBeenCalled()
    expect(result.adjustments).toBe(0)
  })

  it('runStockOpname returns count of adjusted variants', async () => {
    const VARIANT_C = '66666666-6666-6666-6666-666666666666'
    const VARIANT_D = '77777777-7777-7777-7777-777777777777'
    const mockTx = {
      execute: vi.fn(),
      insert: vi.fn(),
    }
    // Variant C: stock=5, physical=8 → discrepancy (+3)
    // Variant D: stock=10, physical=10 → no discrepancy
    mockTx.execute
      .mockResolvedValueOnce([{ id: VARIANT_C, stock_qty: 5 }])   // C FOR UPDATE
      .mockResolvedValueOnce(undefined)                             // C UPDATE
      .mockResolvedValueOnce([{ id: VARIANT_D, stock_qty: 10 }])  // D FOR UPDATE

    const mockTxInsert = { values: vi.fn().mockResolvedValue(undefined) }
    mockTx.insert.mockReturnValue(mockTxInsert)

    mockDb.transaction.mockImplementation(async (fn: (tx: any) => Promise<void>) => {
      await fn(mockTx)
    })
    mockCache.del.mockResolvedValue(1)

    const result = await runStockOpname({
      items: [
        { variantId: VARIANT_C, physicalCount: 8 },
        { variantId: VARIANT_D, physicalCount: 10 },
      ],
      performedBy: USER_ID,
      ipAddress: '127.0.0.1',
    })

    // Only C was adjusted (D had no discrepancy)
    expect(result.adjustments).toBe(1)
    expect(result.opnameId).toBeTruthy()
  })
})
