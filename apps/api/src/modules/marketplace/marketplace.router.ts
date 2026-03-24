import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { listChannels, getChannelOrders, getWebhookEvents } from './marketplace.service.js'

export const marketplaceRouter = Router()

// ─── Zod schemas ──────────────────────────────────────────────────────────

const channelFiltersSchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
})

const webhookFiltersSchema = z.object({
  eventType: z.string().optional(),
  limit: z.coerce.number().int().positive().optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
})

// ─── GET /channels ────────────────────────────────────────────────────────

/**
 * List all marketplace channels.
 * Requires: authenticated Owner or Admin.
 * Returns 200 { success: true, data: Channel[] }
 */
marketplaceRouter.get(
  '/channels',
  authenticate,
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    try {
      const channels = await listChannels()
      res.status(200).json({ success: true, data: channels, error: null })
    } catch (err) {
      console.error('[marketplace] GET /channels failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── GET /channels/:id/orders ────────────────────────────────────────────

/**
 * List orders for a marketplace channel.
 * Requires: authenticated Owner or Admin.
 * Query params: status?, limit?, offset?
 * Returns 200 { success: true, data: ChannelOrder[] }
 */
marketplaceRouter.get(
  '/channels/:id/orders',
  authenticate,
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    const filtersResult = channelFiltersSchema.safeParse(req.query)
    if (!filtersResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: filtersResult.error.issues[0]?.message ?? 'Invalid filters',
      })
      return
    }

    try {
      const orders = await getChannelOrders(req.params.id, filtersResult.data)
      res.status(200).json({ success: true, data: orders, error: null })
    } catch (err) {
      console.error('[marketplace] GET /channels/:id/orders failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── GET /channels/:id/webhooks ──────────────────────────────────────────

/**
 * List webhook events for a marketplace channel.
 * Requires: authenticated Owner or Admin.
 * Query params: eventType?, limit?, offset?
 * Returns 200 { success: true, data: WebhookEvent[] }
 */
marketplaceRouter.get(
  '/channels/:id/webhooks',
  authenticate,
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    const filtersResult = webhookFiltersSchema.safeParse(req.query)
    if (!filtersResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: filtersResult.error.issues[0]?.message ?? 'Invalid filters',
      })
      return
    }

    try {
      const events = await getWebhookEvents(req.params.id, filtersResult.data)
      res.status(200).json({ success: true, data: events, error: null })
    } catch (err) {
      console.error('[marketplace] GET /channels/:id/webhooks failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)
