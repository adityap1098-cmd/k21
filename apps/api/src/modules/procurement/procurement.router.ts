import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import {
  createPurchaseOrder,
  submitForApproval,
  approvePurchaseOrder,
  cancelPurchaseOrder,
  receiveGoods,
  getPurchaseOrder,
  listPurchaseOrders,
} from './procurement.service.js'

export const procurementRouter = Router()

procurementRouter.use(authenticate)

// --- Zod Schemas ---

const createPOSchema = z.object({
  supplierName: z.string().min(1).max(255),
  supplierId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        variantSku: z.string().min(1).max(100),
        variantName: z.string().min(1).max(255),
        qty: z.number().int().positive(),
        unitCost: z.number().nonnegative(),
      })
    )
    .min(1),
})

const receiveGoodsSchema = z.object({
  items: z
    .array(
      z.object({
        itemId: z.string().uuid(),
        qtyReceived: z.number().int().positive(),
      })
    )
    .min(1),
})

// --- Routes ---

// POST /purchase-orders — create new PO (Owner/Admin)
procurementRouter.post(
  '/purchase-orders',
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    try {
      const body = createPOSchema.parse(req.body)
      const result = await createPurchaseOrder({
        ...body,
        createdBy: req.user!.sub,
      })
      res.status(201).json({ success: true, data: result, error: null })
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, data: null, error: err.errors })
        return
      }
      res.status(500).json({ success: false, data: null, error: err.message })
    }
  }
)

// POST /purchase-orders/:id/submit — submit for approval (Owner/Admin)
procurementRouter.post(
  '/purchase-orders/:id/submit',
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    try {
      const result = await submitForApproval(
        req.params.id,
        req.user!.sub,
        req.ip ?? '0.0.0.0'
      )
      res.json({ success: true, data: result, error: null })
    } catch (err: any) {
      if (err.message === 'PO_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: err.message })
        return
      }
      if (err.message === 'INVALID_STATUS_TRANSITION') {
        res.status(409).json({ success: false, data: null, error: err.message })
        return
      }
      res.status(500).json({ success: false, data: null, error: err.message })
    }
  }
)

// POST /purchase-orders/:id/approve — approve PO (Owner/Admin)
procurementRouter.post(
  '/purchase-orders/:id/approve',
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    try {
      const result = await approvePurchaseOrder(req.params.id, {
        approvedBy: req.user!.sub,
        ipAddress: req.ip ?? '0.0.0.0',
      })
      res.json({ success: true, data: result, error: null })
    } catch (err: any) {
      if (err.message === 'PO_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: err.message })
        return
      }
      if (err.message === 'INVALID_STATUS_TRANSITION') {
        res.status(409).json({ success: false, data: null, error: err.message })
        return
      }
      res.status(500).json({ success: false, data: null, error: err.message })
    }
  }
)

// POST /purchase-orders/:id/cancel — cancel PO (Owner/Admin)
procurementRouter.post(
  '/purchase-orders/:id/cancel',
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    try {
      const result = await cancelPurchaseOrder(req.params.id, {
        cancelledBy: req.user!.sub,
        ipAddress: req.ip ?? '0.0.0.0',
      })
      res.json({ success: true, data: result, error: null })
    } catch (err: any) {
      if (err.message === 'PO_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: err.message })
        return
      }
      if (err.message === 'INVALID_STATUS_TRANSITION') {
        res.status(409).json({ success: false, data: null, error: err.message })
        return
      }
      res.status(500).json({ success: false, data: null, error: err.message })
    }
  }
)

// POST /purchase-orders/:id/receive — receive goods (Owner/Admin/Warehouse Staff)
procurementRouter.post(
  '/purchase-orders/:id/receive',
  requireRole('Owner', 'Admin', 'Warehouse Staff'),
  async (req, res) => {
    try {
      const body = receiveGoodsSchema.parse(req.body)
      const result = await receiveGoods({
        purchaseOrderId: req.params.id,
        items: body.items,
        receivedBy: req.user!.sub,
        ipAddress: req.ip ?? '0.0.0.0',
      })
      res.json({ success: true, data: result, error: null })
    } catch (err: any) {
      if (err.name === 'ZodError') {
        res.status(400).json({ success: false, data: null, error: err.errors })
        return
      }
      if (err.message === 'PO_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: err.message })
        return
      }
      if (['INVALID_STATUS_TRANSITION', 'RECEIVE_QTY_EXCEEDS_ORDERED', 'PO_ITEM_NOT_FOUND'].includes(err.message)) {
        res.status(409).json({ success: false, data: null, error: err.message })
        return
      }
      res.status(500).json({ success: false, data: null, error: err.message })
    }
  }
)

// GET /purchase-orders/:id — get PO detail (Owner/Admin/Warehouse Staff/Finance)
procurementRouter.get(
  '/purchase-orders/:id',
  requireRole('Owner', 'Admin', 'Warehouse Staff', 'Finance'),
  async (req, res) => {
    try {
      const result = await getPurchaseOrder(req.params.id)
      res.json({ success: true, data: result, error: null })
    } catch (err: any) {
      if (err.message === 'PO_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: err.message })
        return
      }
      res.status(500).json({ success: false, data: null, error: err.message })
    }
  }
)

// GET /purchase-orders — list POs (Owner/Admin/Warehouse Staff/Finance)
procurementRouter.get(
  '/purchase-orders',
  requireRole('Owner', 'Admin', 'Warehouse Staff', 'Finance'),
  async (req, res) => {
    try {
      const status = req.query.status as string | undefined
      const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined
      const result = await listPurchaseOrders({ status, page, limit })
      res.json({ success: true, data: result, error: null })
    } catch (err: any) {
      res.status(500).json({ success: false, data: null, error: err.message })
    }
  }
)
