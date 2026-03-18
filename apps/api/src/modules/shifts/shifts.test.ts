import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DB before importing services
vi.mock('../../db/index.js', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  }
  return { db: mockDb }
})

import { db } from '../../db/index.js'
import { openShift, closeShift, getActiveShift, getShiftReconciliation } from './shifts.service.js'

const mockDb = db as any

const CASHIER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const SHIFT_ID   = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'

beforeEach(() => {
  vi.clearAllMocks()
})

// ----- openShift -----

describe('shifts — POS-05: openShift', () => {
  it('openShift creates a shift with OPEN status for a cashier with no open shift', async () => {
    // No existing open shift
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    mockDb.select.mockReturnValue(mockSelectChain)

    const newShift = {
      id: SHIFT_ID,
      cashierId: CASHIER_ID,
      status: 'OPEN',
      openingFloat: 500000,
      closingCash: null,
      openedAt: new Date(),
      closedAt: null,
    }
    const mockInsertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([newShift]),
    }
    mockDb.insert.mockReturnValue(mockInsertChain)

    const result = await openShift({ cashierId: CASHIER_ID, openingFloat: 500000 })

    expect(result.status).toBe('OPEN')
    expect(result.cashierId).toBe(CASHIER_ID)
    expect(result.openingFloat).toBe(500000)
  })

  it('openShift throws SHIFT_ALREADY_OPEN if cashier already has an OPEN shift', async () => {
    const existingShift = {
      id: SHIFT_ID,
      cashierId: CASHIER_ID,
      status: 'OPEN',
      openingFloat: 100000,
      closingCash: null,
      openedAt: new Date(),
      closedAt: null,
    }
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([existingShift]),
    }
    mockDb.select.mockReturnValue(mockSelectChain)

    await expect(
      openShift({ cashierId: CASHIER_ID, openingFloat: 200000 })
    ).rejects.toThrow('SHIFT_ALREADY_OPEN')
  })
})

// ----- closeShift -----

describe('shifts — POS-05: closeShift', () => {
  it('closeShift closes the shift and returns a reconciliation object', async () => {
    const closedShift = {
      id: SHIFT_ID,
      cashierId: CASHIER_ID,
      status: 'CLOSED',
      openingFloat: 500000,
      closingCash: 650000,
      openedAt: new Date(),
      closedAt: new Date(),
    }
    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([closedShift]),
    }
    mockDb.update.mockReturnValue(mockUpdateChain)

    // Reconciliation query: transaction_payments joined with transactions
    // Returns: [{ method: 'CASH', total: '150000' }, { method: 'TRANSFER', total: '0' }, { method: 'QRIS', total: '0' }]
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        { method: 'CASH', total: '150000' },
      ]),
    }
    mockDb.select.mockReturnValue(mockSelectChain)

    const result = await closeShift({ shiftId: SHIFT_ID, cashierId: CASHIER_ID, closingCash: 650000 })

    expect(result.shiftId).toBe(SHIFT_ID)
    expect(result.cashierId).toBe(CASHIER_ID)
    expect(result.openingFloat).toBe(500000)
    expect(result.actualCash).toBe(650000)
    expect(result.salesByCash).toBe(150000)
    expect(result.expectedCash).toBe(650000) // 500000 + 150000
    expect(result.discrepancy).toBe(0) // 650000 - 650000
    expect(typeof result.totalSales).toBe('number')
  })

  it('closeShift throws SHIFT_NOT_FOUND when shift does not exist or does not belong to cashier', async () => {
    const mockUpdateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    }
    mockDb.update.mockReturnValue(mockUpdateChain)

    await expect(
      closeShift({ shiftId: SHIFT_ID, cashierId: CASHIER_ID, closingCash: 100000 })
    ).rejects.toThrow('SHIFT_NOT_FOUND')
  })
})

// ----- getActiveShift -----

describe('shifts — POS-05: getActiveShift', () => {
  it('getActiveShift returns OPEN shift for the given cashier', async () => {
    const openShiftRow = {
      id: SHIFT_ID,
      cashierId: CASHIER_ID,
      status: 'OPEN',
      openingFloat: 300000,
      closingCash: null,
      openedAt: new Date(),
      closedAt: null,
    }
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([openShiftRow]),
    }
    mockDb.select.mockReturnValue(mockSelectChain)

    const result = await getActiveShift(CASHIER_ID)

    expect(result).not.toBeNull()
    expect(result!.status).toBe('OPEN')
    expect(result!.cashierId).toBe(CASHIER_ID)
  })

  it('getActiveShift returns null when no OPEN shift exists for cashier', async () => {
    const mockSelectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    mockDb.select.mockReturnValue(mockSelectChain)

    const result = await getActiveShift(CASHIER_ID)

    expect(result).toBeNull()
  })
})

// ----- getShiftReconciliation -----

describe('shifts — POS-05: getShiftReconciliation', () => {
  it('getShiftReconciliation returns reconciliation with all 3 payment method totals', async () => {
    // First select: get the shift
    const shiftRow = {
      id: SHIFT_ID,
      cashierId: CASHIER_ID,
      status: 'CLOSED',
      openingFloat: 500000,
      closingCash: 700000,
      openedAt: new Date(),
      closedAt: new Date(),
    }

    const mockSelectShiftChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([shiftRow]),
    }

    // Second select: payment method aggregation
    const mockSelectPaymentsChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        { method: 'CASH', total: '200000' },
        { method: 'QRIS', total: '100000' },
      ]),
    }

    mockDb.select
      .mockReturnValueOnce(mockSelectShiftChain)
      .mockReturnValueOnce(mockSelectPaymentsChain)

    const result = await getShiftReconciliation(SHIFT_ID)

    expect(result.shiftId).toBe(SHIFT_ID)
    expect(result.openingFloat).toBe(500000)
    expect(result.salesByCash).toBe(200000)
    expect(result.salesByQris).toBe(100000)
    expect(result.salesByTransfer).toBe(0)
    expect(result.totalSales).toBe(300000) // 200000 + 100000
    expect(result.expectedCash).toBe(700000) // 500000 + 200000
    expect(result.actualCash).toBe(700000) // closingCash
    expect(result.discrepancy).toBe(0) // 700000 - 700000
  })

  it('getShiftReconciliation computes discrepancy correctly (actualCash - expectedCash)', async () => {
    const shiftRow = {
      id: SHIFT_ID,
      cashierId: CASHIER_ID,
      status: 'CLOSED',
      openingFloat: 100000,
      closingCash: 280000, // cashier counted 280k
      openedAt: new Date(),
      closedAt: new Date(),
    }

    const mockSelectShiftChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([shiftRow]),
    }

    const mockSelectPaymentsChain = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockResolvedValue([
        { method: 'CASH', total: '150000' }, // expectedCash = 100000 + 150000 = 250000
      ]),
    }

    mockDb.select
      .mockReturnValueOnce(mockSelectShiftChain)
      .mockReturnValueOnce(mockSelectPaymentsChain)

    const result = await getShiftReconciliation(SHIFT_ID)

    // expectedCash = openingFloat + salesByCash = 100000 + 150000 = 250000
    // discrepancy = actualCash - expectedCash = 280000 - 250000 = 30000
    expect(result.expectedCash).toBe(250000)
    expect(result.actualCash).toBe(280000)
    expect(result.discrepancy).toBe(30000)
  })
})
