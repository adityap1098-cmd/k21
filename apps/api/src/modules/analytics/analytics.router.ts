import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import {
  getDashboardKpi,
  getRecentTransactions,
  getTopProducts,
  getRevenueChart,
} from './analytics.service.js'

export const analyticsRouter = Router()

// ─── GET /analytics/dashboard ───────────────────────────────────────────────

/**
 * Returns KPI metrics for the dashboard page.
 * Requires: Owner, Admin, or Finance role.
 * Returns 200 { success: true, data: DashboardKpi }
 */
analyticsRouter.get(
  '/dashboard',
  authenticate,
  requireRole('Owner', 'Admin', 'Finance', 'Cashier'),
  async (_req, res) => {
    try {
      const data = await getDashboardKpi()
      res.json({ success: true, data, error: null })
    } catch (err) {
      console.error('[analytics] GET /dashboard failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── GET /analytics/recent-transactions ─────────────────────────────────────

/**
 * Returns the most recent completed transactions.
 * Query: ?limit=10
 * Requires: Owner, Admin, or Finance role.
 */
const recentQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
})

analyticsRouter.get(
  '/recent-transactions',
  authenticate,
  requireRole('Owner', 'Admin', 'Finance', 'Cashier'),
  async (req, res) => {
    const parsed = recentQuerySchema.safeParse(req.query)
    const limit = parsed.success ? parsed.data.limit : 10

    try {
      const data = await getRecentTransactions(limit)
      res.json({ success: true, data, error: null })
    } catch (err) {
      console.error('[analytics] GET /recent-transactions failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── GET /analytics/top-products ────────────────────────────────────────────

/**
 * Returns top-selling products by quantity.
 * Query: ?days=30&limit=10
 * Requires: Owner, Admin, or Finance role.
 */
const topProductsQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
})

analyticsRouter.get(
  '/top-products',
  authenticate,
  requireRole('Owner', 'Admin', 'Finance', 'Cashier'),
  async (req, res) => {
    const parsed = topProductsQuerySchema.safeParse(req.query)
    const days = parsed.success ? parsed.data.days : 30
    const limit = parsed.success ? parsed.data.limit : 10

    try {
      const data = await getTopProducts(days, limit)
      res.json({ success: true, data, error: null })
    } catch (err) {
      console.error('[analytics] GET /top-products failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── GET /analytics/revenue-chart ───────────────────────────────────────────

/**
 * Returns daily revenue data for chart visualization.
 * Query: ?days=7
 * Requires: Owner, Admin, or Finance role.
 */
const chartQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(7),
})

analyticsRouter.get(
  '/revenue-chart',
  authenticate,
  requireRole('Owner', 'Admin', 'Finance', 'Cashier'),
  async (req, res) => {
    const parsed = chartQuerySchema.safeParse(req.query)
    const days = parsed.success ? parsed.data.days : 7

    try {
      const data = await getRevenueChart(days)
      res.json({ success: true, data, error: null })
    } catch (err) {
      console.error('[analytics] GET /revenue-chart failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)
