import { randomUUID } from 'crypto'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users, notifications } from '../../db/schema/index.js'

/**
 * Processes a low-stock alert by creating notification rows for all Owner and Admin users.
 *
 * Queries for all active Owner/Admin users and bulk-inserts a LOW_STOCK notification
 * for each. Called by the BullMQ low-stock worker.
 *
 * @returns Number of notifications created
 */
export async function processLowStockAlert(params: {
  variantId: string
  currentStock: number
}): Promise<number> {
  const recipients = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        inArray(users.role, ['Owner', 'Admin']),
        eq(users.isActive, true)
      )
    )

  if (recipients.length === 0) return 0

  await db.insert(notifications).values(
    recipients.map(user => ({
      id: randomUUID(),
      userId: user.id,
      type: 'LOW_STOCK',
      payload: { variantId: params.variantId, currentStock: params.currentStock },
      readAt: null as Date | null,
      createdAt: new Date(),
    }))
  )

  return recipients.length
}
