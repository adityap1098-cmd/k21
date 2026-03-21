import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import {
  createServiceOrder,
  getServiceOrderById,
  getOpenServiceOrders,
  updateWorkStatus,
  assignMechanic,
  updateEstimate,
  addLineItem,
  removeLineItem,
  getLineItems,
  completeServiceOrder,
  recordServicePayment,
  getReceivables,
  getServiceHistory,
} from './service-orders.service.js'

export const serviceOrdersRouter = Router()

const createOrderSchema = z.object({
  vehicleId: z.string().uuid(),
  mechanicId: z.string().uuid().optional(),
  complaint: z.string().optional(),
  estimatedCompletionAt: z.string().datetime().optional(),
  estimatedCost: z.number().int().optional(),
  bookingDate: z.string().datetime().optional(),
})

const updateStatusSchema = z.object({
  status: z.enum(['BOOKING', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED']),
})

const assignMechanicSchema = z.object({
  mechanicId: z.string().uuid(),
})

const updateEstimateSchema = z.object({
  estimatedCompletionAt: z.string().datetime().optional(),
  estimatedCost: z.number().int().optional(),
})

const addLineItemSchema = z.object({
  itemType: z.enum(['SERVICE', 'PART']),
  catalogItemId: z.string().uuid().optional(),
  variantId: z.string().uuid().optional(),
  description: z.string().max(255).optional(),
  qty: z.number().int().positive(),
  unitPrice: z.number().int().positive().optional(),
})

const recordPaymentSchema = z.object({
  amount: z.number().int().positive(),
  method: z.enum(['CASH', 'TRANSFER', 'QRIS']),
  reference: z.string().optional(),
})

// GET / — list open orders
serviceOrdersRouter.get('/', authenticate, async (req, res) => {
  try {
    const data = await getOpenServiceOrders()
    res.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[service-orders] GET / failed:', err)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

// GET /receivables — outstanding receivables (MUST be before /:id)
serviceOrdersRouter.get('/receivables', authenticate, async (req, res) => {
  try {
    const customerId = req.query.customerId as string | undefined
    const data = await getReceivables(customerId)
    res.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[service-orders] GET /receivables failed:', err)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

// GET /history/:plateNumber — service history by plate (MUST be before /:id)
serviceOrdersRouter.get('/history/:plateNumber', authenticate, async (req, res) => {
  try {
    const data = await getServiceHistory(req.params.plateNumber)
    res.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[service-orders] GET /history failed:', err)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

// GET /:id — get order by id
serviceOrdersRouter.get('/:id', authenticate, async (req, res) => {
  try {
    const data = await getServiceOrderById(req.params.id)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'SERVICE_ORDER_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      console.error('[service-orders] GET /:id failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

// POST / — create service order
serviceOrdersRouter.post('/', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '0.0.0.0'
    const data = await createServiceOrder(
      { ...parsed.data, createdBy: req.user!.sub },
      req.user!.sub,
      ipAddress,
    )
    res.status(201).json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'VEHICLE_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      console.error('[service-orders] POST / failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

// PATCH /:id/status — update work status
serviceOrdersRouter.patch('/:id/status', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  const parsed = updateStatusSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '0.0.0.0'
    const data = await updateWorkStatus(req.params.id, parsed.data.status, req.user!.sub, ipAddress)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'SERVICE_ORDER_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else if (message === 'INVALID_STATUS_TRANSITION') {
      res.status(422).json({ success: false, data: null, error: message })
    } else {
      console.error('[service-orders] PATCH /:id/status failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

// PATCH /:id/mechanic — assign mechanic
serviceOrdersRouter.patch('/:id/mechanic', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  const parsed = assignMechanicSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '0.0.0.0'
    const data = await assignMechanic(req.params.id, parsed.data.mechanicId, req.user!.sub, ipAddress)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'SERVICE_ORDER_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      console.error('[service-orders] PATCH /:id/mechanic failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

// PATCH /:id/estimate — update estimate
serviceOrdersRouter.patch('/:id/estimate', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  const parsed = updateEstimateSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '0.0.0.0'
    const data = await updateEstimate(req.params.id, parsed.data, req.user!.sub, ipAddress)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'SERVICE_ORDER_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      console.error('[service-orders] PATCH /:id/estimate failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

// POST /:id/complete — complete service order with atomic inventory decrement
serviceOrdersRouter.post('/:id/complete', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '0.0.0.0'
    const data = await completeServiceOrder(req.params.id, req.user!.sub, ipAddress)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'SERVICE_ORDER_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else if (message === 'ORDER_NOT_IN_PROGRESS' || message === 'INSUFFICIENT_STOCK') {
      res.status(422).json({ success: false, data: null, error: message })
    } else {
      console.error('[service-orders] POST /:id/complete failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

// POST /:id/payments — record service payment
serviceOrdersRouter.post('/:id/payments', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  const parsed = recordPaymentSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '0.0.0.0'
    const data = await recordServicePayment(
      req.params.id,
      parsed.data,
      req.user!.sub,
      ipAddress,
    )
    res.status(201).json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'SERVICE_ORDER_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else if (message === 'ORDER_NOT_COMPLETED' || message === 'OVERPAYMENT') {
      res.status(422).json({ success: false, data: null, error: message })
    } else {
      console.error('[service-orders] POST /:id/payments failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

// GET /:id/items — list line items
serviceOrdersRouter.get('/:id/items', authenticate, async (req, res) => {
  try {
    const data = await getLineItems(req.params.id)
    res.json({ success: true, data, error: null })
  } catch (err) {
    console.error('[service-orders] GET /:id/items failed:', err)
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

// POST /:id/items — add line item
serviceOrdersRouter.post('/:id/items', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  const parsed = addLineItemSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '0.0.0.0'
    const data = await addLineItem(
      { serviceOrderId: req.params.id, ...parsed.data },
      req.user!.sub,
      ipAddress,
    )
    res.status(201).json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'SERVICE_ORDER_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else if (message === 'SERVICE_CATALOG_ITEM_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else if (message === 'LINE_ITEM_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      console.error('[service-orders] POST /:id/items failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

// DELETE /:id/items/:itemId — remove line item
serviceOrdersRouter.delete('/:id/items/:itemId', authenticate, requireRole('Admin', 'Owner', 'Cashier'), async (req, res) => {
  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '0.0.0.0'
    const data = await removeLineItem(
      { serviceOrderId: req.params.id, itemId: req.params.itemId },
      req.user!.sub,
      ipAddress,
    )
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'LINE_ITEM_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else if (message === 'SERVICE_ORDER_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      console.error('[service-orders] DELETE /:id/items/:itemId failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})
