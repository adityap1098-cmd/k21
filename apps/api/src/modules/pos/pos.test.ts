import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock DB before importing services
vi.mock('../../db/index.js', () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    transaction: vi.fn(),
    execute: vi.fn(),
  }
  return { db: mockDb }
})

// Mock movement service
vi.mock('../inventory/movement.service.js', () => ({
  recordMovement: vi.fn().mockResolvedValue(undefined),
}))

// Mock accounting service
vi.mock('../accounting/accounting.service.js', () => ({
  createJournalEntryStub: vi.fn().mockResolvedValue(undefined),
  createJournalEntryReversal: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '../../db/index.js'
import {
  completeSale,
  syncOfflineTx,
  voidTransaction,
  type CompleteSaleParams,
} from './pos.service.js'
import { recordMovement } from '../inventory/movement.service.js'
import { createJournalEntryStub, createJournalEntryReversal } from '../accounting/accounting.service.js'

const mockDb = db as any
const mockRecordMovement = recordMovement as any
const mockCreateJournalEntryStub = createJournalEntryStub as any
const mockCreateJournalEntryReversal = createJournalEntryReversal as any

const TX_ID     = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const CLIENT_UUID = '11111111-1111-1111-1111-111111111111'
const SHIFT_ID  = '22222222-2222-2222-2222-222222222222'
const CASHIER_ID = '33333333-3333-3333-3333-333333333333'
const VARIANT_ID = '44444444-4444-4444-4444-444444444444'

const mockParams: CompleteSaleParams = {
  clientUuid: CLIENT_UUID,
  shiftId: SHIFT_ID,
  cashierId: CASHIER_ID,
  subtotal: 10000,
  discountAmount: 0,
  total: 10000,
  items: [
    {
      variantId: VARIANT_ID,
      qty: 2,
      unitPrice: 5000,
      discountAmount: 0,
      lineTotal: 10000,
    },
  ],
  payments: [
    { method: 'CASH', amount: 10000 },
  ],
}

const openShift = {
  id: SHIFT_ID,
  cashierId: CASHIER_ID,
  status: 'OPEN',
  openingFloat: 500000,
  closingCash: null,
  openedAt: new Date(),
  closedAt: null,
}

const completedTransaction = {
  id: TX_ID,
  clientUuid: CLIENT_UUID,
  shiftId: SHIFT_ID,
  cashierId: CASHIER_ID,
  subtotal: 10000,
  discountAmount: 0,
  total: 10000,
  status: 'COMPLETED' as const,
  voidReason: null,
  voidedAt: null,
  createdAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
})

// Helper to set up a successful tx mock
function setupSuccessfulSaleTx() {
  mockDb.transaction.mockImplementation(async (fn: any) => {
    const tx = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      execute: vi.fn(),
    }

    // 1. Check for duplicate clientUuid — not found
    const selectChainNone = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    }
    // 2. Check shift — found and OPEN
    const selectChainShift = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([openShift]),
    }

    tx.select
      .mockReturnValueOnce(selectChainNone)  // duplicate check
      .mockReturnValueOnce(selectChainShift) // shift check

    // 3. FOR UPDATE stock check — enough stock
    tx.execute.mockResolvedValue([{ stock_qty: 100 }])

    // 4. Insert transaction
    const insertTxChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([completedTransaction]),
    }
    // 5. Insert items (no returning needed)
    const insertItemsChain = {
      values: vi.fn().mockResolvedValue(undefined),
    }
    // 6. Insert payments (no returning needed)
    const insertPaymentsChain = {
      values: vi.fn().mockResolvedValue(undefined),
    }

    tx.insert
      .mockReturnValueOnce(insertTxChain)
      .mockReturnValueOnce(insertItemsChain)
      .mockReturnValueOnce(insertPaymentsChain)

    return fn(tx)
  })
}

// ─── completeSale ────────────────────────────────────────────────────────────

describe('completeSale — POS-11: atomic sale', () => {
  it('valid params → returns transaction with id + status COMPLETED', async () => {
    setupSuccessfulSaleTx()

    const result = await completeSale(mockParams)

    expect(result).toBeDefined()
    expect(result.id).toBe(TX_ID)
    expect(result.status).toBe('COMPLETED')
    expect(mockCreateJournalEntryStub).toHaveBeenCalledOnce()
    expect(mockRecordMovement).toHaveBeenCalledOnce()
  })

  it('duplicate clientUuid → returns existing transaction (idempotent, no error)', async () => {
    mockDb.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        execute: vi.fn(),
      }
      // Duplicate found on first select
      const selectChainDuplicate = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([completedTransaction]),
      }
      tx.select.mockReturnValue(selectChainDuplicate)
      return fn(tx)
    })

    const result = await completeSale(mockParams)

    expect(result.id).toBe(TX_ID)
    expect(result.clientUuid).toBe(CLIENT_UUID)
    // No inserts should happen — idempotent early return
    expect(mockCreateJournalEntryStub).not.toHaveBeenCalled()
  })

  it('insufficient stock → throws INSUFFICIENT_STOCK', async () => {
    mockDb.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        execute: vi.fn(),
      }

      // No duplicate
      const selectChainNone = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
      // Shift found
      const selectChainShift = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([openShift]),
      }
      tx.select
        .mockReturnValueOnce(selectChainNone)
        .mockReturnValueOnce(selectChainShift)

      // Stock insufficient: stock_qty = 1, requested qty = 2
      tx.execute.mockResolvedValue([{ stock_qty: 1 }])

      return fn(tx)
    })

    await expect(completeSale(mockParams)).rejects.toThrow('INSUFFICIENT_STOCK')
    expect(mockCreateJournalEntryStub).not.toHaveBeenCalled()
  })

  it('SHIFT_NOT_OPEN → throws when shift is not OPEN', async () => {
    mockDb.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        execute: vi.fn(),
      }
      // No duplicate
      const selectChainNone = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
      // Shift not found (or not OPEN)
      const selectChainNoShift = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
      tx.select
        .mockReturnValueOnce(selectChainNone)
        .mockReturnValueOnce(selectChainNoShift)

      return fn(tx)
    })

    await expect(completeSale(mockParams)).rejects.toThrow('SHIFT_NOT_OPEN')
  })
})

