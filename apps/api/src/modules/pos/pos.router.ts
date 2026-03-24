import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { resolveError } from '../../middleware/error-handler.js'
import { completeSale, syncOfflineTx, voidTransaction, getTransactionItemVariantIds, listTransactions, getTransactionDetail, updateTransactionNote, listUnifiedOrderHistory, returnItems, getTransactionReturns } from './pos.service.js'
import { invalidateStockCache } from '../inventory/stock.service.js'

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

const syncBodySchema = transactionBodySchema.extend({
  forceComplete: z.boolean().optional(),
})

const voidBodySchema = z.object({
  reason: z.string().min(1).max(500),
})

// ─── POST /pos/transactions ────────────────────────────────────────────────

posRouter.post(
  '/transactions',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
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

      // Invalidate stock cache AFTER transaction commits so reads get fresh data
      const variantIds = [...new Set(result.data.items.map(i => i.variantId))]
      await Promise.all(variantIds.map(id => invalidateStockCache(id)))

      res.status(201).json({ success: true, data: transaction, error: null })
    } catch (err) {
      const { status, message } = resolveError(err)
      if (status >= 500) console.error('[pos] POST /transactions failed:', err)
      res.status(status).json({ success: false, data: null, error: message })
    }
  }
)

// ─── POST /pos/transactions/sync ───────────────────────────────────────────

posRouter.post(
  '/transactions/sync',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
  async (req, res) => {
    const result = syncBodySchema.safeParse(req.body)
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

      // Invalidate stock cache after successful sync (synced or force-complete)
      if (syncResult.status === 'synced') {
        const variantIds = [...new Set(result.data.items.map(i => i.variantId))]
        await Promise.all(variantIds.map(id => invalidateStockCache(id)))
      }

      res.status(200).json({ success: true, data: syncResult, error: null })
    } catch (err) {
      const { status, message } = resolveError(err)
      if (status >= 500) console.error('[pos] POST /transactions/sync failed:', err)
      res.status(status).json({ success: false, data: null, error: message })
    }
  }
)

// ─── POST /pos/transactions/:id/void ──────────────────────────────────────

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
      // Get affected variantIds before void for cache invalidation
      const affectedVariantIds = await getTransactionItemVariantIds(req.params.id)

      const transaction = await voidTransaction({
        transactionId: req.params.id,
        voidReason: result.data.reason,
        performedBy: req.user!.sub,
        ipAddress: req.ip,
      })

      // Invalidate stock cache AFTER void commits — stock was restored
      await Promise.all(affectedVariantIds.map(id => invalidateStockCache(id)))

      res.status(200).json({ success: true, data: transaction, error: null })
    } catch (err) {
      const { status, message } = resolveError(err)
      if (status >= 500) console.error('[pos] POST /transactions/:id/void failed:', err)
      res.status(status).json({ success: false, data: null, error: message })
    }
  }
)

// ─── GET /pos/order-history ─────────────────────────────────────────────────
// Unified order history: retail transactions + service orders

posRouter.get(
  '/order-history',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
  async (req, res) => {
    try {
      const shiftId = req.query.shiftId as string | undefined
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)
      const offset = parseInt(req.query.offset as string) || 0

      const result = await listUnifiedOrderHistory({ shiftId, limit, offset })
      res.status(200).json({ success: true, data: result, error: null })
    } catch (err) {
      const { status, message } = resolveError(err)
      if (status >= 500) console.error('[pos] GET /order-history failed:', err)
      res.status(status).json({ success: false, data: null, error: message })
    }
  }
)

// ─── GET /pos/transactions ─────────────────────────────────────────────────
// List transactions for today's shift (or by query params)

posRouter.get(
  '/transactions',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
  async (req, res) => {
    try {
      const shiftId = req.query.shiftId as string | undefined
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200)
      const offset = parseInt(req.query.offset as string) || 0

      const result = await listTransactions({ shiftId, limit, offset })
      res.status(200).json({ success: true, data: result, error: null })
    } catch (err) {
      const { status, message } = resolveError(err)
      if (status >= 500) console.error('[pos] GET /transactions failed:', err)
      res.status(status).json({ success: false, data: null, error: message })
    }
  }
)

