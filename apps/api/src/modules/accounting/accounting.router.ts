import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { db } from '../../db/index.js'
import { sql } from 'drizzle-orm'
import {
  getPnlReport,
  getBalanceSheet,
  getCashFlow,
  type PnlReport,
  type BalanceReport,
  type CashFlowReport,
} from './accounting.service.js'

export const accountingRouter = Router()

// ─── GET /accounting/reports/pnl ─────────────────────────────────────────

/**
 * Returns profit & loss report for a date range.
 * Query: ?startDate=ISO8601&endDate=ISO8601
 * Requires: Owner, Admin, or Finance role.
 */
const pnlQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

accountingRouter.get(
  '/reports/pnl',
  authenticate,
  requireRole('Owner', 'Admin', 'Finance'),
  async (req, res) => {
    const parsed = pnlQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid query parameters',
      })
    }

    try {
      const startDate = new Date(parsed.data.startDate)
      const endDate = new Date(parsed.data.endDate)

      const data = await getPnlReport(startDate, endDate)
      res.json({ success: true, data, error: null })
    } catch (err) {
      console.error('[accounting] GET /reports/pnl failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── GET /accounting/reports/balance-sheet ──────────────────────────────────

/**
 * Returns balance sheet as of a specific date.
 * Query: ?asOfDate=ISO8601
 * Requires: Owner, Admin, or Finance role.
 */
const balanceQuerySchema = z.object({
  asOfDate: z.string().datetime(),
})

accountingRouter.get(
  '/reports/balance-sheet',
  authenticate,
  requireRole('Owner', 'Admin', 'Finance'),
  async (req, res) => {
    const parsed = balanceQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid query parameters',
      })
    }

    try {
      const asOfDate = new Date(parsed.data.asOfDate)

      const data = await getBalanceSheet(asOfDate)
      res.json({ success: true, data, error: null })
    } catch (err) {
      console.error('[accounting] GET /reports/balance-sheet failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── GET /accounting/reports/cash-flow ──────────────────────────────────────

/**
 * Returns cash flow report for a date range.
 * Query: ?startDate=ISO8601&endDate=ISO8601
 * Requires: Owner, Admin, or Finance role.
 */
const cashFlowQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
})

accountingRouter.get(
  '/reports/cash-flow',
  authenticate,
  requireRole('Owner', 'Admin', 'Finance'),
  async (req, res) => {
    const parsed = cashFlowQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        data: null,
        error: 'Invalid query parameters',
      })
    }

    try {
      const startDate = new Date(parsed.data.startDate)
      const endDate = new Date(parsed.data.endDate)

      const data = await getCashFlow(startDate, endDate)
      res.json({ success: true, data, error: null })
    } catch (err) {
      console.error('[accounting] GET /reports/cash-flow failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── GET /accounting/reports/export-data ────────────────────────────────────
// Returns all raw data needed for Excel export in one call.
// Includes: PnL, Balance Sheet, Cash Flow, POS transactions, Service transactions.

const exportQuerySchema = z.object({
  startDate: z.string().datetime(),
  endDate:   z.string().datetime(),
})

accountingRouter.get(
  '/reports/export-data',
  authenticate,
  requireRole('Owner', 'Admin', 'Finance'),
  async (req, res) => {
    const parsed = exportQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return res.status(400).json({ success: false, data: null, error: 'Invalid query parameters' })
    }

    try {
      const start = new Date(parsed.data.startDate)
      const end   = new Date(parsed.data.endDate)

      // Run each query separately to pinpoint failures
      let pnl: PnlReport
      try { pnl = await getPnlReport(start, end) }
      catch (e) { throw new Error(`PnL query failed: ${(e as Error).message}`) }

      let balance: BalanceReport
      try { balance = await getBalanceSheet(end) }
      catch (e) { throw new Error(`Balance query failed: ${(e as Error).message}`) }

      let cashflow: CashFlowReport
      try { cashflow = await getCashFlow(start, end) }
      catch (e) { throw new Error(`CashFlow query failed: ${(e as Error).message}`) }

      let posRows
      try {
        posRows = await db.execute(sql`
          SELECT
            t.id,
            t.client_uuid      AS "clientUuid",
            t.subtotal,
            t.discount_amount  AS "discountAmount",
            t.total,
            t.status,
            t.created_at       AS "createdAt",
            (SELECT STRING_AGG(tp.method::text || ' Rp' || tp.amount::text, ' + ')
             FROM transaction_payments tp WHERE tp.transaction_id = t.id
            ) AS "paymentMethods",
            (SELECT COUNT(*) FROM transaction_items ti WHERE ti.transaction_id = t.id
            )::int AS "itemCount",
            (SELECT STRING_AGG(
               COALESCE(p.name, 'Unknown') || ' x' || ti.qty::text,
               ', '
             )
             FROM transaction_items ti
             LEFT JOIN product_variants pv ON ti.variant_id = pv.id
             LEFT JOIN products p ON pv.product_id = p.id
             WHERE ti.transaction_id = t.id
            ) AS "itemsSummary"
          FROM transactions t
          WHERE t.status = 'COMPLETED'
            AND t.created_at >= ${start.toISOString()}
            AND t.created_at <= ${end.toISOString()}
          ORDER BY t.created_at DESC
        `)
      } catch (e) { throw new Error(`POS transactions query failed: ${(e as Error).message}`) }

      let serviceRows
      try {
        serviceRows = await db.execute(sql`
          SELECT
            so.order_number    AS "orderNumber",
            so.mechanic_id     AS "mechanic",
            so.complaint,
            so.work_status     AS "workStatus",
            so.payment_status  AS "paymentStatus",
            so.estimated_cost  AS "estimatedCost",
            so.completed_at    AS "completedAt",
            so.created_at      AS "createdAt",
            v.plate_number     AS "platNomor",
            v.brand,
            v.model,
            COALESCE(
              (SELECT SUM(sp.amount) FROM service_payments sp WHERE sp.service_order_id = so.id), 0
            )::int AS "totalBayar",
            (SELECT STRING_AGG(sp.method::text, ', ')
             FROM service_payments sp WHERE sp.service_order_id = so.id
            ) AS "metodeBayar",
            (SELECT STRING_AGG(soi.description || ' x' || soi.qty::text, ', ')
             FROM service_order_items soi WHERE soi.service_order_id = so.id
            ) AS "itemsSummary"
          FROM service_orders so
          LEFT JOIN vehicles v ON so.vehicle_id = v.id
          WHERE so.created_at >= ${start.toISOString()}
            AND so.created_at <= ${end.toISOString()}
          ORDER BY so.created_at DESC
        `)
      } catch (e) { throw new Error(`Service transactions query failed: ${(e as Error).message}`) }

      // Mechanic summary — aggregate per mechanic
      let mechanicRows
      try {
        mechanicRows = await db.execute(sql`
          SELECT
            INITCAP(TRIM(COALESCE(so.mechanic_id, 'Belum Ditugaskan'))) AS "mechanicName",
            COUNT(*)::int AS "totalOrders",
            COUNT(*) FILTER (WHERE so.work_status = 'COMPLETED')::int AS "completedOrders",
            COUNT(*) FILTER (WHERE so.work_status = 'IN_PROGRESS')::int AS "inProgressOrders",
            COALESCE(SUM(
              (SELECT COALESCE(SUM(sp.amount), 0) FROM service_payments sp WHERE sp.service_order_id = so.id)
            ), 0)::int AS "totalRevenue",
            COALESCE(AVG(
              (SELECT COALESCE(SUM(sp.amount), 0) FROM service_payments sp WHERE sp.service_order_id = so.id)
            ), 0)::int AS "avgRevenue"
          FROM service_orders so
          WHERE so.created_at >= ${start.toISOString()}
            AND so.created_at <= ${end.toISOString()}
          GROUP BY INITCAP(TRIM(COALESCE(so.mechanic_id, 'Belum Ditugaskan')))
          ORDER BY "totalRevenue" DESC
        `)
      } catch (e) { throw new Error(`Mechanic summary query failed: ${(e as Error).message}`) }

      res.json({
        success: true,
        data: {
          period: { startDate: start.toISOString(), endDate: end.toISOString() },
          pnl,
          balance,
          cashflow,
          posTransactions:     posRows,
          serviceTransactions: serviceRows,
          mechanicSummary:     mechanicRows,
        },
        error: null,
      })
    } catch (err) {
      console.error('[accounting] GET /reports/export-data failed:', err)
      const detail = err instanceof Error ? err.message : String(err)
      res.status(500).json({
        success: false,
        data: null,
        error: `Export error: ${detail}`,
      })
    }
  }
)
