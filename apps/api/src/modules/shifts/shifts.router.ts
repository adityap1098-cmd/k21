import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { openShift, closeShift, getShiftReconciliation } from './shifts.service.js'

export const shiftsRouter = Router()

// ─── Zod schemas ──────────────────────────────────────────────────────────

const openShiftBodySchema = z.object({
  openingFloat: z.number().int().nonnegative(),
})

const closeShiftBodySchema = z.object({
  shiftId: z.string().uuid(),
  closingCash: z.number().int().nonnegative(),
})

// ─── POST /shifts/open ────────────────────────────────────────────────────

/**
 * Opens a new cashier shift.
 * Requires: authenticated Cashier.
 * Body: { openingFloat: number }
 * Returns 201 { success: true, data: shift }
 * On SHIFT_ALREADY_OPEN → 409
 */
shiftsRouter.post(
  '/open',
  authenticate,
  requireRole('Cashier'),
  async (req, res) => {
    const result = openShiftBodySchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: result.error.issues[0]?.message ?? 'Invalid input',
      })
      return
    }

    try {
      const shift = await openShift({
        cashierId: req.user!.sub,
        openingFloat: result.data.openingFloat,
      })
      res.status(201).json({ success: true, data: shift, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to open shift'
      if (message === 'SHIFT_ALREADY_OPEN') {
        res.status(409).json({ success: false, data: null, error: 'A shift is already open' })
      } else {
        res.status(500).json({ success: false, data: null, error: message })
      }
    }
  }
)

// ─── POST /shifts/close ───────────────────────────────────────────────────

/**
 * Closes the cashier's current shift and returns the reconciliation report.
 * Requires: authenticated Cashier.
 * Body: { shiftId: string (uuid), closingCash: number }
 * Returns 200 { success: true, data: reconciliation }
 * On SHIFT_NOT_FOUND → 404; on SHIFT_NOT_OPEN → 409
 */
shiftsRouter.post(
  '/close',
  authenticate,
  requireRole('Cashier'),
  async (req, res) => {
    const result = closeShiftBodySchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: result.error.issues[0]?.message ?? 'Invalid input',
      })
      return
    }

    try {
      const reconciliation = await closeShift({
        shiftId: result.data.shiftId,
        cashierId: req.user!.sub,
        closingCash: result.data.closingCash,
      })
      res.status(200).json({ success: true, data: reconciliation, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to close shift'
      if (message === 'SHIFT_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: 'Shift not found' })
      } else if (message === 'SHIFT_NOT_OPEN') {
        res.status(409).json({ success: false, data: null, error: 'Shift is not open' })
      } else {
        res.status(500).json({ success: false, data: null, error: message })
      }
    }
  }
)

// ─── GET /shifts/:id/reconciliation ──────────────────────────────────────

/**
 * Returns the reconciliation report for a shift.
 * Requires: authenticated Cashier, Owner, or Admin.
 * Returns 200 { success: true, data: reconciliation }
 */
shiftsRouter.get(
  '/:id/reconciliation',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
  async (req, res) => {
    try {
      const reconciliation = await getShiftReconciliation(req.params.id)
      res.status(200).json({ success: true, data: reconciliation, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get reconciliation'
      if (message === 'SHIFT_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: 'Shift not found' })
      } else {
        res.status(500).json({ success: false, data: null, error: message })
      }
    }
  }
)
