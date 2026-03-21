import { randomUUID, randomBytes } from 'crypto'
import { eq, sql, and, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  purchaseOrders,
  purchaseOrderItems,
  goodsReceipts,
} from '../../db/schema/procurement.js'
import { productVariants } from '../../db/schema/products.js'
import { recordMovement } from '../inventory/movement.service.js'
import { createJournalEntryStub } from '../accounting/accounting.service.js'
import { logAudit } from '../../middleware/audit.js'
import { invalidateStockCache } from '../inventory/stock.service.js'

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

// --- Helpers ---

function generatePoNumber(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = randomBytes(3).toString('hex').slice(0, 4).toUpperCase()
  return `PO-${date}-${rand}`
}

type PoStatus = 'DRAFT' | 'PENDING_APPROVAL' | 'APPROVED' | 'PARTIALLY_RECEIVED' | 'RECEIVED' | 'CANCELLED'

const VALID_TRANSITIONS: Record<PoStatus, PoStatus[]> = {
  DRAFT: ['PENDING_APPROVAL', 'CANCELLED'],
  PENDING_APPROVAL: ['APPROVED', 'CANCELLED'],
  APPROVED: ['PARTIALLY_RECEIVED', 'RECEIVED'],
  PARTIALLY_RECEIVED: ['RECEIVED'],
  RECEIVED: [],
  CANCELLED: [],
}

function assertTransition(current: PoStatus, target: PoStatus): void {
  if (!VALID_TRANSITIONS[current]?.includes(target)) {
    throw new Error('INVALID_STATUS_TRANSITION')
  }
}

// --- Service Functions ---

export interface CreatePurchaseOrderParams {
  supplierId?: string
  supplierName: string
  items: Array<{
    variantId: string
    variantSku: string
    variantName: string
    qty: number
    unitCost: number
  }>
  notes?: string
  createdBy: string
}

export async function createPurchaseOrder(params: CreatePurchaseOrderParams) {
  const poId = randomUUID()
  const poNumber = generatePoNumber()

  const itemRows = params.items.map((item) => ({
    id: randomUUID(),
    purchaseOrderId: poId,
    variantId: item.variantId,
    variantSku: item.variantSku,
    variantName: item.variantName,
    qty: item.qty,
    unitCost: item.unitCost.toString(),
    lineTotal: (item.qty * item.unitCost).toString(),
  }))

  const subtotal = params.items.reduce((sum, i) => sum + i.qty * i.unitCost, 0)

  const po = await db.transaction(async (tx) => {
    const [inserted] = await (tx as unknown as typeof db)
      .insert(purchaseOrders)
      .values({
        id: poId,
        poNumber,
        supplierId: params.supplierId,
        supplierName: params.supplierName,
        status: 'DRAFT',
        notes: params.notes,
        subtotal: subtotal.toString(),
        taxAmount: '0',
        total: subtotal.toString(),
        createdBy: params.createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning()

    await (tx as unknown as typeof db)
      .insert(purchaseOrderItems)
      .values(itemRows)

    return inserted
  })

  return { ...po, items: itemRows }
}

export async function submitForApproval(poId: string, userId: string, ipAddress: string = '0.0.0.0') {
  const po = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, poId))
    .limit(1)
    .then((rows) => rows[0])

  if (!po) throw new Error('PO_NOT_FOUND')
  assertTransition(po.status as PoStatus, 'PENDING_APPROVAL')

  const [updated] = await db
    .update(purchaseOrders)
    .set({ status: 'PENDING_APPROVAL', updatedAt: new Date() })
    .where(eq(purchaseOrders.id, poId))
    .returning()

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'purchase_orders',
    recordId: poId,
    oldValue: { status: po.status },
    newValue: { status: 'PENDING_APPROVAL' },
    ipAddress,
  })

  return updated
}

export async function approvePurchaseOrder(
  poId: string,
  params: { approvedBy: string; ipAddress?: string }
) {
  const po = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, poId))
    .limit(1)
    .then((rows) => rows[0])

  if (!po) throw new Error('PO_NOT_FOUND')
  assertTransition(po.status as PoStatus, 'APPROVED')

  const now = new Date()
  const [updated] = await db
    .update(purchaseOrders)
    .set({
      status: 'APPROVED',
      approvedBy: params.approvedBy,
      approvedAt: now,
      updatedAt: now,
    })
    .where(eq(purchaseOrders.id, poId))
    .returning()

  await logAudit({
    userId: params.approvedBy,
    action: 'UPDATE',
    tableName: 'purchase_orders',
    recordId: poId,
    oldValue: { status: po.status },
    newValue: { status: 'APPROVED', approvedBy: params.approvedBy },
    ipAddress: params.ipAddress ?? '0.0.0.0',
  })

  return updated
}

export async function cancelPurchaseOrder(
  poId: string,
  params: { cancelledBy: string; ipAddress?: string }
) {
  const po = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, poId))
    .limit(1)
    .then((rows) => rows[0])

  if (!po) throw new Error('PO_NOT_FOUND')
  assertTransition(po.status as PoStatus, 'CANCELLED')

  const [updated] = await db
    .update(purchaseOrders)
    .set({ status: 'CANCELLED', updatedAt: new Date() })
    .where(eq(purchaseOrders.id, poId))
    .returning()

  await logAudit({
    userId: params.cancelledBy,
    action: 'UPDATE',
    tableName: 'purchase_orders',
    recordId: poId,
    oldValue: { status: po.status },
    newValue: { status: 'CANCELLED' },
    ipAddress: params.ipAddress ?? '0.0.0.0',
  })

  return updated
}

