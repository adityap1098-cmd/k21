import { Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import { bullmqRedis } from '../queues/redis.js'
import { db } from '../db/index.js'
import { marketplaceWebhookEvents } from '../db/schema/marketplace.js'
import {
  processOrderCreated,
  processOrderCancelled,
  processOrderShipped,
} from '../modules/marketplace/marketplace.service.js'

// ─── Job Data Shape ───────────────────────────────────────────────────────────

export interface MarketplaceJobData {
  eventId: string
  eventType: string
  payload: Record<string, unknown>
  channelId?: string | null
}

// ─── Event Type Routing ───────────────────────────────────────────────────────

// Shopee webhook codes: 3 = order.created, 15 = order.cancelled, 12 = logistics (shipped)
// Accept both numeric code strings and named event types for flexibility.
const ORDER_CREATED_CODES   = new Set(['3', 'order.created',   'ORDER_CREATED'])
const ORDER_CANCELLED_CODES = new Set(['15', 'order.cancelled', 'ORDER_CANCELLED', '4'])
const ORDER_SHIPPED_CODES   = new Set(['12', 'order.shipped',   'ORDER_SHIPPED',   'LOGISTICS'])

// ─── Worker Factory ───────────────────────────────────────────────────────────

/**
 * Creates a BullMQ Worker for Shopee marketplace webhook processing.
 *
 * NOT auto-started on import — call this from apps/api/src/index.ts at startup
 * to avoid side-effects during testing.
 *
 * On job start:  logs [marketplace-worker] processing jobId=X eventType=Y
 * On success:    updates marketplace_webhook_events.processingStatus = 'PROCESSED'
 * On failure:    updates to 'FAILED' + sets errorMessage
 */
export function createMarketplaceWorker(): Worker<MarketplaceJobData> {
  const worker = new Worker<MarketplaceJobData>(
    'marketplace',
    async (job) => {
      const { eventId, eventType, payload, channelId = null } = job.data

      console.log(
        `[marketplace-worker] processing jobId=${job.id} eventType=${eventType} eventId=${eventId}`
      )

      // Route to the appropriate service function by event type / code
      const code = String(eventType)

      if (ORDER_CREATED_CODES.has(code)) {
        await processOrderCreated(
          payload as Parameters<typeof processOrderCreated>[0],
          eventId,
          channelId
        )
      } else if (ORDER_CANCELLED_CODES.has(code)) {
        await processOrderCancelled(
          payload as Parameters<typeof processOrderCancelled>[0]
        )
      } else if (ORDER_SHIPPED_CODES.has(code)) {
        await processOrderShipped(
          payload as Parameters<typeof processOrderShipped>[0]
        )
      } else {
        // Unknown event type — log and skip (still marks PROCESSED so it doesn't linger)
        console.log(
          `[marketplace-worker] unknown eventType=${eventType} jobId=${job.id} — marking PROCESSED`
        )
      }

      // Mark event as PROCESSED
      await db
        .update(marketplaceWebhookEvents)
        .set({ processingStatus: 'PROCESSED', processedAt: new Date() })
        .where(eq(marketplaceWebhookEvents.id, eventId))

      console.log(
        `[marketplace-worker] completed jobId=${job.id} eventType=${eventType}`
      )
    },
    { connection: bullmqRedis }
  )

  // Error handler — updates event row to FAILED with error message
  worker.on('failed', async (job, err) => {
    const jobId = job?.id ?? 'unknown'
    const eventType = job?.data?.eventType ?? 'unknown'
    const eventId = job?.data?.eventId

    console.error(
      `[marketplace-worker] FAILED jobId=${jobId} eventType=${eventType} error=${err.message}`
    )

    if (eventId) {
      try {
        await db
          .update(marketplaceWebhookEvents)
          .set({
            processingStatus: 'FAILED',
            errorMessage: err.message.slice(0, 2000), // guard against oversized messages
          })
          .where(eq(marketplaceWebhookEvents.id, eventId))
      } catch (updateErr) {
        console.error(
          `[marketplace-worker] failed to update event row for eventId=${eventId}: ${(updateErr as Error).message}`
        )
      }
    }
  })

  return worker
}
