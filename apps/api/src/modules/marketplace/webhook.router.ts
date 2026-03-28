/**
 * Webhook Router — Shopee Inbound Webhooks
 *
 * CRITICAL MOUNT ORDER: This router MUST be mounted on `app` BEFORE
 * `app.use(express.json(...))`. It uses `express.raw()` at the route level
 * to capture the raw Buffer needed for HMAC-SHA256 verification. If the
 * global JSON middleware runs first, the raw body is lost and HMAC will
 * always fail.
 *
 * Mount with: app.use('/api/v1/webhooks', webhookRouter)
 */

import crypto from 'crypto'
import { randomUUID } from 'crypto'
import express, { Router } from 'express'
import { Queue } from 'bullmq'
import { db } from '../../db/index.js'
import { marketplaceWebhookEvents, marketplaceChannels } from '../../db/schema/marketplace.js'
import { bullmqRedis } from '../../queues/redis.js'
import { eq } from 'drizzle-orm'

export const webhookRouter = Router()

// BullMQ queue — must use bullmqRedis (maxRetriesPerRequest: null)
// Created here (not imported from queues.ts) to guarantee the correct connection.
const marketplaceQueue = new Queue('marketplace', { connection: bullmqRedis })

// ─── HMAC Verification ──────────────────────────────────────────────────────

/**
 * Verifies the Shopee webhook HMAC-SHA256 signature.
 *
 * Shopee signs the raw request body with HMAC-SHA256 using the partner key.
 * Uses timingSafeEqual to prevent timing-based attacks.
 *
 * @returns true if the signature is valid, false on any error or mismatch
 */
export function verifyShopeeSignature(
  rawBody: Buffer,
  signature: string,
  partnerKey: string
): boolean {
  try {
    const expected = crypto
      .createHmac('sha256', partnerKey)
      .update(rawBody)
      .digest('hex')

    const expectedBuf = Buffer.from(expected, 'hex')
    const actualBuf = Buffer.from(signature, 'hex')

    // Buffers must be same length for timingSafeEqual; return false if not
    if (expectedBuf.length !== actualBuf.length) return false

    return crypto.timingSafeEqual(expectedBuf, actualBuf)
  } catch {
    // Invalid hex string, empty signature, or any unexpected error → reject
    return false
  }
}

// ─── POST /shopee ────────────────────────────────────────────────────────────

/**
 * Receives Shopee webhook events.
 *
 * Flow:
 *  1. Capture raw body via express.raw()
 *  2. Parse JSON manually
 *  3. Resolve channelId from marketplace_channels by shop_id
 *  4. Log event to marketplace_webhook_events (BEFORE responding)
 *  5. Verify HMAC — if invalid: update row to SKIPPED, return 401
 *  6. Enqueue BullMQ job with eventId, return 200
 */
webhookRouter.post(
  '/shopee',
  // Route-level raw body middleware — must be here, not global
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const rawBody = req.body as Buffer

    // Parse JSON — if body is not valid JSON, reject early
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>
    } catch {
      res.status(400).json({ success: false, error: 'Invalid JSON body' })
      return
    }

    const shopId = String(payload.shop_id ?? '')
    const eventType = String(payload.code ?? payload.event_type ?? 'unknown')
    const incomingSignature = String(req.headers['authorization'] ?? req.headers['x-shopee-signature'] ?? '')

    // Resolve channelId from marketplace_channels by shop_id (null if not found)
    let channelId: string | null = null
    try {
      if (shopId) {
        const [channel] = await db
          .select({ id: marketplaceChannels.id })
          .from(marketplaceChannels)
          .where(eq(marketplaceChannels.shopId, shopId))
          .limit(1)
        channelId = channel?.id ?? null
      }
    } catch {
      // Non-fatal — proceed without channelId
    }

    // Insert webhook event log BEFORE returning any response
    // This ensures all inbound requests are traceable regardless of validity.
    const eventId = randomUUID()
    try {
      await db.insert(marketplaceWebhookEvents).values({
        id: eventId,
        channelId,
        eventType,
        payload,
        processingStatus: 'PENDING',
        createdAt: new Date(),
      })
    } catch (err) {
      console.error('[webhook] Failed to insert webhook event:', err)
      res.status(500).json({ success: false, error: 'Internal server error' })
      return
    }

    // Verify HMAC signature
    const partnerKey = process.env.SHOPEE_PARTNER_KEY
    if (!partnerKey) {
      console.error('[webhook] SHOPEE_PARTNER_KEY not configured — rejecting webhook')
      res.status(500).json({ success: false, error: 'Webhook verification not configured' })
      return
    }
    const isValid = verifyShopeeSignature(rawBody, incomingSignature, partnerKey)

    if (!isValid) {
      // Mark event as SKIPPED with error message
      try {
        await db
          .update(marketplaceWebhookEvents)
          .set({ processingStatus: 'SKIPPED', errorMessage: 'Invalid HMAC signature' })
          .where(eq(marketplaceWebhookEvents.id, eventId))
      } catch (updateErr) {
        console.error('[webhook] Failed to update event status to SKIPPED:', updateErr)
      }

      console.log(`[webhook] HMAC verification failed for eventId=${eventId} eventType=${eventType}`)
      res.status(401).json({ success: false, error: 'Invalid signature' })
      return
    }

    // Valid signature — enqueue BullMQ job
    try {
      await marketplaceQueue.add('process-webhook', {
        eventId,
        eventType,
        payload,
        channelId,
      })
    } catch (err) {
      console.error('[webhook] Failed to enqueue job for eventId=${eventId}:', err)
      // Update event row to FAILED so it's visible in diagnostics
      await db
        .update(marketplaceWebhookEvents)
        .set({ processingStatus: 'FAILED', errorMessage: 'Failed to enqueue job' })
        .where(eq(marketplaceWebhookEvents.id, eventId))
        .catch(() => undefined)

      res.status(500).json({ success: false, error: 'Internal server error' })
      return
    }

    console.log(`[webhook] Enqueued job for eventId=${eventId} eventType=${eventType}`)
    res.status(200).json({ success: true })
  }
)
