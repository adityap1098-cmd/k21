import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { completeSale, syncOfflineTx, voidTransaction } from './pos.service.js'

export const posRouter = Router()

// ─── Shared Zod schemas ────────────────────────────────────────────────────

const saleItemSchema = z.object({
  variantId: z.string().uuid(),
  qty: z.number().int().min(1),
  unitPrice: z.number().int().min(0),
  discountAmount: z.number().int().min(0).default(0),
  lineTotal: z.number().int().min(0),
})

const paymentSchema = z.object({
  method: z.enum(['CASH', 'TRANSFER', 'QRIS']),
  amount: z.number().int().min(1),
  reference: z.string().max(255).optional(),
})

const transactionBodySchema = z.object({
  clientUuid: z.string().uuid(),
  shiftId: z.string().uuid(),
  subtotal: z.number().int().min(0),
  discountAmount: z.number().int().min(0).default(0),
  total: z.number().int().min(0),
  items: z.array(saleItemSchema).min(1),
  payments: z.array(paymentSchema).min(1),
})

const voidBodySchema = z.object({
  reason: z.string().min(1).max(500),
})

// ─── POST /pos/transactions ────────────────────────────────────────────────

/**
 * Creates a new POS sale transaction.
 * Requires: authenticated Cashier.
 * Returns 201 { success: true, data: transaction }
 * On INSUFFICIENT_STOCK → 409
 * On SHIFT_NOT_OPEN → 409
 */
posRouter.post(
  '/transactions',
  authenticate,
  requireRole('Cashier'),
  async (req, res) => {
    const result = transactionBodySchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: result.error.issues[0]?.message ?? 'Invalid input',
      })
      return
    }

    try {
      const transaction = await completeSale({
        ...result.data,
        cashierId: req.user!.sub,
      })
      res.status(201).json({ success: true, data: transaction, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to complete sale'
      if (message === 'INSUFFICIENT_STOCK') {
        res.status(409).json({ success: false, data: null, error: 'Insufficient stock for one or more items' })
      } else if (message === 'SHIFT_NOT_OPEN') {
        res.status(409).json({ success: false, data: null, error: 'No open shift found. Please open a shift first.' })
      } else {
        res.status(500).json({ success: false, data: null, error: message })
      }
    }
  }
)

// ─── POST /pos/transactions/sync ───────────────────────────────────────────

/**
 * Syncs an offline transaction to the server.
 * Requires: authenticated Cashier.
 * Returns 200 { success: true, data: { status: 'synced' | 'conflict', ... } }
 */
posRouter.post(
  '/transactions/sync',
  authenticate,
  requireRole('Cashier'),
  async (req, res) => {
    const result = transactionBodySchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: result.error.issues[0]?.message ?? 'Invalid input',
      })
      return
    }

    try {
      const syncResult = await syncOfflineTx({
        ...result.data,
        cashierId: req.user!.sub,
      })
      res.status(200).json({ success: true, data: syncResult, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync transaction'
      res.status(500).json({ success: false, data: null, error: message })
    }
  }
)

// ─── POST /pos/transactions/:id/void ──────────────────────────────────────

/**
 * Voids a completed transaction.
 * Requires: authenticated Cashier, Owner, or Admin.
 * Returns 200 { success: true, data: transaction }
 * On TRANSACTION_NOT_FOUND → 404
 * On ALREADY_VOIDED → 409
 */
posRouter.post(
  '/transactions/:id/void',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
  async (req, res) => {
    const result = voidBodySchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false,
        data: null,
        error: result.error.issues[0]?.message ?? 'Invalid input',
      })
      return
    }

    try {
      const transaction = await voidTransaction({
        transactionId: req.params.id,
        voidReason: result.data.reason,
        performedBy: req.user!.sub,
        ipAddress: req.ip,
      })
      res.status(200).json({ success: true, data: transaction, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to void transaction'
      if (message === 'TRANSACTION_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: 'Transaction not found' })
      } else if (message === 'ALREADY_VOIDED') {
        res.status(409).json({ success: false, data: null, error: 'Transaction is already voided' })
      } else {
        res.status(500).json({ success: false, data: null, error: message })
      }
    }
  }
)
