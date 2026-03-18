import { randomUUID } from 'crypto'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { transactions, transactionItems, transactionPayments, shifts } from '../../db/schema/pos.js'
import type { Transaction } from '../../db/schema/pos.js'
import { recordMovement } from '../inventory/movement.service.js'
import { createJournalEntryStub, createJournalEntryReversal } from '../accounting/accounting.service.js'

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
 */
export async function syncOfflineTx(params: CompleteSaleParams): Promise<SyncResult> {
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

    return voided
  })
}
