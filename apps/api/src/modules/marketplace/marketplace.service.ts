/**
 * Marketplace Service
 * Handles marketplace channel management and order/webhook operations.
 */

import { and, eq, desc, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import {
  marketplaceChannels,
  marketplaceOrders,
  marketplaceOrderItems,
  marketplaceSkuMappings,
  marketplaceWebhookEvents,
  type MarketplaceChannel,
  type MarketplaceOrder,
  type MarketplaceOrderItem,
} from '../../db/schema/marketplace.js'
import { stockReservations } from '../../db/schema/inventory.js'
import { createReservation, cancelReservation, fulfillReservation } from '../inventory/reservation.service.js'
import { decrementStock } from '../inventory/movement.service.js'
import { notifyByRoles } from '../notifications/notifications.service.js'
import { createMarketplaceJournalEntry } from '../accounting/accounting.service.js'

// Sentinel UUID used as the performedBy actor for automated marketplace operations.
// This is a virtual system actor — not a real user row — but satisfies the UUID column type.
const MARKETPLACE_SYSTEM_USER = '00000000-0000-0000-0000-000000000001'

type DrizzleTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export interface ChannelOrder {
  id: string
  channelId: string
  orderSn: string
  platform: string
  status: string
  buyerName: string | null
  totalAmount: string
  skuResolutionStatus: string
  createdAt: Date
}

export interface WebhookEvent {
  id: string
  channelId: string | null
  eventType: string
  payload: Record<string, unknown>
  processingStatus: string
  errorMessage: string | null
  processedAt: Date | null
  createdAt: Date
}

// ─── Shopee payload shapes ────────────────────────────────────────────────────

interface ShopeeOrderItem {
  item_id?: number | bigint
  model_id?: number | bigint
  seller_sku?: string
  item_name?: string
  model_qty?: number
  order_item_id?: number
  model_discounted_price?: number
  [key: string]: unknown
}

interface ShopeeOrderCreatedPayload {
  order_sn: string
  status?: string
  buyer_username?: string
  total_amount?: number | string
  buyer_masked_phone?: string
  item_list?: ShopeeOrderItem[]
  [key: string]: unknown
}

interface ShopeeCancelledPayload {
  order_sn: string
  [key: string]: unknown
}

interface ShopeeShippedPayload {
  order_sn: string
  [key: string]: unknown
}

// ─── Channel Management ───────────────────────────────────────────────────────

/**
 * List all marketplace channels for this business.
 * Returns real DB rows ordered by creation date.
 */
export async function listChannels(): Promise<MarketplaceChannel[]> {
  return db.select().from(marketplaceChannels).orderBy(marketplaceChannels.createdAt)
}

/**
 * Get orders for a specific marketplace channel with pagination and optional status filter.
 * Returns { data, total, limit, offset } for paginated consumption.
 */
export async function getChannelOrders(
  channelId: string,
  filters?: { status?: string; limit?: number; offset?: number }
): Promise<{ data: ChannelOrder[]; total: number; limit: number; offset: number }> {
  const limit = filters?.limit ?? 20
  const offset = filters?.offset ?? 0
  const conditions = [eq(marketplaceOrders.channelId, channelId)]
  if (filters?.status) {
    conditions.push(eq(marketplaceOrders.status, filters.status as any))
  }
  const whereClause = and(...conditions)
  const [rows, countResult] = await Promise.all([
    db.select().from(marketplaceOrders)
      .where(whereClause)
      .orderBy(desc(marketplaceOrders.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` })
      .from(marketplaceOrders)
      .where(whereClause),
  ])
  return { data: rows as ChannelOrder[], total: countResult[0]?.count ?? 0, limit, offset }
}

/**
 * Get webhook events for a specific channel with pagination and optional eventType filter.
 * Returns { data, total, limit, offset } for paginated consumption.
 */
export async function getWebhookEvents(
  channelId: string,
  filters?: { eventType?: string; limit?: number; offset?: number }
): Promise<{ data: WebhookEvent[]; total: number; limit: number; offset: number }> {
  const limit = filters?.limit ?? 30
  const offset = filters?.offset ?? 0
  const conditions = [eq(marketplaceWebhookEvents.channelId, channelId)]
  if (filters?.eventType) {
    conditions.push(eq(marketplaceWebhookEvents.eventType, filters.eventType))
  }
  const whereClause = and(...conditions)
  const [rows, countResult] = await Promise.all([
    db.select().from(marketplaceWebhookEvents)
      .where(whereClause)
      .orderBy(desc(marketplaceWebhookEvents.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` })
      .from(marketplaceWebhookEvents)
      .where(whereClause),
  ])
  return { data: rows as WebhookEvent[], total: countResult[0]?.count ?? 0, limit, offset }
}

// ─── Order Detail ─────────────────────────────────────────────────────────────

export interface OrderDetail {
  order: MarketplaceOrder
  items: MarketplaceOrderItem[]
}

/**
 * Get a single order and its line items by internal order UUID.
 * Throws Error('ORDER_NOT_FOUND') if the order does not exist.
 */
export async function getOrderDetail(orderId: string): Promise<OrderDetail> {
  const [order] = await db
    .select()
    .from(marketplaceOrders)
    .where(eq(marketplaceOrders.id, orderId))
    .limit(1)
  if (!order) throw new Error('ORDER_NOT_FOUND')
  const items = await db
    .select()
    .from(marketplaceOrderItems)
    .where(eq(marketplaceOrderItems.orderId, orderId))
  return { order, items }
}

// ─── SKU Mapping ──────────────────────────────────────────────────────────────

/**
 * Resolve a seller SKU to an internal variant ID for a given marketplace channel.
 * Returns { variantId } if a live mapping exists, null if not found.
 */
export async function resolveSkuMapping(
  channelId: string,
  sellerSku: string
): Promise<{ variantId: string } | null> {
  const [row] = await db
    .select({ variantId: marketplaceSkuMappings.variantId })
    .from(marketplaceSkuMappings)
    .where(
      and(
        eq(marketplaceSkuMappings.channelId, channelId),
        eq(marketplaceSkuMappings.sellerSku, sellerSku),
        eq(marketplaceSkuMappings.isActive, true)
      )
    )
    .limit(1)

  return row ? { variantId: row.variantId } : null
}

// ─── Order Lifecycle ──────────────────────────────────────────────────────────

/**
 * Process a Shopee order.created webhook event.
 *
 * Steps:
 *  1. Upsert order row — if duplicate (onConflictDoNothing returns empty), skip.
 *  2. Resolve each line-item's seller_sku → variantId via sku mapping.
 *  3. Insert marketplace_order_items rows.
 *  4. Determine skuResolutionStatus (RESOLVED / PARTIAL / UNRESOLVED).
 *  5. For resolved items only: createReservation inside a transaction.
 *  6. If any items are unresolved: send UNRESOLVED_SKU notification.
 */
export async function processOrderCreated(
  payload: ShopeeOrderCreatedPayload,
  _eventId: string,
  channelId: string | null
): Promise<void> {
  const {
    order_sn,
    status,
    buyer_username,
    total_amount,
    buyer_masked_phone,
    item_list = [],
  } = payload

  const totalAmountNum = typeof total_amount === 'string'
    ? parseFloat(total_amount)
    : (total_amount ?? 0)

  // ── Step 1: Upsert order — idempotency guard ──────────────────────────────
  const insertedOrders = await db
    .insert(marketplaceOrders)
    .values({
      channelId: channelId ?? '00000000-0000-0000-0000-000000000000', // fallback if channel unknown
      orderSn: order_sn,
      platform: 'shopee',
      status: mapShopeeStatus(status),
      buyerName: buyer_username ?? null,
      buyerMaskedPhone: buyer_masked_phone ?? null,
      totalAmount: String(totalAmountNum),
      skuResolutionStatus: 'UNRESOLVED', // will be updated below
    })
    .onConflictDoNothing()
    .returning({ id: marketplaceOrders.id })

  if (insertedOrders.length === 0) {
    // Duplicate order_sn — already processed
    console.log(`[marketplace-service] duplicate order_sn — skipping (order_sn=${order_sn})`)
    return
  }

  const orderId = insertedOrders[0].id

  // ── Step 2: Resolve SKU mappings ─────────────────────────────────────────
  type ItemResolution = {
    item: ShopeeOrderItem
    variantId: string | null
  }

  const resolutions: ItemResolution[] = await Promise.all(
    item_list.map(async (item) => {
      if (!item.seller_sku || !channelId) return { item, variantId: null }
      const mapping = await resolveSkuMapping(channelId, item.seller_sku)
      return { item, variantId: mapping?.variantId ?? null }
    })
  )

  const resolvedItems    = resolutions.filter(r => r.variantId !== null)
  const unresolvedItems  = resolutions.filter(r => r.variantId === null)

  let skuResolutionStatus: 'RESOLVED' | 'UNRESOLVED' | 'PARTIAL'
  if (unresolvedItems.length === 0 && resolvedItems.length > 0) {
    skuResolutionStatus = 'RESOLVED'
  } else if (resolvedItems.length === 0) {
    skuResolutionStatus = 'UNRESOLVED'
  } else {
    skuResolutionStatus = 'PARTIAL'
  }

  // ── Step 3: Insert order items ────────────────────────────────────────────
  if (resolutions.length > 0) {
    await db.insert(marketplaceOrderItems).values(
      resolutions.map(({ item, variantId }) => ({
        orderId,
        sellerSku: item.seller_sku ?? null,
        shopeeItemId: item.item_id ? BigInt(item.item_id as number) : null,
        shopeeModelId: item.model_id ? BigInt(item.model_id as number) : null,
        variantId: variantId ?? null,
        itemName: item.item_name ?? 'Unknown Item',
        qty: String(item.model_qty ?? 1),
        unitPrice: String(item.model_discounted_price ?? 0),
        lineTotal: String((item.model_discounted_price ?? 0) * (item.model_qty ?? 1)),
      }))
    )
  }

  // ── Step 4: Update skuResolutionStatus on the order row ──────────────────
  await db
    .update(marketplaceOrders)
    .set({ skuResolutionStatus, updatedAt: new Date() })
    .where(eq(marketplaceOrders.id, orderId))

  // ── Step 5: Create reservations for resolved items inside a transaction ──
  if (resolvedItems.length > 0) {
    await db.transaction(async (tx: DrizzleTx) => {
      for (const { item, variantId } of resolvedItems) {
        const qty = Number(item.model_qty ?? 1)
        await createReservation(
          { variantId: variantId!, qty, orderRef: order_sn },
          tx
        )
      }
    })
  }

  // ── Step 6: Notify on unresolved SKUs ────────────────────────────────────
  if (skuResolutionStatus !== 'RESOLVED') {
    await notifyByRoles({
      roles: ['Owner', 'Admin'],
      type: 'UNRESOLVED_SKU',
      payload: { orderId, orderSn: order_sn },
    })
  }
}

/**
 * Process a Shopee order.cancelled webhook event.
 *
 * Cancels all ACTIVE stock reservations for this order and updates order status.
 */
export async function processOrderCancelled(
  payload: ShopeeCancelledPayload
): Promise<void> {
  const { order_sn } = payload

  // Find all active reservations for this order
  const activeReservations = await db
    .select()
    .from(stockReservations)
    .where(
      and(
        eq(stockReservations.orderRef, order_sn),
        eq(stockReservations.status, 'ACTIVE')
      )
    )

  // Cancel each reservation
  for (const reservation of activeReservations) {
    await cancelReservation(reservation.id)
  }

  // Update order status to CANCELLED
  await db
    .update(marketplaceOrders)
    .set({ status: 'CANCELLED', updatedAt: new Date() })
    .where(eq(marketplaceOrders.orderSn, order_sn))
}

/**
 * Process a Shopee order.shipped webhook event.
 *
 * For each active reservation:
 *  1. fulfillReservation (marks FULFILLED)
 *  2. decrementStock (writes movement, deducts stock_qty)
 * After all fulfilled: write MARKETPLACE_SALE journal entry (best-effort).
 * Updates order status to SHIPPED.
 */
export async function processOrderShipped(
  payload: ShopeeShippedPayload
): Promise<void> {
  const { order_sn } = payload

  // Find the order row for the journal entry
  const [order] = await db
    .select()
    .from(marketplaceOrders)
    .where(eq(marketplaceOrders.orderSn, order_sn))
    .limit(1)

  // Find all active reservations for this order
  const activeReservations = await db
    .select()
    .from(stockReservations)
    .where(
      and(
        eq(stockReservations.orderRef, order_sn),
        eq(stockReservations.status, 'ACTIVE')
      )
    )

  // Fulfill each reservation and decrement stock
  for (const reservation of activeReservations) {
    await fulfillReservation(reservation.id)
    await decrementStock({
      variantId: reservation.variantId,
      qty: reservation.qty,
      movementType: 'SALE',
      reference: order_sn,
      performedBy: MARKETPLACE_SYSTEM_USER,
    })
  }

  // Write journal entry (best-effort — failure is logged, not re-thrown)
  if (order) {
    try {
      await db.transaction(async (tx: DrizzleTx) => {
        await createMarketplaceJournalEntry(
          {
            orderId: order.id,
            total: Math.round(Number(order.totalAmount)),
          },
          tx
        )
      })
    } catch (err) {
      console.error(
        `[marketplace-service] journal entry failed for order_sn=${order_sn} orderId=${order.id}: ${(err as Error).message}`
      )
      // Best-effort: decrementStock has already committed — do not re-throw
    }
  }

  // Update order status to SHIPPED
  await db
    .update(marketplaceOrders)
    .set({ status: 'SHIPPED', updatedAt: new Date() })
    .where(eq(marketplaceOrders.orderSn, order_sn))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Map a Shopee order status string to the internal enum value.
 * Defaults to PENDING for unknown statuses.
 */
function mapShopeeStatus(
  status?: string
): 'PENDING' | 'CONFIRMED' | 'READY_TO_SHIP' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED' | 'RETURNED' | 'STOCK_CONFLICT' {
  switch ((status ?? '').toUpperCase()) {
    case 'READY_TO_SHIP': return 'READY_TO_SHIP'
    case 'SHIPPED':       return 'SHIPPED'
    case 'DELIVERED':     return 'DELIVERED'
    case 'CANCELLED':     return 'CANCELLED'
    case 'RETURNED':      return 'RETURNED'
    case 'CONFIRMED':     return 'CONFIRMED'
    default:              return 'PENDING'
  }
}