// ─── syncOfflineTx ───────────────────────────────────────────────────────────

describe('syncOfflineTx — offline sync wrapper', () => {
  it('pending transaction → calls completeSale and returns synced result', async () => {
    setupSuccessfulSaleTx()

    const result = await syncOfflineTx(mockParams)

    expect(result.status).toBe('synced')
    expect((result as { transactionId: string }).transactionId).toBe(TX_ID)
  })

  it('conflict (insufficient stock at sync time) → returns { status: conflict }', async () => {
    mockDb.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        execute: vi.fn(),
      }
      const selectChainNone = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([]),
      }
      const selectChainShift = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([openShift]),
      }
      tx.select
        .mockReturnValueOnce(selectChainNone)
        .mockReturnValueOnce(selectChainShift)
      // stock = 0
      tx.execute.mockResolvedValue([{ stock_qty: 0 }])
      return fn(tx)
    })

    const result = await syncOfflineTx(mockParams)

    expect(result.status).toBe('conflict')
    expect((result as { message: string }).message).toContain('Stock insufficient')
  })
})

// ─── voidTransaction ─────────────────────────────────────────────────────────

describe('voidTransaction — POS void path', () => {
  it('valid void → returns voided transaction with voidReason set', async () => {
    const voidedTx = { ...completedTransaction, status: 'VOIDED' as const, voidReason: 'Customer request', voidedAt: new Date() }
    const items = [{ id: 'item-1', variantId: VARIANT_ID, qty: 2, unitPrice: 5000, discountAmount: 0, lineTotal: 10000, transactionId: TX_ID }]

    mockDb.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        execute: vi.fn(),
      }
      // Fetch transaction
      const selectTxChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([completedTransaction]),
      }
      // Fetch items
      const selectItemsChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(items),
      }
      tx.select
        .mockReturnValueOnce(selectTxChain)
        .mockReturnValueOnce(selectItemsChain)

      // Update to VOIDED
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([voidedTx]),
      }
      tx.update.mockReturnValue(updateChain)

      // execute for stock restoration
      tx.execute.mockResolvedValue(undefined)

      return fn(tx)
    })

    const result = await voidTransaction({ transactionId: TX_ID, voidReason: 'Customer request', performedBy: CASHIER_ID })

    expect(result.status).toBe('VOIDED')
    expect(result.voidReason).toBe('Customer request')
    expect(mockRecordMovement).toHaveBeenCalledWith(
      expect.objectContaining({ variantId: VARIANT_ID, movementType: 'RETURN' }),
      expect.anything()
    )
    expect(mockCreateJournalEntryReversal).toHaveBeenCalledOnce()
  })

  it('already voided → throws ALREADY_VOIDED', async () => {
    const alreadyVoided = { ...completedTransaction, status: 'VOIDED' as const }

    mockDb.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        execute: vi.fn(),
      }
      const selectTxChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([alreadyVoided]),
      }
      tx.select.mockReturnValue(selectTxChain)
      return fn(tx)
    })

    await expect(
      voidTransaction({ transactionId: TX_ID, voidReason: 'retry', performedBy: CASHIER_ID })
    ).rejects.toThrow('ALREADY_VOIDED')
  })

  it('writes RETURN inventory_movement + journal entry reversal', async () => {
    const voidedTx = { ...completedTransaction, status: 'VOIDED' as const, voidReason: 'Test', voidedAt: new Date() }
    const items = [
      { id: 'item-1', variantId: VARIANT_ID, qty: 2, unitPrice: 5000, discountAmount: 0, lineTotal: 10000, transactionId: TX_ID },
      { id: 'item-2', variantId: '55555555-5555-5555-5555-555555555555', qty: 1, unitPrice: 15000, discountAmount: 0, lineTotal: 15000, transactionId: TX_ID },
    ]

    mockDb.transaction.mockImplementation(async (fn: any) => {
      const tx = {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        execute: vi.fn(),
      }
      const selectTxChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue([completedTransaction]),
      }
      const selectItemsChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockResolvedValue(items),
      }
      tx.select
        .mockReturnValueOnce(selectTxChain)
        .mockReturnValueOnce(selectItemsChain)
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([voidedTx]),
      }
      tx.update.mockReturnValue(updateChain)
      tx.execute.mockResolvedValue(undefined)
      return fn(tx)
    })

    await voidTransaction({ transactionId: TX_ID, voidReason: 'Test', performedBy: CASHIER_ID })

    // Should have been called once per item (2 items)
    expect(mockRecordMovement).toHaveBeenCalledTimes(2)
    expect(mockCreateJournalEntryReversal).toHaveBeenCalledOnce()
  })
})
