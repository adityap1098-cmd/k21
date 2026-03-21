import { pgTable, uuid, varchar, integer, numeric, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const poStatusEnum = pgEnum('po_status', [
  'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED'
])

export const purchaseOrders = pgTable('purchase_orders', {
  id:           uuid('id').primaryKey().defaultRandom(),
  poNumber:     varchar('po_number', { length: 50 }).notNull().unique(),
  supplierId:   uuid('supplier_id'),    // no FK — suppliers table deferred
  supplierName: varchar('supplier_name', { length: 255 }).notNull(),
  status:       poStatusEnum('status').notNull().default('DRAFT'),
  notes:        varchar('notes', { length: 2000 }),
  subtotal:     numeric('subtotal', { precision: 15, scale: 2 }).notNull(),
  taxAmount:    numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
  total:        numeric('total', { precision: 15, scale: 2 }).notNull(),
  createdBy:    uuid('created_by').notNull(),
  approvedBy:   uuid('approved_by'),
  approvedAt:   timestamp('approved_at', { withTimezone: true }),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const purchaseOrderItems = pgTable('purchase_order_items', {
  id:              uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  variantId:       uuid('variant_id').notNull(),  // no FK — same pattern as transactionItems
  variantSku:      varchar('variant_sku', { length: 100 }).notNull(),
  variantName:     varchar('variant_name', { length: 255 }).notNull(),
  qty:             integer('qty').notNull(),
  unitCost:        numeric('unit_cost', { precision: 15, scale: 2 }).notNull(),
  lineTotal:       numeric('line_total', { precision: 15, scale: 2 }).notNull(),
})

export const goodsReceipts = pgTable('goods_receipts', {
  id:              uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id').notNull().references(() => purchaseOrders.id),
  itemId:          uuid('item_id').notNull().references(() => purchaseOrderItems.id),
  qtyReceived:     integer('qty_received').notNull(),
  receivedBy:      uuid('received_by').notNull(),
  receivedAt:      timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  notes:           varchar('notes', { length: 500 }),
})

export type PurchaseOrder = typeof purchaseOrders.$inferSelect
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert
export type PurchaseOrderItem = typeof purchaseOrderItems.$inferSelect
export type NewPurchaseOrderItem = typeof purchaseOrderItems.$inferInsert
export type GoodsReceipt = typeof goodsReceipts.$inferSelect
export type NewGoodsReceipt = typeof goodsReceipts.$inferInsert
