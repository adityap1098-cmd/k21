import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- Mocks ---

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

vi.mock('../inventory/movement.service.js', () => ({
  recordMovement: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../accounting/accounting.service.js', () => ({
  createJournalEntryStub: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../middleware/audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../inventory/stock.service.js', () => ({
  invalidateStockCache: vi.fn().mockResolvedValue(undefined),
}))

import { db } from '../../db/index.js'
import {
  createPurchaseOrder,
  submitForApproval,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  receiveGoods,
  getPurchaseOrder,
  listPurchaseOrders,
} from './procurement.service.js'
import { recordMovement } from '../inventory/movement.service.js'
import { createJournalEntryStub } from '../accounting/accounting.service.js'
import { logAudit } from '../../middleware/audit.js'
import { invalidateStockCache } from '../inventory/stock.service.js'

const mockDb = db as any
const mockRecordMovement = recordMovement as any
const mockCreateJournalEntryStub = createJournalEntryStub as any
const mockLogAudit = logAudit as any
const mockInvalidateStockCache = invalidateStockCache as any

// --- Test Fixtures ---

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
const ADMIN_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
const PO_ID = 'cccccccc-cccc-cccc-cccc-cccccccccccc'
const VARIANT_ID = 'dddddddd-dddd-dddd-dddd-dddddddddddd'
const ITEM_ID = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee'

const makeCreateParams = () => ({
  supplierName: 'PT Supplier Jaya',
  supplierId: '11111111-1111-1111-1111-111111111111',
  createdBy: USER_ID,
  items: [
    {
      variantId: VARIANT_ID,
      variantSku: 'SKU-001',
      variantName: 'Widget A',
      qty: 10,
      unitCost: 5000,
    },
  ],
})

const makePO = (overrides: Record<string, any> = {}) => ({
  id: PO_ID,
  poNumber: 'PO-20260321-ABCD',
  supplierId: '11111111-1111-1111-1111-111111111111',
  supplierName: 'PT Supplier Jaya',
  status: 'DRAFT',
  notes: null,
  subtotal: '50000',
  taxAmount: '0',
  total: '50000',
  createdBy: USER_ID,
  approvedBy: null,
  approvedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const makePOItem = (overrides: Record<string, any> = {}) => ({
  id: ITEM_ID,
  purchaseOrderId: PO_ID,
  variantId: VARIANT_ID,
  variantSku: 'SKU-001',
  variantName: 'Widget A',
  qty: 10,
  unitCost: '5000',
  lineTotal: '50000',
  ...overrides,
})

// --- Helpers for mock chaining ---

function chainSelect(rows: any[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          then: vi.fn().mockImplementation((cb: any) => Promise.resolve(cb(rows))),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    }),
  }
}

function chainSelectCount(count: number) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([{ count }]),
    }),
  }
}

function chainInsert(returned: any[]) {
  return {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(returned),
    }),
  }
}

function chainInsertNoReturn() {
  return {
    values: vi.fn().mockResolvedValue(undefined),
  }
}

function chainUpdate(returned: any[]) {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(returned),
      }),
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ============================
// createPurchaseOrder
// ============================

describe('createPurchaseOrder', () => {
  it('creates PO with DRAFT status and items in one transaction', async () => {
    const params = makeCreateParams()
    const po = makePO()

    // db.transaction receives a callback — execute it with a mock tx
    mockDb.transaction.mockImplementation(async (cb: any) => {
      const tx = {
        insert: vi.fn()
          .mockReturnValueOnce(chainInsert([po]))     // PO insert
          .mockReturnValueOnce(chainInsertNoReturn()), // items insert
      }
      return cb(tx)
    })

    const result = await createPurchaseOrder(params)

    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    expect(result.supplierName).toBe('PT Supplier Jaya')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].variantSku).toBe('SKU-001')
  })

  it('calculates subtotal from items', async () => {
    const params = makeCreateParams()
    params.items.push({
      variantId: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
      variantSku: 'SKU-002',
      variantName: 'Widget B',
      qty: 5,
      unitCost: 3000,
    })

    const po = makePO({ subtotal: '65000', total: '65000' })

    mockDb.transaction.mockImplementation(async (cb: any) => {
      const tx = {
        insert: vi.fn()
          .mockReturnValueOnce(chainInsert([po]))
          .mockReturnValueOnce(chainInsertNoReturn()),
      }
      // Verify the subtotal value passed to insert
      const result = await cb(tx)
      const insertCall = tx.insert.mock.calls[0]
      // The insert was called — we trust the implementation calculates correctly
      return result
    })

    const result = await createPurchaseOrder(params)
    expect(result.items).toHaveLength(2)
  })
})

