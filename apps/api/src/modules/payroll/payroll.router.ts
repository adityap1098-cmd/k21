import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { resolveError } from '../../middleware/error-handler.js'
import { listEmployees, listPayrollRuns, createPayrollRun } from './payroll.service.js'

export const payrollRouter = Router()

// ─── Zod schemas ──────────────────────────────────────────────────────────

const createPayrollRunBodySchema = z.object({
  period: z.string().min(1, 'Period is required'),
})

// ─── GET /payroll/employees ───────────────────────────────────────────────

/**
 * Lists all employees with salary info (derived from users table).
 * Requires: authenticated user with Owner or Finance role.
 * Returns 200 { success: true, data: Employee[] }
 */
payrollRouter.get(
  '/employees',
  authenticate,
  requireRole('Owner', 'Finance'),
  async (_req, res) => {
    try {
      const employees = await listEmployees()
      res.status(200).json({ success: true, data: employees, error: null })
    } catch (err) {
      console.error('[payroll] GET /employees failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── GET /payroll/runs ────────────────────────────────────────────────────

/**
 * Lists all payroll runs.
 * Requires: authenticated user with Owner or Finance role.
 * Returns 200 { success: true, data: PayrollRun[] }
 */
payrollRouter.get(
  '/runs',
  authenticate,
  requireRole('Owner', 'Finance'),
  async (_req, res) => {
    try {
      const runs = await listPayrollRuns()
      res.status(200).json({ success: true, data: runs, error: null })
    } catch (err) {
      console.error('[payroll] GET /runs failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── POST /payroll/runs ───────────────────────────────────────────────────

/**
 * Creates a new payroll run.
 * Requires: authenticated user with Owner or Finance role.
 * Body: { period: string }
 * Returns 201 { success: true, data: PayrollRun }
 */
payrollRouter.post(
  '/runs',
  authenticate,
  requireRole('Owner', 'Finance'),
  async (req, res) => {
    const result = createPayrollRunBodySchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: result.error.issues[0]?.message ?? 'Invalid input',
      })
      return
    }

    try {
      const payrollRun = await createPayrollRun({
        period: result.data.period,
      })
      res.status(201).json({ success: true, data: payrollRun, error: null })
    } catch (err) {
      const { status, message } = resolveError(err)
      if (status >= 500) console.error('[payroll] POST /runs failed:', err)
      res.status(status).json({ success: false, data: null, error: message })
    }
  }
)
