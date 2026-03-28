import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { resolveError } from '../../middleware/error-handler.js'
import { createProduct, getProduct, listProducts, updateProduct, deleteProduct, addVariant, updateVariant } from './products.service.js'

export const productsRouter = Router()

const createProductSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  categoryId: z.string().uuid(),
  ppnType: z.enum(['TAXABLE', 'NON_TAXABLE']),
  defaultPrice: z.number().positive(),
  defaultCostPrice: z.number().nonnegative(),
  initialStock: z.number().int().nonnegative().optional(),
  lowStockThreshold: z.number().int().nonnegative().optional(),
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
    const includeVariants = req.query.variants === 'true'

    const data = await listProducts({ categoryId, isActive, includeVariants })

    // H-06: Strip cost price from response for roles that shouldn't see it
    const canSeeCost = ['Owner', 'Admin', 'Finance'].includes(req.user!.role)
    const sanitized = canSeeCost ? data : data.map(p => {
      const { variants, ...rest } = p as any
      const cleaned = { ...rest }
      delete cleaned.costPrice
      delete cleaned.defaultCostPrice
      if (variants) {
        cleaned.variants = variants.map((v: any) => {
          const { costPrice, ...vRest } = v
          return vRest
        })
      }
      return cleaned
    })

    res.json({ success: true, data: sanitized, error: null })
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[products] GET / failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})

productsRouter.post('/', authenticate, requireRole('Admin', 'Owner', 'Warehouse Staff'), async (req, res) => {
  const parsed = createProductSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    const data = await createProduct(parsed.data, req.user!.sub, ipAddress)
    res.status(201).json({ success: true, data, error: null })
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[products] POST / failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})

productsRouter.get('/:id', authenticate, async (req, res) => {
  try {
    const data = await getProduct(req.params.id)

    // H-06: Strip cost price for non-privileged roles
    const canSeeCost = ['Owner', 'Admin', 'Finance'].includes(req.user!.role)
    if (!canSeeCost) {
      const cleaned = { ...data } as any
      delete cleaned.costPrice
      delete cleaned.defaultCostPrice
      if (cleaned.variants) {
        cleaned.variants = cleaned.variants.map((v: any) => {
          const { costPrice, ...vRest } = v
          return vRest
        })
      }
      res.json({ success: true, data: cleaned, error: null })
      return
    }

    res.json({ success: true, data, error: null })
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[products] GET /:id failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})

productsRouter.patch('/:id', authenticate, requireRole('Admin', 'Owner'), async (req, res) => {
  const parsed = updateProductSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    const data = await updateProduct({ id: req.params.id, ...parsed.data }, req.user!.sub, ipAddress)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[products] PATCH /:id failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})

productsRouter.delete('/:id', authenticate, requireRole('Admin', 'Owner'), async (req, res) => {
  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    const data = await deleteProduct(req.params.id, req.user!.sub, ipAddress)
    res.json({ success: true, data, error: null })
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[products] DELETE /:id failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})

productsRouter.post('/:id/variants', authenticate, requireRole('Admin', 'Owner', 'Warehouse Staff'), async (req, res) => {
  const parsed = addVariantSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    const data = await addVariant(
      { productId: req.params.id, ...parsed.data },
      req.user!.sub,
      ipAddress
    )
    res.status(201).json({ success: true, data, error: null })
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[products] POST /:id/variants failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})

productsRouter.patch('/:id/variants/:variantId', authenticate, requireRole('Admin', 'Owner'), async (req, res) => {
  const parsed = updateVariantSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ success: false, data: null, error: parsed.error.issues[0]?.message ?? 'Invalid input' })
    return
  }

  try {
    const ipAddress = req.ip ?? '0.0.0.0'
    const data = await updateVariant(
      { variantId: req.params.variantId, ...parsed.data },
      req.user!.sub,
      ipAddress
    )
    res.json({ success: true, data, error: null })
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[products] PATCH /:id/variants/:variantId failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})
