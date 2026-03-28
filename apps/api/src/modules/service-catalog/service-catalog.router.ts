import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { createServiceItem, getServiceItemById, getServiceCatalog, updateServiceItem } from './service-catalog.service.js'

export const serviceCatalogRouter = Router()

const createServiceItemSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  defaultPrice: z.number().int().positive(),
})

const updateServiceItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  defaultPrice: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
})

// GET / — list catalog
serviceCatalogRouter.get('/', authenticate, async (req, res) => {
  try {
    const data = await getServiceCatalog()
    res.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[service-catalog] GET / failed:', err)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

// GET /:id — get by id
serviceCatalogRouter.get('/:id', authenticate, async (req, res) => {
  try {
    const data = await getServiceItemById(req.params.id)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'SERVICE_CATALOG_ITEM_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      console.error('[service-catalog] GET /:id failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

// POST / — create
serviceCatalogRouter.post('/', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  const parsed = createServiceItemSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    const data = await createServiceItem(parsed.data, req.user!.sub, ipAddress)
    res.status(201).json({ success: true, data, error: null })
  } catch (err) {
    console.error('[service-catalog] POST / failed:', err)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

// PATCH /:id — update
serviceCatalogRouter.patch('/:id', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  const parsed = updateServiceItemSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    const data = await updateServiceItem({ id: req.params.id, ...parsed.data }, req.user!.sub, ipAddress)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'SERVICE_CATALOG_ITEM_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      console.error('[service-catalog] PATCH /:id failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})
