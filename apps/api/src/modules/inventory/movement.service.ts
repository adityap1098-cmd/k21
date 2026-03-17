import { randomUUID } from 'crypto'
import { sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { inventoryMovements } from '../../db/schema/index.js'
import { lowStockQueue } from '../../queues/lowstock.queue.js'
import { invalidateStockCache } from './stock.service.js'
import { getActiveReservedQty } from './reservation.service.js'

export type MovementType = 'SALE' | 'PURCHASE' | 'TRANSFER' | 'RETURN' | 'ADJUSTMENT'

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Inserts an append-only inventory_movements row.
 * - ADJUSTMENT requires reason and approvedBy
 * - SALE and TRANSFER get negative qty; all others get positive qty
 * - Does NOT update stock_qty (caller is responsible)
 */
export async function recordMovement(
  params: {
    variantId: string
    movementType: MovementType
    qty: number
    reference?: string
    reason?: string
    approvedBy?: string
    performedBy: string
  },
  tx?: DrizzleTx | typeof db
): Promise<void> {
  if (params.movementType === 'ADJUSTMENT') {
    if (!params.reason) throw new Error('REASON_REQUIRED')
    if (!params.approvedBy) throw new Error('APPROVER_REQUIRED')
  }

  // Sign convention: SALE and TRANSFER reduce stock (negative), others add stock (positive)
  const signedQty = ['SALE', 'TRANSFER'].includes(params.movementType)
    ? -Math.abs(params.qty)
    : Math.abs(params.qty)

  const executor = tx ?? db
  await (executor as typeof db).insert(inventoryMovements).values({
    id: randomUUID(),
    variantId: params.variantId,
    movementType: params.movementType,
    qty: signedQty,
    reference: params.reference,
    reason: params.reason,
    approvedBy: params.approvedBy,
    performedBy: params.performedBy,
    createdAt: new Date(),
  })
}

/**
 * Decrements stock for a variant using SELECT FOR UPDATE inside a transaction.
 * Available stock = stock_qty - SUM(active reservations).
 * Throws INSUFFICIENT_STOCK if requested qty > available.
 * After commit: invalidates Redis cache and enqueues low-stock BullMQ job if threshold crossed.
 */
export async function decrementStock(params: {
  variantId: string
  qty: number
  movementType: 'SALE' | 'TRANSFER'
  reference?: string
  performedBy: string
}): Promise<void> {
  let newStockQty: number = 0

  await db.transaction(async (tx) => {
    // Row-level lock — MUST use tx.execute, not db.execute (PgBouncer TRANSACTION mode pitfall)
    const rows = await tx.execute(
      sql`SELECT id, stock_qty, low_stock_threshold FROM product_variants WHERE id = ${params.variantId} FOR UPDATE`
    )
    const variant = (rows as unknown as Array<{
      id: string
      stock_qty: number
      low_stock_threshold: number | null
    }>)[0]

    if (!variant) throw new Error('VARIANT_NOT_FOUND')

    const reserved = await getActiveReservedQty(tx, params.variantId)
    const available = variant.stock_qty - reserved
    if (params.qty > available) throw new Error('INSUFFICIENT_STOCK')

    await recordMovement({ ...params, qty: params.qty }, tx)

    await tx.execute(
      sql`UPDATE product_variants SET stock_qty = stock_qty - ${params.qty}, updated_at = now() WHERE id = ${params.variantId}`
    )

    newStockQty = variant.stock_qty - params.qty

    // Enqueue low-stock alert if threshold crossed (inside transaction for consistent read)
    if (variant.low_stock_threshold !== null && newStockQty <= variant.low_stock_threshold) {
      await lowStockQueue.add('check-low-stock', {
        variantId: params.variantId,
        currentStock: newStockQty,
      })
    }
  })

  // Cache invalidation after transaction commits
  await invalidateStockCache(params.variantId)
}
