import { pgTable, uuid, varchar, integer, pgEnum, timestamp } from 'drizzle-orm/pg-core'
import { productVariants } from './products.js'

export const movementTypeEnum = pgEnum('movement_type', [
  'SALE', 'PURCHASE', 'TRANSFER', 'RETURN', 'ADJUSTMENT'
])

export const inventoryMovements = pgTable('inventory_movements', {
  id:           uuid('id').primaryKey().defaultRandom(),
  variantId:    uuid('variant_id').notNull().references(() => productVariants.id),
  movementType: movementTypeEnum('movement_type').notNull(),
  qty:          integer('qty').notNull(),
  reference:    varchar('reference', { length: 255 }),
  reason:       varchar('reason', { length: 500 }),
  approvedBy:   uuid('approved_by'),
  performedBy:  uuid('performed_by').notNull(),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  // NO updatedAt — append-only
})

export const reservationStatusEnum = pgEnum('reservation_status', ['ACTIVE', 'FULFILLED', 'CANCELLED'])

export const stockReservations = pgTable('stock_reservations', {
  id:         uuid('id').primaryKey().defaultRandom(),
  variantId:  uuid('variant_id').notNull().references(() => productVariants.id),
  qty:        integer('qty').notNull(),
  orderRef:   varchar('order_ref', { length: 255 }).notNull(),
  status:     reservationStatusEnum('status').notNull().default('ACTIVE'),
  reservedAt: timestamp('reserved_at', { withTimezone: true }).notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
})

export type InventoryMovement = typeof inventoryMovements.$inferSelect
export type NewInventoryMovement = typeof inventoryMovements.$inferInsert
export type StockReservation = typeof stockReservations.$inferSelect