export interface ReceiveGoodsParams {
  purchaseOrderId: string
  items: Array<{
    itemId: string
    qtyReceived: number
  }>
  receivedBy: string
  ipAddress?: string
}

export async function receiveGoods(params: ReceiveGoodsParams) {
  const po = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, params.purchaseOrderId))
    .limit(1)
    .then((rows) => rows[0])

  if (!po) throw new Error('PO_NOT_FOUND')

  const currentStatus = po.status as PoStatus
  if (!['APPROVED', 'PARTIALLY_RECEIVED'].includes(currentStatus)) {
    throw new Error('INVALID_STATUS_TRANSITION')
  }

  // Fetch all PO items
  const poItems = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, params.purchaseOrderId))

  const poItemMap = new Map(poItems.map(i => [i.id, i]))

  // Fetch existing receipts for this PO
  const existingReceipts = await db
    .select()
    .from(goodsReceipts)
    .where(eq(goodsReceipts.purchaseOrderId, params.purchaseOrderId))

  // Build map of already-received quantities per item
  const receivedMap = new Map<string, number>()
  for (const r of existingReceipts) {
    receivedMap.set(r.itemId, (receivedMap.get(r.itemId) ?? 0) + r.qtyReceived)
  }

  // Validate quantities
  for (const receiveItem of params.items) {
    const poItem = poItemMap.get(receiveItem.itemId)
    if (!poItem) throw new Error('PO_ITEM_NOT_FOUND')

    const alreadyReceived = receivedMap.get(receiveItem.itemId) ?? 0
    if (alreadyReceived + receiveItem.qtyReceived > poItem.qty) {
      throw new Error('RECEIVE_QTY_EXCEEDS_ORDERED')
    }
  }

  const receiptIds: string[] = []

  await db.transaction(async (tx) => {
    const executor = tx as unknown as typeof db

    for (const receiveItem of params.items) {
      const poItem = poItemMap.get(receiveItem.itemId)!
      const receiptId = randomUUID()
      receiptIds.push(receiptId)

      // Insert goods receipt
      await executor.insert(goodsReceipts).values({
        id: receiptId,
        purchaseOrderId: params.purchaseOrderId,
        itemId: receiveItem.itemId,
        qtyReceived: receiveItem.qtyReceived,
        receivedBy: params.receivedBy,
        receivedAt: new Date(),
      })

      // Record inventory movement (PURCHASE = positive qty)
      await recordMovement(
        {
          variantId: poItem.variantId,
          movementType: 'PURCHASE',
          qty: receiveItem.qtyReceived,
          reference: `PO-${po.poNumber}`,
          performedBy: params.receivedBy,
        },
        tx
      )

      // Increment stock
      await tx.execute(
        sql`UPDATE product_variants SET stock_qty = stock_qty + ${receiveItem.qtyReceived}, updated_at = now() WHERE id = ${poItem.variantId}`
      )
    }

    // Journal entry stub for the receipt
    const receiptTotal = params.items.reduce((sum, item) => {
      const poItem = poItemMap.get(item.itemId)!
      return sum + item.qtyReceived * parseFloat(poItem.unitCost)
    }, 0)

    await createJournalEntryStub(
      {
        transactionId: params.purchaseOrderId,
        total: receiptTotal,
        sourceType: 'PURCHASE',
      },
      tx as unknown as DrizzleTx
    )

    // Determine new PO status
    const updatedReceivedMap = new Map(receivedMap)
    for (const item of params.items) {
      updatedReceivedMap.set(
        item.itemId,
        (updatedReceivedMap.get(item.itemId) ?? 0) + item.qtyReceived
      )
    }

    const allFullyReceived = poItems.every(
      (item) => (updatedReceivedMap.get(item.id) ?? 0) >= item.qty
    )

    const newStatus = allFullyReceived ? 'RECEIVED' : 'PARTIALLY_RECEIVED'

    await executor
      .update(purchaseOrders)
      .set({ status: newStatus, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, params.purchaseOrderId))
  })

  // Invalidate stock cache after commit
  const variantIdsToInvalidate = params.items.map(ri => poItemMap.get(ri.itemId)!.variantId)
  await Promise.all([...new Set(variantIdsToInvalidate)].map(id => invalidateStockCache(id)))

  // Audit log
  await logAudit({
    userId: params.receivedBy,
    action: 'CREATE',
    tableName: 'goods_receipts',
    recordId: receiptIds[0],
    oldValue: null,
    newValue: { purchaseOrderId: params.purchaseOrderId, items: params.items },
    ipAddress: params.ipAddress ?? '0.0.0.0',
  })

  return { receiptIds, purchaseOrderId: params.purchaseOrderId }
}

export async function getPurchaseOrder(poId: string) {
  const po = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, poId))
    .limit(1)
    .then((rows) => rows[0])

  if (!po) throw new Error('PO_NOT_FOUND')

  const items = await db
    .select()
    .from(purchaseOrderItems)
    .where(eq(purchaseOrderItems.purchaseOrderId, poId))

  const receipts = await db
    .select()
    .from(goodsReceipts)
    .where(eq(goodsReceipts.purchaseOrderId, poId))

  return { ...po, items, receipts }
}

export async function listPurchaseOrders(params: {
  status?: string
  page?: number
  limit?: number
}) {
  const page = params.page ?? 1
  const limit = params.limit ?? 20
  const offset = (page - 1) * limit

  const conditions = params.status
    ? eq(purchaseOrders.status, params.status as any)
    : undefined

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(purchaseOrders)
      .where(conditions)
      .orderBy(sql`created_at DESC`)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(purchaseOrders)
      .where(conditions),
  ])

  return {
    data: rows,
    total: countResult[0]?.count ?? 0,
    page,
    limit,
  }
}
