import { randomUUID } from 'crypto'
import { eq, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { products, productVariants } from '../../db/schema/index.js'
import { logAudit } from '../../middleware/audit.js'
import type { Product, ProductVariant, VariantAttributes } from '../../db/schema/index.js'

const VALID_PPN_TYPES = ['TAXABLE', 'NON_TAXABLE'] as const
type PpnType = (typeof VALID_PPN_TYPES)[number]

// UUID v4 pattern for basic validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function generateSku(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${slug}-${randomUUID().slice(0, 8).toUpperCase()}`
}

export type ProductWithVariants = Product & { variants: ProductVariant[] }

export async function createProduct(
  params: {
    name: string
    description?: string
    categoryId: string
    ppnType: PpnType
    defaultPrice: number
    defaultCostPrice: number
    initialStock?: number
    lowStockThreshold?: number
  },
  userId: string,
  ipAddress: string
): Promise<ProductWithVariants> {
  const { name, description, categoryId, ppnType, defaultPrice, defaultCostPrice, initialStock, lowStockThreshold } = params

  // Validate ppnType at service layer
  if (!VALID_PPN_TYPES.includes(ppnType)) {
    throw new Error('INVALID_PPN_TYPE')
  }

  // Validate categoryId is UUID format
  if (!UUID_REGEX.test(categoryId)) {
    throw new Error('INVALID_CATEGORY_ID')
  }

  const productId = randomUUID()
  const sku = generateSku(name)

  const [product, variant] = await db.transaction(async (tx) => {
    const [newProduct] = await tx
      .insert(products)
      .values({
        id: productId,
        name,
        description: description ?? null,
        categoryId,
        ppnType,
        isActive: true,
        createdBy: userId,
      })
      .returning()

    const [defaultVariant] = await tx
      .insert(productVariants)
      .values({
        id: randomUUID(),
        productId,
        sku,
        barcode: null,
        attributes: {} as VariantAttributes,
        price: String(defaultPrice),
        costPrice: String(defaultCostPrice),
        stockQty: initialStock ?? 0,
        lowStockThreshold: lowStockThreshold ?? null,
      })
      .returning()

    return [newProduct, defaultVariant] as const
  })

  await logAudit({
    userId,
    action: 'CREATE',
    tableName: 'products',
    recordId: product.id,
    oldValue: null,
    newValue: { name: product.name, categoryId: product.categoryId, ppnType: product.ppnType },
    ipAddress,
  })

  return { ...product, variants: [variant] }
}

export async function getProduct(id: string): Promise<ProductWithVariants> {
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1)

  if (!product) {
    throw new Error('PRODUCT_NOT_FOUND')
  }

  const variants = await db
    .select()
    .from(productVariants)
    .where(eq(productVariants.productId, id))

  return { ...product, variants }
}

export async function listProducts(filters?: {
  categoryId?: string
  isActive?: boolean
  includeVariants?: boolean
}): Promise<Array<Product & { variantCount: number; variants?: ProductVariant[] }>> {
  // Build query with optional filters
  const allProducts = await db
    .select()
    .from(products)

  // Apply in-memory filters since we're using a simple mock-friendly pattern
  let filtered = allProducts
  if (filters?.categoryId != null) {
    filtered = filtered.filter((p) => p.categoryId === filters.categoryId)
  }
  if (filters?.isActive != null) {
    filtered = filtered.filter((p) => p.isActive === filters.isActive)
  }

  if (filters?.includeVariants) {
    // Fetch all variants for matched products
    const productIds = filtered.map(p => p.id)
    if (productIds.length === 0) return []

    const allVariants = await db
      .select()
      .from(productVariants)

    const variantsByProduct = new Map<string, ProductVariant[]>()
    for (const v of allVariants) {
      if (!productIds.includes(v.productId)) continue
      const list = variantsByProduct.get(v.productId) || []
      list.push(v)
      variantsByProduct.set(v.productId, list)
    }

    return filtered.map((p) => {
      const variants = variantsByProduct.get(p.id) || []
      return { ...p, variantCount: variants.length, variants }
    })
  }

  // Return with variant count placeholder (no variants loaded)
  return filtered.map((p) => ({ ...p, variantCount: 0 }))
}

export async function updateProduct(
  params: {
    id: string
    name?: string
    description?: string
    categoryId?: string
    ppnType?: PpnType
    isActive?: boolean
  },
  userId: string,
  ipAddress: string
): Promise<Product> {
  const { id, ...updates } = params

  const [old] = await db
    .select()
    .from(products)
    .where(eq(products.id, id))
    .limit(1)

  if (!old) {
    throw new Error('PRODUCT_NOT_FOUND')
  }

  const [updated] = await db
    .update(products)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(products.id, id))
    .returning()

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'products',
    recordId: id,
    oldValue: { name: old.name, ppnType: old.ppnType, isActive: old.isActive },
    newValue: { name: updated.name, ppnType: updated.ppnType, isActive: updated.isActive },
    ipAddress,
  })

  return updated
}

export async function addVariant(
  params: {
    productId: string
    attributes: VariantAttributes
    price: number
    costPrice: number
    sku?: string
    barcode?: string
    lowStockThreshold?: number
  },
  userId: string,
  ipAddress: string
): Promise<ProductVariant> {
  const { productId, attributes, price, costPrice, barcode, lowStockThreshold } = params
  const sku = params.sku ?? generateSku(productId)

  // Check for duplicate SKU
  const existing = await db
    .select({ id: productVariants.id })
    .from(productVariants)
    .where(eq(productVariants.sku, sku))

  if (existing.length > 0) {
    throw new Error('DUPLICATE_SKU')
  }

  const [variant] = await db
    .insert(productVariants)
    .values({
      id: randomUUID(),
      productId,
      sku,
      barcode: barcode ?? null,
      attributes: attributes as VariantAttributes,
      price: String(price),
      costPrice: String(costPrice),
      stockQty: 0,
      lowStockThreshold: lowStockThreshold ?? null,
    })
    .returning()

  await logAudit({
    userId,
    action: 'CREATE',
    tableName: 'product_variants',
    recordId: variant.id,
    oldValue: null,
    newValue: { productId, sku: variant.sku, attributes },
    ipAddress,
  })

  return variant
}

export async function updateVariant(
  params: {
    variantId: string
    price?: number
    costPrice?: number
    sku?: string
    barcode?: string
    lowStockThreshold?: number
  },
  userId: string,
  ipAddress: string
): Promise<ProductVariant> {
  const { variantId, price, costPrice, sku, barcode, lowStockThreshold } = params

  const updates: Record<string, unknown> = { updatedAt: new Date() }
  if (price !== undefined) updates.price = String(price)
  if (costPrice !== undefined) updates.costPrice = String(costPrice)
  if (sku !== undefined) updates.sku = sku
  if (barcode !== undefined) updates.barcode = barcode
  if (lowStockThreshold !== undefined) updates.lowStockThreshold = lowStockThreshold

  const [updated] = await db
    .update(productVariants)
    .set(updates)
    .where(eq(productVariants.id, variantId))
    .returning()

  if (!updated) {
    throw new Error('VARIANT_NOT_FOUND')
  }

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'product_variants',
    recordId: variantId,
    oldValue: null,
    newValue: updates,
    ipAddress,
  })

  return updated
}