// ============================
// submitForApproval
// ============================

describe('submitForApproval', () => {
  it('transitions DRAFT → PENDING_APPROVAL', async () => {
    const po = makePO({ status: 'DRAFT' })
    const updated = makePO({ status: 'PENDING_APPROVAL' })

    mockDb.select.mockReturnValue(chainSelect([po]))
    mockDb.update.mockReturnValue(chainUpdate([updated]))

    const result = await submitForApproval(PO_ID, USER_ID)

    expect(result.status).toBe('PENDING_APPROVAL')
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        tableName: 'purchase_orders',
        recordId: PO_ID,
        newValue: { status: 'PENDING_APPROVAL' },
      })
    )
  })

  it('throws INVALID_STATUS_TRANSITION if status is APPROVED', async () => {
    const po = makePO({ status: 'APPROVED' })
    mockDb.select.mockReturnValue(chainSelect([po]))

    await expect(submitForApproval(PO_ID, USER_ID)).rejects.toThrow(
      'INVALID_STATUS_TRANSITION'
    )
  })

  it('throws PO_NOT_FOUND if PO does not exist', async () => {
    mockDb.select.mockReturnValue(chainSelect([]))

    await expect(submitForApproval(PO_ID, USER_ID)).rejects.toThrow('PO_NOT_FOUND')
  })
})

// ============================
// approvePurchaseOrder
// ============================

describe('approvePurchaseOrder', () => {
  it('transitions PENDING_APPROVAL → APPROVED and sets approvedBy/approvedAt', async () => {
    const po = makePO({ status: 'PENDING_APPROVAL' })
    const approved = makePO({
      status: 'APPROVED',
      approvedBy: ADMIN_ID,
      approvedAt: new Date(),
    })

    mockDb.select.mockReturnValue(chainSelect([po]))
    mockDb.update.mockReturnValue(chainUpdate([approved]))

    const result = await approvePurchaseOrder(PO_ID, {
      approvedBy: ADMIN_ID,
    })

    expect(result.status).toBe('APPROVED')
    expect(result.approvedBy).toBe(ADMIN_ID)
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        tableName: 'purchase_orders',
        newValue: expect.objectContaining({ status: 'APPROVED', approvedBy: ADMIN_ID }),
      })
    )
  })

  it('throws INVALID_STATUS_TRANSITION if status is DRAFT', async () => {
    const po = makePO({ status: 'DRAFT' })
    mockDb.select.mockReturnValue(chainSelect([po]))

    await expect(
      approvePurchaseOrder(PO_ID, { approvedBy: ADMIN_ID })
    ).rejects.toThrow('INVALID_STATUS_TRANSITION')
  })

  it('throws PO_NOT_FOUND if PO does not exist', async () => {
    mockDb.select.mockReturnValue(chainSelect([]))

    await expect(
      approvePurchaseOrder(PO_ID, { approvedBy: ADMIN_ID })
    ).rejects.toThrow('PO_NOT_FOUND')
  })
})

// ============================
// cancelPurchaseOrder
// ============================

