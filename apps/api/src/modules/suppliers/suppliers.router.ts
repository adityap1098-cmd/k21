import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { listSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier } from './suppliers.service.js'

export const suppliersRouter = Router()

// GET /suppliers — list all suppliers
suppliersRouter.get(
  '/',
  authenticate,
  requireRole('Owner', 'Admin', 'Warehouse Staff', 'Finance'),
  async (req, res) => {
    try {
      const search = typeof req.query.search === 'string' ? req.query.search : undefined
      const active = req.query.active === 'true' ? true : req.query.active === 'false' ? false : undefined
      const items = await listSuppliers({ search, active })
      res.json({ success: true, data: items, error: null })
    } catch (err) {
      console.error('[suppliers] GET / failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// GET /suppliers/:id
suppliersRouter.get(
  '/:id',
  authenticate,
  requireRole('Owner', 'Admin', 'Warehouse Staff', 'Finance'),
  async (req, res) => {
    try {
      const supplier = await getSupplier(req.params.id)
      if (!supplier) {
        res.status(404).json({ success: false, data: null, error: 'Supplier tidak ditemukan' })
        return
      }
      res.json({ success: true, data: supplier, error: null })
    } catch (err) {
      console.error('[suppliers] GET /:id failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// POST /suppliers — create
const createSchema = z.object({
  name: z.string().min(1, 'Nama supplier harus diisi').max(255),
  contact: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
})

suppliersRouter.post(
  '/',
  authenticate,
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    const result = createSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false, data: null,
        error: result.error.issues[0]?.message ?? 'Invalid input',
      })
      return
    }

    try {
      const supplier = await createSupplier(result.data)
      res.status(201).json({ success: true, data: supplier, error: null })
    } catch (err) {
      console.error('[suppliers] POST / failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// PATCH /suppliers/:id — update
const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  contact: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  notes: z.string().optional(),
  active: z.boolean().optional(),
})

suppliersRouter.patch(
  '/:id',
  authenticate,
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    const result = updateSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false, data: null,
        error: result.error.issues[0]?.message ?? 'Invalid input',
      })
      return
    }

    try {
      const supplier = await updateSupplier(req.params.id, result.data)
      res.json({ success: true, data: supplier, error: null })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      if (msg === 'SUPPLIER_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: 'Supplier tidak ditemukan' })
      } else {
        console.error('[suppliers] PATCH /:id failed:', err)
        res.status(500).json({ success: false, data: null, error: 'Internal server error' })
      }
    }
  }
)

// DELETE /suppliers/:id — soft delete
suppliersRouter.delete(
  '/:id',
  authenticate,
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    try {
      await deleteSupplier(req.params.id)
      res.json({ success: true, data: null, error: null })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed'
      if (msg === 'SUPPLIER_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: 'Supplier tidak ditemukan' })
      } else {
        console.error('[suppliers] DELETE /:id failed:', err)
        res.status(500).json({ success: false, data: null, error: 'Internal server error' })
      }
    }
  }
)
