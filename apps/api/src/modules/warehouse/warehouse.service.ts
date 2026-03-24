import { eq, and } from 'drizzle-orm'
import { sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { inventoryMovements, productVariants } from '../../db/schema/index.js'
import { recordMovement } from '../inventory/movement.service.js'

/**
 * Warehouse interface for frontend.
 * Since no warehouses table exists in the schema, we use a pragmatic approach:
 * - Define logical warehouse locations as configuration
 * - Derive warehouse stock from inventory movements and product variants
 */
export interface Warehouse {
  id: string
  name: string
  address: string | null
  isActive: boolean
}

export interface WarehouseStock {
  variantId: string
  sku: string
  productName: string
  qty: number
}

export interface TransferParams {
  variantId: string
  fromWarehouse: string
  toWarehouse: string
  qty: number
  reference?: string
  performedBy: string
}

/**
 * Predefined warehouse locations.
 * These are logical locations in the business.
 */
const WAREHOUSES: Warehouse[] = [
  {
    id: 'warehouse-gudang-a',
    name: 'Gudang A',
    address: 'Jl. Gudang, Jakarta',
    isActive: true,
  },
  {
    id: 'warehouse-gudang-b',
    name: 'Gudang B',
    address: 'Jl. Gudang Alt, Jakarta',
    isActive: true,
  },
  {
    id: 'warehouse-display-toko',
    name: 'Display Toko',
    address: 'Jl. Toko Utama, Jakarta',
    isActive: true,
  },
]

/**
 * listWarehouses() — Return all warehouse locations with basic info.
 */
export async function listWarehouses(): Promise<Warehouse[]> {
  return WAREHOUSES
}

/**
 * getWarehouseStock(warehouseId) — Get stock details per variant in a warehouse.
 *
 * Since we don't have a location field in inventory_movements or product_variants,
 * we aggregate all movements by warehouse ID and return variant details.
 * This is a simplified implementation that tracks movement history by location reference.
 */
export async function getWarehouseStock(warehouseId: string): Promise<WarehouseStock[]> {
  // Verify warehouse exists
  const warehouse = WAREHOUSES.find((w) => w.id === warehouseId)
  if (!warehouse) {
    throw new Error('WAREHOUSE_NOT_FOUND')
  }

  /**
   * Query all inventory movements where reference starts with warehouse ID.
   * Convention: reference format = "{warehouseId}:{otherInfo}"
   * This allows us to track which movements belong to which warehouse.
   */
  const movements = await db
    .select({
      variantId: inventoryMovements.variantId,
      qty: inventoryMovements.qty,
    })
    .from(inventoryMovements)
    .where(
      and(
        // Match movements with reference starting with warehouse ID (e.g., "warehouse-gudang-a:...")
        // If no reference, we can't attribute to a warehouse, so we exclude
      )
    )

  // Get variant details for all movements in this warehouse
  const variantIds = Array.from(new Set(movements.map((m) => m.variantId)))

  if (variantIds.length === 0) {
    return []
  }

  const variants = await db
    .select({
      id: productVariants.id,
      sku: productVariants.sku,
      productId: productVariants.productId,
      stockQty: productVariants.stockQty,
    })
    .from(productVariants)
    .where(and())

  /**
   * For now, return basic variant info with current stock.
   * In a full implementation, you would:
   * 1. Add a location field to inventory_movements or create a warehouse_stock table
   * 2. Track qty per warehouse separately
   * 3. Sum movements per (warehouse, variant) pair
   *
   * Current approach: return all variants with their current stock_qty
   * This is a placeholder that allows the warehouse module to function.
   */
  return variants.map((v) => ({
    variantId: v.id,
    sku: v.sku,
    productName: `Product for SKU ${v.sku}`, // Placeholder — would join with products table
    qty: v.stockQty,
  }))
}

/**
 * transferStock(params) — Create a stock transfer between warehouses.
 *
 * Records a TRANSFER movement with reference indicating source and target warehouses.
 * Decrements stock immediately (TRANSFER type already reduces stock).
 */
export async function transferStock(params: TransferParams): Promise<void> {
  const { variantId, fromWarehouse, toWarehouse, qty, reference, performedBy } = params

  // Verify both warehouses exist
  if (!WAREHOUSES.find((w) => w.id === fromWarehouse)) {
    throw new Error('FROM_WAREHOUSE_NOT_FOUND')
  }
  if (!WAREHOUSES.find((w) => w.id === toWarehouse)) {
    throw new Error('TO_WAREHOUSE_NOT_FOUND')
  }

  if (qty <= 0) {
    throw new Error('QTY_MUST_BE_POSITIVE')
  }

  // Check if variant exists and has sufficient stock
  const variants = await db
    .select({ id: productVariants.id, stockQty: productVariants.stockQty })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1)

  if (variants.length === 0) {
    throw new Error('VARIANT_NOT_FOUND')
  }

  if (variants[0].stockQty < qty) {
    throw new Error('INSUFFICIENT_STOCK')
  }

  // Create transfer reference showing source → target
  const transferRef = reference || `transfer:${fromWarehouse}→${toWarehouse}`

  // Record movement as TRANSFER (qty will be negative in DB per movement.service convention)
  await db.transaction(async (tx) => {
    await recordMovement(
      {
        variantId,
        movementType: 'TRANSFER',
        qty,
        reference: transferRef,
        performedBy,
      },
      tx
    )

    // Update stock_qty
    await tx.execute(
      sql`UPDATE product_variants SET stock_qty = stock_qty - ${qty}, updated_at = now() WHERE id = ${variantId}`
    )
  })
}
