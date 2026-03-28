import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { createCategory, getCategories, updateCategory, deleteCategory } from './categories.service.js'

export const categoriesRouter = Router()

const createSchema = z.object({
  name: z.string().min(1).max(255),
  parentId: z.string().uuid().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).max(255),
})

categoriesRouter.get('/', authenticate, async (req, res) => {
  try {
    const data = await getCategories()
    res.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[categories] GET / failed:', err)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

categoriesRouter.post('/', authenticate, requireRole('Admin', 'Owner'), async (req, res) => {
  const parsed = createSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    const data = await createCategory(parsed.data, req.user!.sub, ipAddress)
    res.status(201).json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'GRANDCHILD_NOT_ALLOWED') {
      res.status(400).json({ success: false, data: null, error: message })
    } else {
      console.error('[categories] POST / failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

categoriesRouter.patch('/:id', authenticate, requireRole('Admin', 'Owner'), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    const data = await updateCategory({ id: req.params.id, ...parsed.data }, req.user!.sub, ipAddress)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'CATEGORY_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      console.error('[categories] PATCH /:id failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

categoriesRouter.delete('/:id', authenticate, requireRole('Admin', 'Owner'), async (req, res) => {
  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    await deleteCategory(req.params.id, req.user!.sub, ipAddress)
    res.json({ success: true, data: null, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'CATEGORY_HAS_PRODUCTS') {
      res.status(409).json({ success: false, data: null, error: message })
    } else {
      console.error('[categories] DELETE /:id failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})