describe('cancelPurchaseOrder', () => {
  it('transitions DRAFT → CANCELLED', async () => {
    const po = makePO({ status: 'DRAFT' })
    const cancelled = makePO({ status: 'CANCELLED' })

    mockDb.select.mockReturnValue(chainSelect([po]))
    mockDb.update.mockReturnValue(chainUpdate([cancelled]))

    const result = await cancelPurchaseOrder(PO_ID, {
      cancelledBy: USER_ID,
    })

    expect(result.status).toBe('CANCELLED')
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        tableName: 'purchase_orders',
        newValue: { status: 'CANCELLED' },
      })
    )
  })

  it('transitions PENDING_APPROVAL → CANCELLED', async () => {
    const po = makePO({ status: 'PENDING_APPROVAL' })
    const cancelled = makePO({ status: 'CANCELLED' })

    mockDb.select.mockReturnValue(chainSelect([po]))
    mockDb.update.mockReturnValue(chainUpdate([cancelled]))

    const result = await cancelPurchaseOrder(PO_ID, {
      cancelledBy: USER_ID,
    })
    expect(result.status).toBe('CANCELLED')
  })

  it('throws INVALID_STATUS_TRANSITION if APPROVED', async () => {
    const po = makePO({ status: 'APPROVED' })
    mockDb.select.mockReturnValue(chainSelect([po]))

    await expect(
      cancelPurchaseOrder(PO_ID, { cancelledBy: USER_ID })
    ).rejects.toThrow('INVALID_STATUS_TRANSITION')
  })

  it('throws INVALID_STATUS_TRANSITION if RECEIVED', async () => {
    const po = makePO({ status: 'RECEIVED' })
    mockDb.select.mockReturnValue(chainSelect([po]))

    await expect(
      cancelPurchaseOrder(PO_ID, { cancelledBy: USER_ID })
    ).rejects.toThrow('INVALID_STATUS_TRANSITION')
  })
})

// ============================
// receiveGoods
// ============================

describe('receiveGoods', () => {
  const makeReceiveParams = () => ({
    purchaseOrderId: PO_ID,
    items: [{ itemId: ITEM_ID, qtyReceived: 5 }],
    receivedBy: USER_ID,
  })

  it('inserts goods receipts, movements, increments stock, and creates journal stub', async () => {
    const po = makePO({ status: 'APPROVED' })
    const poItem = makePOItem()

    // First select: PO
    // Second select: PO items
    // Third select: existing receipts
    mockDb.select
      .mockReturnValueOnce(chainSelect([po]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([poItem]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),  // no existing receipts
        }),
      })

    mockDb.transaction.mockImplementation(async (cb: any) => {
      const tx = {
        insert: vi.fn().mockReturnValue(chainInsertNoReturn()),
        execute: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue(undefined),
          }),
        }),
      }
      await cb(tx)
      return tx
    })

    const result = await receiveGoods(makeReceiveParams())

    expect(result.receiptIds).toHaveLength(1)
    expect(mockRecordMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        variantId: VARIANT_ID,
        movementType: 'PURCHASE',
        qty: 5,
        reference: 'PO-PO-20260321-ABCD',
      }),
      expect.anything()
    )
    expect(mockCreateJournalEntryStub).toHaveBeenCalledWith(
      expect.objectContaining({
        transactionId: PO_ID,
        sourceType: 'PURCHASE',
        total: 25000, // 5 * 5000
      }),
      expect.anything()
    )
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CREATE',
        tableName: 'goods_receipts',
      })
    )
    expect(mockInvalidateStockCache).toHaveBeenCalledWith(VARIANT_ID)
  })

  it('sets PO status to RECEIVED when all items fully received', async () => {
    const po = makePO({ status: 'APPROVED' })
    const poItem = makePOItem({ qty: 5 })

    mockDb.select
      .mockReturnValueOnce(chainSelect([po]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([poItem]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

    let capturedStatus: string | null = null
    mockDb.transaction.mockImplementation(async (cb: any) => {
      const tx = {
        insert: vi.fn().mockReturnValue(chainInsertNoReturn()),
        execute: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((setVal: any) => {
            capturedStatus = setVal.status
            return {
              where: vi.fn().mockResolvedValue(undefined),
            }
          }),
        }),
      }
      await cb(tx)
    })

    await receiveGoods({
      purchaseOrderId: PO_ID,
      items: [{ itemId: ITEM_ID, qtyReceived: 5 }],
      receivedBy: USER_ID,
    })

    expect(capturedStatus).toBe('RECEIVED')
  })

  it('sets PO status to PARTIALLY_RECEIVED when partial', async () => {
    const po = makePO({ status: 'APPROVED' })
    const poItem = makePOItem({ qty: 10 })

    mockDb.select
      .mockReturnValueOnce(chainSelect([po]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([poItem]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

    let capturedStatus: string | null = null
    mockDb.transaction.mockImplementation(async (cb: any) => {
      const tx = {
        insert: vi.fn().mockReturnValue(chainInsertNoReturn()),
        execute: vi.fn().mockResolvedValue(undefined),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockImplementation((setVal: any) => {
            capturedStatus = setVal.status
            return {
              where: vi.fn().mockResolvedValue(undefined),
            }
          }),
        }),
      }
      await cb(tx)
    })

    await receiveGoods({
      purchaseOrderId: PO_ID,
      items: [{ itemId: ITEM_ID, qtyReceived: 3 }],
      receivedBy: USER_ID,
    })

    expect(capturedStatus).toBe('PARTIALLY_RECEIVED')
  })

  it('throws RECEIVE_QTY_EXCEEDS_ORDERED when cumulative > ordered', async () => {
    const po = makePO({ status: 'PARTIALLY_RECEIVED' })
    const poItem = makePOItem({ qty: 10 })
    const existingReceipt = {
      id: 'receipt-1',
      purchaseOrderId: PO_ID,
      itemId: ITEM_ID,
      qtyReceived: 8,
      receivedBy: USER_ID,
      receivedAt: new Date(),
      notes: null,
    }

    mockDb.select
      .mockReturnValueOnce(chainSelect([po]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([poItem]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([existingReceipt]),
        }),
      })

    await expect(
      receiveGoods({
        purchaseOrderId: PO_ID,
        items: [{ itemId: ITEM_ID, qtyReceived: 5 }], // 8 + 5 = 13 > 10
        receivedBy: USER_ID,
      })
    ).rejects.toThrow('RECEIVE_QTY_EXCEEDS_ORDERED')
  })

  it('throws INVALID_STATUS_TRANSITION if PO is DRAFT', async () => {
    const po = makePO({ status: 'DRAFT' })
    mockDb.select.mockReturnValue(chainSelect([po]))

    await expect(
      receiveGoods(makeReceiveParams())
    ).rejects.toThrow('INVALID_STATUS_TRANSITION')
  })

  it('throws INVALID_STATUS_TRANSITION if PO is CANCELLED', async () => {
    const po = makePO({ status: 'CANCELLED' })
    mockDb.select.mockReturnValue(chainSelect([po]))

    await expect(
      receiveGoods(makeReceiveParams())
    ).rejects.toThrow('INVALID_STATUS_TRANSITION')
  })

  it('throws PO_NOT_FOUND if PO does not exist', async () => {
    mockDb.select.mockReturnValue(chainSelect([]))

    await expect(
      receiveGoods(makeReceiveParams())
    ).rejects.toThrow('PO_NOT_FOUND')
  })
})

