import { randomUUID } from 'crypto'
import { eq, and, sql, desc } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { transactions, transactionItems, transactionPayments, shifts, transactionReturns } from '../../db/schema/pos.js'
import type { Transaction, TransactionReturn } from '../../db/schema/pos.js'
import { recordMovement } from '../inventory/movement.service.js'
import { createJournalEntryStub, createJournalEntryReversal } from '../accounting/accounting.service.js'
import { logAudit } from '../../middleware/audit.js'
import { products, productVariants } from '../../db/schema/products.js'

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface CompleteSaleParams {
  clientUuid: string
  shiftId: string
  cashierId: string
  subtotal: number
  discountAmount: number
  total: number
  items: Array<{
    variantId: string
    qty: number
    unitPrice: number
    discountAmount: number
    lineTotal: number
  }>
  payments: Array<{
    method: 'CASH' | 'TRANSFER' | 'QRIS'
    amount: number
    reference?: string
  }>
}

export type SyncResult =
  | { status: 'synced'; transactionId: string }
  | { status: 'conflict'; message: string }

/**
 * Atomically processes a POS sale inside a single PostgreSQL transaction.
 *
 * Invariants:
 * - Idempotent: duplicate clientUuid returns existing transaction without re-processing
 * - INSUFFICIENT_STOCK thrown before any inserts (SELECT FOR UPDATE row-level lock)
 * - recordMovement + journal entry stub run inside the same tx (no nested transactions)
 */
export async function completeSale(params: CompleteSaleParams): Promise<Transaction> {
  return db.transaction(async (tx) => {
    // 1. Idempotency check — return existing transaction if clientUuid already processed
    const existing = await (tx as unknown as typeof db)
      .select()
      .from(transactions)
      .where(eq(transactions.clientUuid, params.clientUuid))
      .limit(1)

    if (existing.length > 0) {
      return existing[0]
    }

    // 2. Validate shift is OPEN for this cashier
    const shiftRows = await (tx as unknown as typeof db)
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, params.shiftId), eq(shifts.status, 'OPEN')))
      .limit(1)

    if (shiftRows.length === 0) {
      throw new Error('SHIFT_NOT_OPEN')
    }

    // 3. FOR each item: SELECT FOR UPDATE + stock check (before any inserts)
    for (const item of params.items) {
      const rows = await (tx as DrizzleTx).execute(
        sql`SELECT stock_qty FROM product_variants WHERE id = ${item.variantId} FOR UPDATE`
      )
      const variant = (rows as unknown as Array<{ stock_qty: number }>)[0]
      if (!variant || variant.stock_qty < item.qty) {
        throw new Error('INSUFFICIENT_STOCK')
      }
    }

    // 4. Insert transaction header
    const txId = randomUUID()
    const [transaction] = await (tx as unknown as typeof db)
      .insert(transactions)
      .values({
        id: txId,
        clientUuid: params.clientUuid,
        shiftId: params.shiftId,
        cashierId: params.cashierId,
        subtotal: params.subtotal,
        discountAmount: params.discountAmount,
        total: params.total,
        status: 'COMPLETED',
        createdAt: new Date(),
      })
      .returning()

    // 5. Insert transaction items (bulk)
    await (tx as unknown as typeof db)
      .insert(transactionItems)
      .values(
        params.items.map((item) => ({
          id: randomUUID(),
          transactionId: transaction.id,
          variantId: item.variantId,
          qty: item.qty,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          lineTotal: item.lineTotal,
        }))
      )

    // 6. Insert transaction payments (bulk)
    await (tx as unknown as typeof db)
      .insert(transactionPayments)
      .values(
        params.payments.map((payment) => ({
          id: randomUUID(),
          transactionId: transaction.id,
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference,
        }))
      )

    // 7. For each item: recordMovement + UPDATE stock_qty
    //    recordMovement is called with the outer tx — no nested transaction
    for (const item of params.items) {
      await recordMovement(
        {
          variantId: item.variantId,
          movementType: 'SALE',
          qty: item.qty,
          reference: transaction.id,
          performedBy: params.cashierId,
        },
        tx
      )

      await (tx as DrizzleTx).execute(
        sql`UPDATE product_variants SET stock_qty = stock_qty - ${item.qty}, updated_at = now() WHERE id = ${item.variantId}`
      )
    }

    // 8. Accounting stub — inside the same tx
    await createJournalEntryStub(
      { transactionId: transaction.id, total: params.total },
      tx
    )

    return transaction
  })
}

