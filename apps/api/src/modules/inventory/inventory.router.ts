import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { getStockCached } from './stock.service.js'
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

/**
 * Returns cached stock level for a variant.
 * Requires: authenticated user.
 */
inventoryRouter.get('/stock/:variantId', authenticate, async (req, res) => {
  const { variantId } = req.params
  try {
    const stockQty = await getStockCached(variantId)
    res.status(200).json({ success: true, data: { variantId, stockQty }, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get stock'
    res.status(500).json({ success: false, data: null, error: message })
  }
})

// ─── POST /inventory/opname ───────────────────────────────────────────────

/**
 * Runs a stock opname batch reconciliation.
 * Requires: Admin, Owner, or Warehouse Staff.
 */
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
      const message = err instanceof Error ? err.message : 'Opname failed'
      res.status(500).json({ success: false, data: null, error: message })
    }
  }
)

// ─── POST /inventory/movements ────────────────────────────────────────────

/**
 * Manually records a PURCHASE, RETURN, or ADJUSTMENT movement.
 * Note: SALE and TRANSFER are handled by POS and Procurement phases respectively.
 * Requires: Admin, Owner, or Warehouse Staff.
 */
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
          // ADJUSTMENT qty is signed: positive = add stock, negative = remove stock
          await tx.execute(
            sql`UPDATE product_variants SET stock_qty = stock_qty + ${qty}, updated_at = now() WHERE id = ${variantId}`
          )
        }
      })

      res.status(201).json({ success: true, data: null, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Movement failed'
      if (message === 'REASON_REQUIRED') {
        res.status(400).json({ success: false, data: null, error: 'Reason is required for adjustments' })
      } else if (message === 'APPROVER_REQUIRED') {
        res.status(400).json({ success: false, data: null, error: 'ApprovedBy is required for adjustments' })
      } else if (message === 'VARIANT_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: 'Variant not found' })
      } else if (message === 'INSUFFICIENT_STOCK') {
        res.status(409).json({ success: false, data: null, error: 'Insufficient stock' })
      } else {
        res.status(500).json({ success: false, data: null, error: message })
      }
    }
  }
)

// ─── GET /inventory/reservations/:variantId ───────────────────────────────

/**
 * Returns active reservations for a variant.
 * Requires: Admin, Owner, or Warehouse Staff.
 */
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
      const message = err instanceof Error ? err.message : 'Failed to get reservations'
      res.status(500).json({ success: false, data: null, error: message })
    }
  }
)
