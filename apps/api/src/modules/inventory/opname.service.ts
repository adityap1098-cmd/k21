import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { productVariants } from '../../db/schema/index.js'
import { recordMovement } from './movement.service.js'

/**
 * Runs a stock opname (physical count reconciliation).
 * For each variant where physicalCount differs from current stock_qty,
 * inserts an ADJUSTMENT movement to record the discrepancy.
 *
 * @param counts - Array of { variantId, physicalCount } items
 * @param performedBy - User ID performing the opname
 * @param approvedBy - User ID who approved the opname
 * @returns Number of variants that had discrepancies and were adjusted
 */
export async function runStockOpname(
  counts: Array<{ variantId: string; physicalCount: number }>,
  performedBy: string,
  approvedBy: string
): Promise<number> {
  let adjustedCount = 0

  for (const { variantId, physicalCount } of counts) {
    const rows = await db
      .select({ stockQty: productVariants.stockQty })
      .from(productVariants)
      .where(eq(productVariants.id, variantId))
      .limit(1)

    const currentStock = rows[0]?.stockQty ?? 0

    if (physicalCount === currentStock) continue

    const diff = Math.abs(physicalCount - currentStock)
    await recordMovement({
      variantId,
      movementType: 'ADJUSTMENT',
      qty: diff,
      reason: `Opname: physical count ${physicalCount}, system count ${currentStock}`,
      approvedBy,
      performedBy,
    })

    adjustedCount++
  }

  return adjustedCount
}