/**
 * Thin wrapper around completeSale for offline sync use case.
 * Catches INSUFFICIENT_STOCK and returns a conflict result instead of throwing.
 *
 * When forceComplete=true, skips the stock validation check and proceeds
 * with the insert even if stock would go negative. Used for conflict resolution
 * from the SyncIssuesPanel. Adds [FORCE_COMPLETE] note to inventory movement
 * reference and logs to audit_logs for audit trail.
 */
export async function syncOfflineTx(
  params: CompleteSaleParams & { forceComplete?: boolean }
): Promise<SyncResult> {
  if (params.forceComplete) {
    const transaction = await completeSaleForced(params)
    return { status: 'synced', transactionId: transaction.id }
  }
  try {
    const transaction = await completeSale(params)
    return { status: 'synced', transactionId: transaction.id }
  } catch (err) {
    if (err instanceof Error && err.message === 'INSUFFICIENT_STOCK') {
      return { status: 'conflict', message: 'Stock insufficient at sync time' }
    }
    throw err
  }
}

type DrizzleTxForced = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Force-complete variant of completeSale that skips the stock check.
 * Stock may go negative — this is intentional for conflict resolution.
 * Adds [FORCE_COMPLETE] suffix to inventory movement reference for audit trail.
 */
async function completeSaleForced(params: CompleteSaleParams): Promise<Transaction> {
  return db.transaction(async (tx) => {
    // 1. Idempotency check
    const existing = await (tx as unknown as typeof db)
      .select()
      .from(transactions)
      .where(eq(transactions.clientUuid, params.clientUuid))
      .limit(1)

    if (existing.length > 0) {
      return existing[0]
    }

    // 2. Validate shift is OPEN
    const shiftRows = await (tx as unknown as typeof db)
      .select()
      .from(shifts)
      .where(and(eq(shifts.id, params.shiftId), eq(shifts.status, 'OPEN')))
      .limit(1)

    if (shiftRows.length === 0) {
      throw new Error('SHIFT_NOT_OPEN')
    }

    // 3. Insert transaction header (no stock check)
    const txId = randomUUID()
    const [transaction] = await (tx as unknown as typeof db)
      .insert(transactions)
      .values({
        id: txId,
        clientUuid: params.clientUuid,
        shiftId: params.shiftId,
        cashierId: params.cashierId,
        subtotal: params.subtotal,
        discountAmount: params.discountAmount,
        total: params.total,
        status: 'COMPLETED',
        createdAt: new Date(),
      })
      .returning()

    // 4. Insert transaction items
    await (tx as unknown as typeof db)
      .insert(transactionItems)
      .values(
        params.items.map((item) => ({
          id: randomUUID(),
          transactionId: transaction.id,
          variantId: item.variantId,
          qty: item.qty,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          lineTotal: item.lineTotal,
        }))
      )

    // 5. Insert transaction payments
    await (tx as unknown as typeof db)
      .insert(transactionPayments)
      .values(
        params.payments.map((payment) => ({
          id: randomUUID(),
          transactionId: transaction.id,
          method: payment.method,
          amount: payment.amount,
          reference: payment.reference,
        }))
      )

    // 6. For each item: recordMovement with [FORCE_COMPLETE] note + UPDATE stock
    for (const item of params.items) {
      await recordMovement(
        {
          variantId: item.variantId,
          movementType: 'SALE',
          qty: item.qty,
          reference: `${transaction.id} [FORCE_COMPLETE]`,
          performedBy: params.cashierId,
        },
        tx
      )

      await (tx as DrizzleTxForced).execute(
        sql`UPDATE product_variants SET stock_qty = stock_qty - ${item.qty}, updated_at = now() WHERE id = ${item.variantId}`
      )
    }

    // 7. Accounting stub
    await createJournalEntryStub(
      { transactionId: transaction.id, total: params.total },
      tx
    )

    // 8. Audit log for force-complete
    await logAudit({
      userId: params.cashierId,
      action: 'CREATE',
      tableName: 'transactions',
      recordId: transaction.id,
      oldValue: null,
      newValue: { status: 'COMPLETED', forceComplete: true, clientUuid: params.clientUuid },
      ipAddress: '0.0.0.0',
    })

    return transaction
  })
}