// ─── GET /pos/transactions/:id ─────────────────────────────────────────────
// Get single transaction with items + payments

posRouter.get(
  '/transactions/:id',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
  async (req, res) => {
    try {
      const detail = await getTransactionDetail(req.params.id)
      if (!detail) {
        res.status(404).json({ success: false, data: null, error: 'Transaction not found' })
        return
      }
      res.status(200).json({ success: true, data: detail, error: null })
    } catch (err) {
      const { status, message } = resolveError(err)
      if (status >= 500) console.error('[pos] GET /transactions/:id failed:', err)
      res.status(status).json({ success: false, data: null, error: message })
    }
  }
)

// ─── PATCH /pos/transactions/:id/note ──────────────────────────────────────
// Update transaction note/keterangan

posRouter.patch(
  '/transactions/:id/note',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
  async (req, res) => {
    const schema = z.object({ note: z.string().max(500) })
    const result = schema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({ success: false, data: null, error: 'Invalid input' })
      return
    }
    try {
      const updated = await updateTransactionNote(req.params.id, result.data.note)
      res.status(200).json({ success: true, data: updated, error: null })
    } catch (err) {
      const { status, message } = resolveError(err)
      if (status >= 500) console.error('[pos] PATCH /transactions/:id/note failed:', err)
      res.status(status).json({ success: false, data: null, error: message })
    }
  }
)

// ─── POST /pos/transactions/:id/return ──────────────────────────────────
// Partial return — return specific items (stock restored, refund recorded)

const returnItemSchema = z.object({
  variantId: z.string().uuid(),
  qty: z.number().int().min(1),
  refundAmount: z.number().int().nonnegative(),
})

const returnBodySchema = z.object({
  items: z.array(returnItemSchema).min(1, 'Minimal 1 item retur'),
  reason: z.string().min(1, 'Alasan harus diisi').max(500),
})

posRouter.post(
  '/transactions/:id/return',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin'),
  async (req, res) => {
    const result = returnBodySchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).json({
        success: false, data: null,
        error: result.error.issues[0]?.message ?? 'Invalid input',
      })
      return
    }

    try {
      const returns = await returnItems({
        transactionId: req.params.id,
        items: result.data.items,
        reason: result.data.reason,
        performedBy: req.user!.sub,
        ipAddress: req.ip ?? '0.0.0.0',
      })

      // Invalidate stock cache for returned variants
      for (const item of result.data.items) {
        await invalidateStockCache(item.variantId)
      }

      res.status(201).json({ success: true, data: returns, error: null })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed'
      if (message === 'TRANSACTION_NOT_FOUND') {
        res.status(404).json({ success: false, data: null, error: 'Transaksi tidak ditemukan' })
      } else if (message === 'TRANSACTION_VOIDED') {
        res.status(409).json({ success: false, data: null, error: 'Transaksi sudah di-void, tidak bisa retur' })
      } else if (message.startsWith('ITEM_NOT_FOUND:')) {
        res.status(400).json({ success: false, data: null, error: 'Item tidak ditemukan dalam transaksi ini' })
      } else if (message.startsWith('EXCEED_QTY:')) {
        const max = message.split('max=')[1]
        res.status(400).json({ success: false, data: null, error: `Jumlah retur melebihi sisa (maks: ${max})` })
      } else {
        console.error('[pos] POST /transactions/:id/return failed:', err)
        res.status(500).json({ success: false, data: null, error: 'Internal server error' })
      }
    }
  }
)

// ─── GET /pos/transactions/:id/returns ──────────────────────────────────
// List returns for a transaction

posRouter.get(
  '/transactions/:id/returns',
  authenticate,
  requireRole('Cashier', 'Owner', 'Admin', 'Finance'),
  async (req, res) => {
    try {
      const returns = await getTransactionReturns(req.params.id)
      res.json({ success: true, data: returns, error: null })
    } catch (err) {
      console.error('[pos] GET /transactions/:id/returns failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)
