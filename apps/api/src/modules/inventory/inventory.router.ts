import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { resolveError } from '../../middleware/error-handler.js'
import { getStockCached, invalidateStockCache } from './stock.service.js'
import { runStockOpname } from './opname.service.js'
import { recordMovement } from './movement.service.js'
import { getActiveReservedQty } from './reservation.service.js'
import { db } from '../../db/index.js'
import { sql } from 'drizzle-orm'

export const inventoryRouter = Router()

// ─── Schema definitions ────────────────────────────────────────────────────

const opnameBodySchema = z.object({
  items: z.array(
    z.object({
      variantId: z.string().uuid(),
      physicalCount: z.number().int().nonnegative(),
    })
  ).min(1),
})

const movementBodySchema = z.object({
  variantId: z.string().uuid(),
  movementType: z.enum(['PURCHASE', 'RETURN', 'ADJUSTMENT']),
  qty: z.number().int().refine(v => v !== 0, { message: 'qty must not be zero' }),
  reference: z.string().optional(),
  reason: z.string().optional(),
  approvedBy: z.string().uuid().optional(),
})

// ─── GET /inventory/stock/:variantId ──────────────────────────────────────

inventoryRouter.get('/stock/:variantId', authenticate, async (req, res) => {
  const { variantId } = req.params
  try {
    const stockQty = await getStockCached(variantId)
    res.status(200).json({ success: true, data: { variantId, stockQty }, error: null })
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[inventory] GET /stock/:variantId failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})

// ─── POST /inventory/opname ───────────────────────────────────────────────

inventoryRouter.post(
  '/opname',
  authenticate,
  requireRole('Admin', 'Owner', 'Warehouse Staff'),
  async (req, res) => {
    const result = opnameBodySchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: result.error.issues[0]?.message ?? 'Invalid input',
      })
      return
    }

    try {
      const { adjustments, opnameId } = await runStockOpname({
        items: result.data.items,
        performedBy: req.user!.sub,
        ipAddress: req.ip ?? 'unknown',
      })
      res.status(200).json({ success: true, data: { adjustments, opnameId }, error: null })
    } catch (err) {
      const { status, message } = resolveError(err)
      if (status >= 500) console.error('[inventory] POST /opname failed:', err)
      res.status(status).json({ success: false, data: null, error: message })
    }
  }
)

// ─── POST /inventory/movements ────────────────────────────────────────────

inventoryRouter.post(
  '/movements',
  authenticate,
  requireRole('Admin', 'Owner', 'Warehouse Staff'),
  async (req, res) => {
    const result = movementBodySchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: result.error.issues[0]?.message ?? 'Invalid input',
      })
      return
    }

    const { variantId, movementType, qty, reference, reason, approvedBy } = result.data

    try {
      await db.transaction(async (tx) => {
        await recordMovement(
          {
            variantId,
            movementType,
            qty,
            reference,
            reason,
            approvedBy,
            performedBy: req.user!.sub,
          },
          tx
        )

        // Update stock_qty in the same transaction
        if (movementType === 'PURCHASE' || movementType === 'RETURN') {
          await tx.execute(
            sql`UPDATE product_variants SET stock_qty = stock_qty + ${Math.abs(qty)}, updated_at = now() WHERE id = ${variantId}`
          )
        } else if (movementType === 'ADJUSTMENT') {
          await tx.execute(
            sql`UPDATE product_variants SET stock_qty = stock_qty + ${qty}, updated_at = now() WHERE id = ${variantId}`
          )
        }
      })

      // Invalidate cache AFTER transaction commits so reads get fresh data
      await invalidateStockCache(variantId)

      res.status(201).json({ success: true, data: null, error: null })
    } catch (err) {
      const { status, message } = resolveError(err)
      if (status >= 500) console.error('[inventory] POST /movements failed:', err)
      res.status(status).json({ success: false, data: null, error: message })
    }
  }
)

// ─── GET /inventory/reservations/:variantId ───────────────────────────────

inventoryRouter.get(
  '/reservations/:variantId',
  authenticate,
  requireRole('Admin', 'Owner', 'Warehouse Staff'),
  async (req, res) => {
    const { variantId } = req.params
    try {
      const reservedQty = await getActiveReservedQty(db, variantId)
      res.status(200).json({ success: true, data: { variantId, reservedQty }, error: null })
    } catch (err) {
      const { status, message } = resolveError(err)
      if (status >= 500) console.error('[inventory] GET /reservations/:variantId failed:', err)
      res.status(status).json({ success: false, data: null, error: message })
    }
  }
)
