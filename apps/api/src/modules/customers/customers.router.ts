import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { createCustomer, getCustomerById, getCustomers, updateCustomer, searchCustomers } from './customers.service.js'

export const customersRouter = Router()

const createCustomerSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().min(1).max(30),
})

const updateCustomerSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  phone: z.string().min(1).max(30).optional(),
  isActive: z.boolean().optional(),
})

// GET / — list customers
customersRouter.get('/', authenticate, async (req, res) => {
  try {
    const isActiveStr = req.query.isActive as string | undefined
    const isActive = isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : undefined

    const data = await getCustomers({ isActive })
    res.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[customers] GET / failed:', err)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

// GET /search — search customers (MUST be before /:id)
customersRouter.get('/search', authenticate, async (req, res) => {
  try {
    const q = (req.query.q as string) ?? ''
    const data = await searchCustomers(q)
    res.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[customers] GET /search failed:', err)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

// GET /:id — get customer by id
customersRouter.get('/:id', authenticate, async (req, res) => {
  try {
    const data = await getCustomerById(req.params.id)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'CUSTOMER_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      console.error('[customers] GET /:id failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

// POST / — create customer
customersRouter.post('/', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  const parsed = createCustomerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    const data = await createCustomer(parsed.data, req.user!.sub, ipAddress)
    res.status(201).json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'DUPLICATE_PHONE') {
      res.status(409).json({ success: false, data: null, error: message })
    } else {
      console.error('[customers] POST / failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

// PATCH /:id — update customer
customersRouter.patch('/:id', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  const parsed = updateCustomerSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    const data = await updateCustomer({ id: req.params.id, ...parsed.data }, req.user!.sub, ipAddress)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'CUSTOMER_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else if (message === 'DUPLICATE_PHONE') {
      res.status(409).json({ success: false, data: null, error: message })
    } else {
      console.error('[customers] PATCH /:id failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})