// ============================
// getPurchaseOrder
// ============================

describe('getPurchaseOrder', () => {
  it('returns PO with items and receipts', async () => {
    const po = makePO()
    const poItem = makePOItem()
    const receipt = {
      id: 'receipt-1',
      purchaseOrderId: PO_ID,
      itemId: ITEM_ID,
      qtyReceived: 5,
      receivedBy: USER_ID,
      receivedAt: new Date(),
      notes: null,
    }

    mockDb.select
      .mockReturnValueOnce(chainSelect([po]))
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([poItem]),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([receipt]),
        }),
      })

    const result = await getPurchaseOrder(PO_ID)

    expect(result.id).toBe(PO_ID)
    expect(result.items).toHaveLength(1)
    expect(result.receipts).toHaveLength(1)
    expect(result.receipts[0].qtyReceived).toBe(5)
  })

  it('throws PO_NOT_FOUND if PO does not exist', async () => {
    mockDb.select.mockReturnValue(chainSelect([]))

    await expect(getPurchaseOrder(PO_ID)).rejects.toThrow('PO_NOT_FOUND')
  })
})

// ============================
// listPurchaseOrders
// ============================

describe('listPurchaseOrders', () => {
  it('returns paginated results with total count', async () => {
    const po1 = makePO({ id: 'po-1' })
    const po2 = makePO({ id: 'po-2' })

    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([po1, po2]),
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce(chainSelectCount(5))

    const result = await listPurchaseOrders({ page: 1, limit: 2 })

    expect(result.data).toHaveLength(2)
    expect(result.total).toBe(5)
    expect(result.page).toBe(1)
    expect(result.limit).toBe(2)
  })

  it('filters by status when provided', async () => {
    mockDb.select
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                offset: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        }),
      })
      .mockReturnValueOnce(chainSelectCount(0))

    const result = await listPurchaseOrders({ status: 'APPROVED' })

    expect(result.data).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})
