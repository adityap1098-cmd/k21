import { Queue, Worker } from 'bullmq'
import { eq, or } from 'drizzle-orm'
import { bullmqRedis } from './redis.js'
import { db as defaultDb } from '../db/index.js'
import { users } from '../db/schema/index.js'

export interface LowStockJobData {
  variantId: string
  currentStock: number
}

export const lowStockQueue = new Queue<LowStockJobData>('low-stock-alerts', {
  connection: bullmqRedis,
})

/**
 * Creates a BullMQ Worker for low-stock alert dispatch.
 * NOT auto-started on import — call this from apps/api/src/index.ts at startup
 * to avoid side-effects during testing.
 */
export function createLowStockWorker(
  db: typeof defaultDb = defaultDb,
): Worker<LowStockJobData> {
  const worker = new Worker<LowStockJobData>(
    'low-stock-alerts',
    async (job) => {
      const { variantId, currentStock } = job.data

      // Query all Owner and Admin users to notify
      const recipients = await db
        .select({ id: users.id })
        .from(users)
        .where(or(eq(users.role, 'Owner'), eq(users.role, 'Admin')))

      if (recipients.length > 0) {
        // notifications table is forward-declared — it will be created in plan 02-02 schema migration.
        // After that migration, replace this with db.insert(notifications).values(notificationRows).
        const notificationRows = recipients.map((user) => ({
          userId: user.id,
          type: 'LOW_STOCK' as const,
          payload: { variantId, currentStock },
          readAt: null as Date | null,
        }))

        console.log(
          `[low-stock-worker] notification created for variantId=${variantId}`,
          `recipients=${recipients.length}`,
          notificationRows,
        )
      }
    },
    { connection: bullmqRedis },
  )

  return worker
}
