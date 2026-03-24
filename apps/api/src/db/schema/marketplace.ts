import {
  pgTable,
  uuid,
  varchar,
  boolean,
  bigint,
  numeric,
  text,
  jsonb,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { productVariants } from './products.js'

// ─── Enums ───────────────────────────────────────────────────────────────────

export const marketplacePlatformEnum = pgEnum('marketplace_platform', ['shopee', 'tiktok'])

export const marketplaceSyncDirectionEnum = pgEnum('marketplace_sync_direction', [
  'INBOUND_ONLY',
  'BIDIRECTIONAL',
])

export const marketplaceChannelStatusEnum = pgEnum('marketplace_channel_status', [
  'ACTIVE',
  'TOKEN_EXPIRED',
  'DISCONNECTED',
])

export const marketplaceOrderStatusEnum = pgEnum('marketplace_order_status', [
  'PENDING',
  'CONFIRMED',
  'READY_TO_SHIP',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'RETURNED',
  'STOCK_CONFLICT',
])

export const marketplaceSkuResolutionStatusEnum = pgEnum('marketplace_sku_resolution_status', [
  'RESOLVED',
  'UNRESOLVED',
  'PARTIAL',
])

export const marketplaceWebhookProcessingStatusEnum = pgEnum(
  'marketplace_webhook_processing_status',
  ['PENDING', 'PROCESSED', 'FAILED', 'SKIPPED']
)

// ─── Tables ──────────────────────────────────────────────────────────────────

export const marketplaceChannels = pgTable('marketplace_channels', {
  id:             uuid('id').primaryKey().defaultRandom(),
  platform:       marketplacePlatformEnum('platform').notNull(),
  shopName:       varchar('shop_name', { length: 255 }).notNull(),
  syncDirection:  marketplaceSyncDirectionEnum('sync_direction').notNull().default('INBOUND_ONLY'),
  partnerId:      varchar('partner_id', { length: 100 }),
  shopId:         varchar('shop_id', { length: 100 }),
  accessToken:    text('access_token'),
  refreshToken:   text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at', { withTimezone: true }),
  status:         marketplaceChannelStatusEnum('status').notNull().default('DISCONNECTED'),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:      timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const marketplaceOrders = pgTable('marketplace_orders', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  channelId:            uuid('channel_id').notNull().references(() => marketplaceChannels.id),
  orderSn:              varchar('order_sn', { length: 100 }).notNull().unique(),
  platform:             marketplacePlatformEnum('platform').notNull(),
  status:               marketplaceOrderStatusEnum('status').notNull(),
  buyerName:            varchar('buyer_name', { length: 255 }),
  buyerMaskedPhone:     varchar('buyer_masked_phone', { length: 50 }),
  totalAmount:          numeric('total_amount', { precision: 15, scale: 2 }).notNull(),
  escrowAmount:         numeric('escrow_amount', { precision: 15, scale: 2 }),
  platformFeeAmount:    numeric('platform_fee_amount', { precision: 15, scale: 2 }),
  sellerVoucherAmount:  numeric('seller_voucher_amount', { precision: 15, scale: 2 }),
  skuResolutionStatus:  marketplaceSkuResolutionStatusEnum('sku_resolution_status').notNull().default('UNRESOLVED'),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const marketplaceOrderItems = pgTable('marketplace_order_items', {
  id:             uuid('id').primaryKey().defaultRandom(),
  orderId:        uuid('order_id').notNull().references(() => marketplaceOrders.id, { onDelete: 'cascade' }),
  sellerSku:      varchar('seller_sku', { length: 100 }),
  shopeeItemId:   bigint('shopee_item_id', { mode: 'bigint' }),
  shopeeModelId:  bigint('shopee_model_id', { mode: 'bigint' }),
  variantId:      uuid('variant_id'),   // nullable — no FK in Drizzle (FK is in SQL migration only)
  itemName:       varchar('item_name', { length: 500 }).notNull(),
  qty:            numeric('qty').notNull(),
  unitPrice:      numeric('unit_price', { precision: 15, scale: 2 }).notNull(),
  lineTotal:      numeric('line_total', { precision: 15, scale: 2 }).notNull(),
})

export const marketplaceSkuMappings = pgTable(
  'marketplace_sku_mappings',
  {
    id:             uuid('id').primaryKey().defaultRandom(),
    channelId:      uuid('channel_id').notNull().references(() => marketplaceChannels.id),
    variantId:      uuid('variant_id').notNull().references(() => productVariants.id),
    sellerSku:      varchar('seller_sku', { length: 100 }).notNull(),
    shopeeItemId:   bigint('shopee_item_id', { mode: 'bigint' }),
    shopeeModelId:  bigint('shopee_model_id', { mode: 'bigint' }),
    isActive:       boolean('is_active').notNull().default(true),
    createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  }
)

export const marketplaceWebhookEvents = pgTable('marketplace_webhook_events', {
  id:               uuid('id').primaryKey().defaultRandom(),
  channelId:        uuid('channel_id').references(() => marketplaceChannels.id),
  eventType:        varchar('event_type', { length: 100 }).notNull(),
  payload:          jsonb('payload').notNull().default({}),
  processingStatus: marketplaceWebhookProcessingStatusEnum('processing_status').notNull().default('PENDING'),
  errorMessage:     text('error_message'),
  processedAt:      timestamp('processed_at', { withTimezone: true }),
  createdAt:        timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Inferred Types ───────────────────────────────────────────────────────────

export type MarketplaceChannel    = typeof marketplaceChannels.$inferSelect
export type NewMarketplaceChannel = typeof marketplaceChannels.$inferInsert

export type MarketplaceOrder    = typeof marketplaceOrders.$inferSelect
export type NewMarketplaceOrder = typeof marketplaceOrders.$inferInsert

export type MarketplaceOrderItem    = typeof marketplaceOrderItems.$inferSelect
export type NewMarketplaceOrderItem = typeof marketplaceOrderItems.$inferInsert

export type MarketplaceSkuMapping    = typeof marketplaceSkuMappings.$inferSelect
export type NewMarketplaceSkuMapping = typeof marketplaceSkuMappings.$inferInsert

export type MarketplaceWebhookEvent    = typeof marketplaceWebhookEvents.$inferSelect
export type NewMarketplaceWebhookEvent = typeof marketplaceWebhookEvents.$inferInsert