/**
 * Returns the distinct variantIds for all items in a transaction.
 * Used for cache invalidation after void.
 */
export async function getTransactionItemVariantIds(transactionId: string): Promise<string[]> {
  const rows = await db
    .select({ variantId: transactionItems.variantId })
    .from(transactionItems)
    .where(eq(transactionItems.transactionId, transactionId))

  return [...new Set(rows.map(r => r.variantId))]
}

/**
 * Looks up a transaction by its client-generated UUID (idempotency key).
 */
export async function getTransactionByClientUuid(clientUuid: string): Promise<Transaction | null> {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.clientUuid, clientUuid))

  return rows[0] ?? null
}

/**
 * Voids a completed transaction.
 * - Throws ALREADY_VOIDED if transaction is already voided
 * - Records RETURN inventory movements for each line item
 * - Creates journal entry reversal
 * - All operations run inside a single db.transaction()
 */
export async function voidTransaction(params: {
  transactionId: string
  voidReason: string
  performedBy: string
  ipAddress?: string
}): Promise<Transaction> {
  return db.transaction(async (tx) => {
    // Fetch transaction
    const txRows = await (tx as unknown as typeof db)
      .select()
      .from(transactions)
      .where(eq(transactions.id, params.transactionId))
      .limit(1)

    const transaction = txRows[0]
    if (!transaction) throw new Error('TRANSACTION_NOT_FOUND')
    if (transaction.status === 'VOIDED') throw new Error('ALREADY_VOIDED')

    // Fetch line items
    const items = await (tx as unknown as typeof db)
      .select()
      .from(transactionItems)
      .where(eq(transactionItems.transactionId, params.transactionId))

    // Record RETURN movement + restore stock for each item
    for (const item of items) {
      await recordMovement(
        {
          variantId: item.variantId,
          movementType: 'RETURN',
          qty: item.qty,
          reference: params.transactionId,
          performedBy: params.performedBy,
        },
        tx
      )

      await (tx as DrizzleTx).execute(
        sql`UPDATE product_variants SET stock_qty = stock_qty + ${item.qty}, updated_at = now() WHERE id = ${item.variantId}`
      )
    }

    // Create journal entry reversal
    await createJournalEntryReversal(
      { transactionId: params.transactionId, total: transaction.total },
      tx
    )

    // Update transaction to VOIDED
    const [voided] = await (tx as unknown as typeof db)
      .update(transactions)
      .set({
        status: 'VOIDED',
        voidReason: params.voidReason,
        voidedAt: new Date(),
      })
      .where(eq(transactions.id, params.transactionId))
      .returning()

    // Audit log — uses UPDATE action (audit_action enum only supports CREATE/UPDATE/DELETE)
    await logAudit({
      userId: params.performedBy,
      action: 'UPDATE',
      tableName: 'transactions',
      recordId: params.transactionId,
      oldValue: { status: 'COMPLETED' },
      newValue: { status: 'VOIDED', voidReason: params.voidReason },
      ipAddress: params.ipAddress ?? '0.0.0.0',
    })

    return voided
  })
}

/**
 * Lists transactions, optionally filtered by shiftId.
 * Returns transactions with item count and payment methods.
 */
export async function listTransactions(params: {
  shiftId?: string
  limit: number
  offset: number
}): Promise<{ transactions: Array<Record<string, unknown>>; total: number }> {
  const whereClause = params.shiftId
    ? sql`WHERE t.shift_id = ${params.shiftId}`
    : sql``

  const countResult = await db.execute(
    sql`SELECT COUNT(*)::int as total FROM transactions t ${whereClause}`
  )
  const total = (countResult as unknown as Array<{ total: number }>)[0]?.total ?? 0

  const rows = await db.execute(sql`
    SELECT
      t.id,
      t.client_uuid,
      t.shift_id,
      t.subtotal,
      t.discount_amount,
      t.total,
      t.status,
      t.note,
      t.created_at,
      (SELECT COUNT(*)::int FROM transaction_items ti WHERE ti.transaction_id = t.id) as item_count,
      (
        SELECT STRING_AGG(DISTINCT tp.method::text, ', ')
        FROM transaction_payments tp WHERE tp.transaction_id = t.id
      ) as payment_methods,
      (
        SELECT STRING_AGG(DISTINCT p.name, ', ')
        FROM transaction_items ti2
        JOIN product_variants pv ON pv.id = ti2.variant_id
        JOIN products p ON p.id = pv.product_id
        WHERE ti2.transaction_id = t.id
      ) as product_names
    FROM transactions t
    ${whereClause}
    ORDER BY t.created_at DESC
    LIMIT ${params.limit} OFFSET ${params.offset}
  `)

  return {
    transactions: rows as unknown as Array<Record<string, unknown>>,
    total,
  }
}

