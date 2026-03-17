import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { createProduct, getProduct, listProducts, updateProduct, addVariant, updateVariant } from './products.service.js'

export const productsRouter = Router()

const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid(),
  ppnType: z.enum(['TAXABLE', 'NON_TAXABLE']),
  defaultPrice: z.number().positive(),
  defaultCostPrice: z.number().nonnegative(),
})

const updateProductSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid().optional(),
  ppnType: z.enum(['TAXABLE', 'NON_TAXABLE']).optional(),
  isActive: z.boolean().optional(),
})

const addVariantSchema = z.object({
  attributes: z.record(z.string()).default({}),
  price: z.number().positive(),
  costPrice: z.number().nonnegative(),
  sku: z.string().min(1).max(100).optional(),
  barcode: z.string().max(100).optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
})

const updateVariantSchema = z.object({
  price: z.number().positive().optional(),
  costPrice: z.number().nonnegative().optional(),
  sku: z.string().min(1).max(100).optional(),
  barcode: z.string().max(100).optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
})

productsRouter.get('/', authenticate, async (req, res) => {
  try {
    const categoryId = req.query.categoryId as string | undefined
    const isActiveStr = req.query.isActive as string | undefined
    const isActive = isActiveStr === 'true' ? true : isActiveStr === 'false' ? false : undefined

    const data = await listProducts({ categoryId, isActive })
    res.json({ success: true, data, error: null })
  } catch (err) {
    res.status(500).json({ success: false, data: null, error: 'Internal server error' })
  }
})

productsRouter.post('/', authenticate, requireRole('Admin', 'Owner', 'Warehouse Staff'), async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '0.0.0.0'
    const data = await createProduct(parsed.data, req.user!.id, ipAddress)
    res.status(201).json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    res.status(500).json({ success: false, data: null, error: message })
  }
})

productsRouter.get('/:id', authenticate, async (req, res) => {
  try {
    const data = await getProduct(req.params.id)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'PRODUCT_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

productsRouter.patch('/:id', authenticate, requireRole('Admin', 'Owner'), async (req, res) => {
  const parsed = updateProductSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '0.0.0.0'
    const data = await updateProduct({ id: req.params.id, ...parsed.data }, req.user!.id, ipAddress)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'PRODUCT_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

productsRouter.post('/:id/variants', authenticate, requireRole('Admin', 'Owner', 'Warehouse Staff'), async (req, res) => {
  const parsed = addVariantSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '0.0.0.0'
    const data = await addVariant(
      { productId: req.params.id, ...parsed.data },
      req.user!.id,
      ipAddress
    )
    res.status(201).json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'DUPLICATE_SKU') {
      res.status(409).json({ success: false, data: null, error: message })
    } else {
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})

productsRouter.patch('/:id/variants/:variantId', authenticate, requireRole('Admin', 'Owner'), async (req, res) => {
  const parsed = updateVariantSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.message })
    return
  }

  try {
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip ?? '0.0.0.0'
    const data = await updateVariant(
      { variantId: req.params.variantId, ...parsed.data },
      req.user!.id,
      ipAddress
    )
    res.json({ success: true, data, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message === 'VARIANT_NOT_FOUND') {
      res.status(404).json({ success: false, data: null, error: message })
    } else {
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
})
