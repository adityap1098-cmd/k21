import { Queue, Worker } from 'bullmq'
import { bullmqRedis } from './redis.js'
import { processLowStockAlert } from '../modules/inventory/lowstock.service.js'

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
export function createLowStockWorker(): Worker<LowStockJobData> {
  const worker = new Worker<LowStockJobData>(
    'low-stock-alerts',
    async (job) => {
      const { variantId, currentStock } = job.data
      const count = await processLowStockAlert({ variantId, currentStock })
      console.log(`[low-stock-worker] created ${count} notifications for variant ${variantId}`)
    },
    { connection: bullmqRedis },
  )

  return worker
}