/**
 * Gets full transaction detail with items (including product names) and payments.
 */
export async function getTransactionDetail(transactionId: string) {
  const txRows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, transactionId))
    .limit(1)

  if (txRows.length === 0) return null

  const items = await db.execute(sql`
    SELECT
      ti.id,
      ti.variant_id,
      ti.qty,
      ti.unit_price,
      ti.discount_amount,
      ti.line_total,
      p.name as product_name,
      pv.sku
    FROM transaction_items ti
    JOIN product_variants pv ON pv.id = ti.variant_id
    JOIN products p ON p.id = pv.product_id
    WHERE ti.transaction_id = ${transactionId}
  `)

  const payments = await db
    .select()
    .from(transactionPayments)
    .where(eq(transactionPayments.transactionId, transactionId))

  return {
    ...txRows[0],
    items: items as unknown as Array<Record<string, unknown>>,
    payments,
  }
}

/**
 * Updates the note/keterangan field on a transaction.
 */
export async function updateTransactionNote(transactionId: string, note: string): Promise<Transaction> {
  const [updated] = await db
    .update(transactions)
    .set({ note })
    .where(eq(transactions.id, transactionId))
    .returning()

  if (!updated) throw new Error('TRANSACTION_NOT_FOUND')
  return updated
}

/**
 * Partial return — return specific items from a COMPLETED transaction.
 * - Restores stock for returned items
 * - Records RETURN inventory movements
 * - Creates journal entry reversal for refund amount
 * - Does NOT void the transaction — it stays COMPLETED
 */
export async function returnItems(params: {
  transactionId: string
  items: Array<{ variantId: string; qty: number; refundAmount: number }>
  reason: string
  performedBy: string
  ipAddress?: string
}): Promise<TransactionReturn[]> {
  return db.transaction(async (tx) => {
    // Validate transaction exists and is COMPLETED
    const txRows = await (tx as unknown as typeof db)
      .select()
      .from(transactions)
      .where(eq(transactions.id, params.transactionId))
      .limit(1)

    const transaction = txRows[0]
    if (!transaction) throw new Error('TRANSACTION_NOT_FOUND')
    if (transaction.status === 'VOIDED') throw new Error('TRANSACTION_VOIDED')

    // Get original items to validate qty
    const origItems = await (tx as unknown as typeof db)
      .select()
      .from(transactionItems)
      .where(eq(transactionItems.transactionId, params.transactionId))

    // Get already-returned quantities
    const existingReturns = await (tx as unknown as typeof db)
      .select()
      .from(transactionReturns)
      .where(eq(transactionReturns.transactionId, params.transactionId))

    const returnedQtyMap = new Map<string, number>()
    for (const r of existingReturns) {
      returnedQtyMap.set(r.variantId, (returnedQtyMap.get(r.variantId) ?? 0) + r.qty)
    }

    const results: TransactionReturn[] = []
    let totalRefund = 0

    for (const item of params.items) {
      // Find original item
      const orig = origItems.find(o => o.variantId === item.variantId)
      if (!orig) throw new Error(`ITEM_NOT_FOUND:${item.variantId}`)

      // Check qty doesn't exceed remaining
      const alreadyReturned = returnedQtyMap.get(item.variantId) ?? 0
      const maxReturnable = orig.qty - alreadyReturned
      if (item.qty > maxReturnable) {
        throw new Error(`EXCEED_QTY:${item.variantId}:max=${maxReturnable}`)
      }

      // Insert return record
      const [returnRow] = await (tx as unknown as typeof db)
        .insert(transactionReturns)
        .values({
          transactionId: params.transactionId,
          variantId: item.variantId,
          qty: item.qty,
          refundAmount: item.refundAmount,
          reason: params.reason,
          performedBy: params.performedBy,
        })
        .returning()

      results.push(returnRow)
      totalRefund += item.refundAmount

      // Restore stock
      await recordMovement(
        {
          variantId: item.variantId,
          movementType: 'RETURN',
          qty: item.qty,
          reference: params.transactionId,
          performedBy: params.performedBy,
        },
        tx
      )

      await (tx as DrizzleTx).execute(
        sql`UPDATE product_variants SET stock_qty = stock_qty + ${item.qty}, updated_at = now() WHERE id = ${item.variantId}`
      )
    }

    // Journal entry reversal for refund amount
    if (totalRefund > 0) {
      await createJournalEntryReversal(
        { transactionId: params.transactionId, total: totalRefund },
        tx
      )
    }

    // Audit log
    await logAudit({
      userId: params.performedBy,
      action: 'UPDATE',
      tableName: 'transactions',
      recordId: params.transactionId,
      oldValue: null,
      newValue: {
        type: 'PARTIAL_RETURN',
        items: params.items,
        reason: params.reason,
        totalRefund,
      },
      ipAddress: params.ipAddress ?? '0.0.0.0',
    })

    return results
  })
}

