import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { listWarehouses, getWarehouseStock, transferStock } from './warehouse.service.js'

export const warehouseRouter = Router()

// ─── Zod schemas ──────────────────────────────────────────────────────────

const transferBodySchema = z.object({
  variantId: z.string().uuid(),
  fromWarehouse: z.string().min(1),
  toWarehouse: z.string().min(1),
  qty: z.number().int().positive(),
  reference: z.string().optional(),
})

// ─── GET /warehouses ──────────────────────────────────────────────────────

/**
 * Get list of all warehouses with basic info.
 * Requires: authenticated user with Owner, Admin, or Warehouse Staff role.
 * Returns: { success: true, data: Warehouse[] }
 */
warehouseRouter.get(
  '/warehouses',
  authenticate,
  requireRole('Owner', 'Admin', 'Warehouse Staff'),
  async (req, res) => {
    try {
      const warehouses = await listWarehouses()
      res.status(200).json({ success: true, data: warehouses, error: null })
    } catch (err) {
      console.error('[warehouse] GET /warehouses failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// ─── GET /warehouses/:id/stock ────────────────────────────────────────────

/**
 * Get stock details per variant in a specific warehouse.
 * Requires: authenticated user with Owner, Admin, or Warehouse Staff role.
 * Returns: { success: true, data: WarehouseStock[] }
 */
warehouseRouter.get(
  '/warehouses/:id/stock',
  authenticate,
  requireRole('Owner', 'Admin', 'Warehouse Staff'),
  async (req, res) => {
    const { id } = req.params
    try {
      const stock = await getWarehouseStock(id)
      res.status(200).json({ success: true, data: stock, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to get warehouse stock'
      if (message === 'WAREHOUSE_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: 'Warehouse not found' })
      } else {
        console.error('[warehouse] GET /warehouses/:id/stock failed:', err)
        res.status(500).json({ success: false, data: null, error: 'Internal server error' })
      }
    }
  }
)

// ─── POST /transfers ──────────────────────────────────────────────────────

/**
 * Create a stock transfer between two warehouses.
 * Requires: authenticated user with Owner, Admin, or Warehouse Staff role.
 * Body: { variantId: string, fromWarehouse: string, toWarehouse: string, qty: number, reference?: string }
 * Returns: { success: true, data: null }
 * On WAREHOUSE_NOT_FOUND → 404; on VARIANT_NOT_FOUND → 404; on INSUFFICIENT_STOCK → 409
 */
warehouseRouter.post(
  '/transfers',
  authenticate,
  requireRole('Owner', 'Admin', 'Warehouse Staff'),
  async (req, res) => {
    const result = transferBodySchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: result.error.issues[0]?.message ?? 'Invalid input',
      })
      return
    }

    try {
      const { variantId, fromWarehouse, toWarehouse, qty, reference } = result.data
      await transferStock({
        variantId,
        fromWarehouse,
        toWarehouse,
        qty,
        reference,
        performedBy: req.user!.sub,
      })
      res.status(201).json({ success: true, data: null, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to transfer stock'
      if (message === 'FROM_WAREHOUSE_NOT_FOUND' || message === 'TO_WAREHOUSE_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: 'Warehouse not found' })
      } else if (message === 'VARIANT_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: 'Variant not found' })
      } else if (message === 'INSUFFICIENT_STOCK') {
        res.status(409).json({ success: false, data: null, error: 'Insufficient stock for transfer' })
      } else if (message === 'QTY_MUST_BE_POSITIVE') {
        res.status(400).json({ success: false, data: null, error: 'Quantity must be positive' })
      } else {
        console.error('[warehouse] POST /transfers failed:', err)
        res.status(500).json({ success: false, data: null, error: 'Internal server error' })
      }
    }
  }
)
