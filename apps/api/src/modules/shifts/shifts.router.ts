import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { openShift, closeShift, getShiftReconciliation, getActiveShift, addCashTransaction, getCashTransactions, listShifts, getDailyCashReport } from './shifts.service.js'

export const shiftsRouter = Router()

// ─── Zod schemas ──────────────────────────────────────────────────────────

const openShiftBodySchema = z.object({
  openingFloat: z.number().int().nonnegative(),
})

const closeShiftBodySchema = z.object({
  shiftId: z.string().uuid(),
  closingCash: z.number().int().nonnegative(),
})

const cashTxSchema = z.object({
  shiftId: z.string().uuid(),
  type: z.enum(['IN', 'OUT']),
  amount: z.number().int().positive('Nominal harus lebih dari 0'),
  description: z.string().min(1, 'Keterangan harus diisi').max(255),
})

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(['OPEN', 'CLOSED']).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  cashierId: z.string().uuid().optional(),
})

// ═══════════════════════════════════════════════════════════════════════════
// STATIC ROUTES (must be before /:id parameterized routes)
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /shifts/active ─────────────────────────────────────────────────
shiftsRouter.get(
  '/active',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
  async (req, res) => {
    try {
      const shift = await getActiveShift(req.user!.sub)
      res.json({ success: true, data: shift, error: null })
    } catch (err) {
      console.error('[shifts] GET /active failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  },
)

// ─── GET /shifts/history ────────────────────────────────────────────────
shiftsRouter.get(
  '/history',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin', 'Finance'),
  async (req, res) => {
    const parsed = historyQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ success: false, data: null, error: 'Invalid query parameters' })
      return
    }

    try {
      const result = await listShifts(parsed.data)
      res.json({ success: true, data: result, error: null })
    } catch (err) {
      console.error('[shifts] GET /history failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── GET /shifts/daily-report ───────────────────────────────────────────
shiftsRouter.get(
  '/daily-report',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin', 'Finance'),
  async (req, res) => {
    const date = typeof req.query.date === 'string' ? req.query.date : new Date().toISOString().slice(0, 10)

    try {
      const report = await getDailyCashReport(date)
      res.json({ success: true, data: report, error: null })
    } catch (err) {
      console.error('[shifts] GET /daily-report failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── POST /shifts/open ──────────────────────────────────────────────────
shiftsRouter.post(
  '/open',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
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
        console.error('[shifts] POST /open failed:', err)
        res.status(500).json({ success: false, data: null, error: 'Internal server error' })
      }
    }
  }
)

// ─── POST /shifts/close ─────────────────────────────────────────────────
shiftsRouter.post(
  '/close',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
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
        console.error('[shifts] POST /close failed:', err)
        res.status(500).json({ success: false, data: null, error: 'Internal server error' })
      }
    }
  }
)

// ─── POST /shifts/cash-transaction ──────────────────────────────────────
shiftsRouter.post(
  '/cash-transaction',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
  async (req, res) => {
    const result = cashTxSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: result.error.issues[0]?.message ?? 'Invalid input',
      })
      return
    }

    try {
      const tx = await addCashTransaction({
        ...result.data,
        createdBy: req.user!.sub,
      })
      res.status(201).json({ success: true, data: tx, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed'
      if (message === 'SHIFT_NOT_OPEN') {
        res.status(409).json({ success: false, data: null, error: 'Shift tidak aktif' })
      } else {
        console.error('[shifts] POST /cash-transaction failed:', err)
        res.status(500).json({ success: false, data: null, error: 'Internal server error' })
      }
    }
  }
)

// ═══════════════════════════════════════════════════════════════════════════
// PARAMETERIZED ROUTES (/:id must come AFTER static routes)
// ═══════════════════════════════════════════════════════════════════════════

// ─── GET /shifts/:id/reconciliation ─────────────────────────────────────
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
        console.error('[shifts] GET /:id/reconciliation failed:', err)
        res.status(500).json({ success: false, data: null, error: 'Internal server error' })
      }
    }
  }
)

// ─── GET /shifts/:id/cash-transactions ──────────────────────────────────
shiftsRouter.get(
  '/:id/cash-transactions',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
  async (req, res) => {
    try {
      const list = await getCashTransactions(req.params.id)
      res.json({ success: true, data: list, error: null })
    } catch (err) {
      console.error('[shifts] GET /:id/cash-transactions failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)
