import { and, eq, sql as drizzleSql } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { stockReservations, productVariants } from '../../db/schema/index.js'

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/**
 * Returns the sum of qty for all ACTIVE reservations for a variant.
 * Must be called with a transaction context (tx) when used inside a FOR UPDATE transaction.
 */
export async function getActiveReservedQty(tx: DrizzleTx | typeof db, variantId: string): Promise<number> {
  const rows = await (tx as typeof db)
    .select({ qty: stockReservations.qty })
    .from(stockReservations)
    .where(
      and(
        eq(stockReservations.variantId, variantId),
        eq(stockReservations.status, 'ACTIVE')
      )
    )

  return rows.reduce((sum, row) => sum + (row.qty ?? 0), 0)
}

/**
 * Creates a stock reservation.
 * Must be called with a transaction context so the stock check and insert are atomic.
 * Throws INSUFFICIENT_STOCK if available stock (stock_qty - active reservations) < qty.
 */
export async function createReservation(
  params: { variantId: string; qty: number; orderRef: string },
  tx: DrizzleTx
): Promise<typeof stockReservations.$inferSelect> {
  const { variantId, qty, orderRef } = params

  // Lock the variant row to prevent concurrent reservations from overselling
  const lockRows = await (tx as any).execute(
    sql`SELECT id, stock_qty FROM product_variants WHERE id = ${variantId} FOR UPDATE`
  )
  const variant = lockRows[0] as { id: string; stock_qty: number } | undefined
  if (!variant) throw new Error('VARIANT_NOT_FOUND')

  const reserved = await getActiveReservedQty(tx, variantId)
  const available = variant.stock_qty - reserved
  if (qty > available) throw new Error('INSUFFICIENT_STOCK')

  const [reservation] = await (tx as any)
    .insert(stockReservations)
    .values({
      variantId,
      qty,
      orderRef,
      status: 'ACTIVE' as const,
      reservedAt: new Date(),
    })
    .returning()

  return reservation
}

/**
 * Marks a reservation as CANCELLED and sets resolvedAt to now.
 */
export async function cancelReservation(reservationId: string): Promise<void> {
  await db
    .update(stockReservations)
    .set({ status: 'CANCELLED', resolvedAt: new Date() })
    .where(eq(stockReservations.id, reservationId))
}

/**
 * Marks a reservation as FULFILLED and sets resolvedAt to now.
 */
export async function fulfillReservation(reservationId: string): Promise<void> {
  await db
    .update(stockReservations)
    .set({ status: 'FULFILLED', resolvedAt: new Date() })
    .where(eq(stockReservations.id, reservationId))
}