/**
 * Get all returns for a transaction.
 */
export async function getTransactionReturns(transactionId: string) {
  return db.execute(sql`
    SELECT
      tr.id,
      tr.variant_id,
      tr.qty,
      tr.refund_amount,
      tr.reason,
      tr.created_at,
      p.name AS product_name,
      pv.sku
    FROM transaction_returns tr
    JOIN product_variants pv ON pv.id = tr.variant_id
    JOIN products p ON p.id = pv.product_id
    WHERE tr.transaction_id = ${transactionId}
    ORDER BY tr.created_at DESC
  `)
}

/**
 * Returns unified order history combining retail transactions and service orders.
 * Results are sorted by created_at DESC (most recent first).
 */
export async function listUnifiedOrderHistory(params: {
  shiftId?: string
  limit: number
  offset: number
}): Promise<{ orders: Array<Record<string, unknown>>; total: number }> {
  // Build WHERE clause for retail transactions
  const retailWhere = params.shiftId
    ? sql`WHERE t.shift_id = ${params.shiftId}`
    : sql``

  // Count both types
  const countResult = await db.execute(sql`
    SELECT (
      (SELECT COUNT(*) FROM transactions t ${retailWhere})
      +
      (SELECT COUNT(*) FROM service_orders)
    )::int as total
  `)
  const total = (countResult as unknown as Array<{ total: number }>)[0]?.total ?? 0

  // UNION query: retail + service orders
  const rows = await db.execute(sql`
    (
      SELECT
        t.id,
        'RETAIL' as order_type,
        t.status::text as status,
        t.total,
        t.note,
        t.created_at,
        (SELECT COUNT(*)::int FROM transaction_items ti WHERE ti.transaction_id = t.id) as item_count,
        (
          SELECT STRING_AGG(DISTINCT tp.method::text, ', ')
          FROM transaction_payments tp WHERE tp.transaction_id = t.id
        ) as payment_methods,
        (
          SELECT STRING_AGG(DISTINCT p.name, ', ')
          FROM transaction_items ti2
          JOIN product_variants pv ON pv.id = ti2.variant_id
          JOIN products p ON p.id = pv.product_id
          WHERE ti2.transaction_id = t.id
        ) as label,
        NULL as plate_number,
        NULL as work_status,
        NULL as payment_status
      FROM transactions t
      ${retailWhere}
    )
    UNION ALL
    (
      SELECT
        so.id,
        'SERVICE' as order_type,
        so.work_status::text as status,
        COALESCE(
          (SELECT SUM(soi.line_total) FROM service_order_items soi WHERE soi.service_order_id = so.id),
          0
        )::int as total,
        so.complaint as note,
        so.created_at,
        (SELECT COUNT(*)::int FROM service_order_items soi2 WHERE soi2.service_order_id = so.id) as item_count,
        (
          SELECT STRING_AGG(DISTINCT sp.method::text, ', ')
          FROM service_payments sp WHERE sp.service_order_id = so.id
        ) as payment_methods,
        CONCAT(so.order_number, ' · ', v.plate_number) as label,
        v.plate_number,
        so.work_status::text as work_status,
        so.payment_status::text
      FROM service_orders so
      JOIN vehicles v ON v.id = so.vehicle_id
    )
    ORDER BY created_at DESC
    LIMIT ${params.limit} OFFSET ${params.offset}
  `)

  return {
    orders: rows as unknown as Array<Record<string, unknown>>,
    total,
  }
}
