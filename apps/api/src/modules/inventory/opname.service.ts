import { randomUUID } from 'crypto'
import { sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { recordMovement } from './movement.service.js'
import { invalidateStockCache } from './stock.service.js'

/**
 * Runs a stock opname (physical count reconciliation) for a batch of variants.
 *
 * For each variant where physicalCount differs from the current stock_qty:
 * - Acquires a row-level FOR UPDATE lock inside a transaction
 * - Inserts an ADJUSTMENT movement recording the discrepancy magnitude
 * - Updates stock_qty to the physicalCount (authoritative value)
 *
 * Zero-discrepancy variants are skipped — no movement is inserted.
 * The entire batch runs in a single transaction.
 *
 * @returns { adjustments: number, opnameId: string }
 */
export async function runStockOpname(params: {
  items: Array<{ variantId: string; physicalCount: number }>
  performedBy: string
  ipAddress: string
}): Promise<{ adjustments: number; opnameId: string }> {
  const opnameId = randomUUID()
  const adjustedVariantIds: string[] = []

  await db.transaction(async (tx) => {
    for (const item of params.items) {
      const rows = await tx.execute(
        sql`SELECT id, stock_qty FROM product_variants WHERE id = ${item.variantId} FOR UPDATE`
      )
      const variant = (rows as unknown as Array<{ id: string; stock_qty: number }>)[0]
      if (!variant) continue // skip missing variants rather than failing entire batch

      const discrepancy = item.physicalCount - variant.stock_qty
      if (discrepancy === 0) continue

      // recordMovement stores movement magnitude; explicit UPDATE sets the authoritative value
      await recordMovement({
        variantId: item.variantId,
        movementType: 'ADJUSTMENT',
        qty: Math.abs(discrepancy),
        reference: `OPNAME-${opnameId}`,
        reason: `Stock opname ${opnameId}`,
        approvedBy: params.performedBy, // v1: performer is also approver
        performedBy: params.performedBy,
      }, tx)

      await tx.execute(
        sql`UPDATE product_variants SET stock_qty = ${item.physicalCount}, updated_at = now() WHERE id = ${item.variantId}`
      )

      adjustedVariantIds.push(item.variantId)
    }
  })

  // Invalidate Redis cache for adjusted variants after transaction commits
  await Promise.all(adjustedVariantIds.map(id => invalidateStockCache(id)))

  return { adjustments: adjustedVariantIds.length, opnameId }
}
