import { pgTable, uuid, varchar, boolean, integer, timestamp, pgEnum, text } from 'drizzle-orm/pg-core'
import { paymentMethodEnum } from './pos.js'

export const vehicleTypeEnum = pgEnum('vehicle_type', ['MOTOR', 'MOBIL'])

export const customers = pgTable('customers', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      varchar('name', { length: 255 }).notNull(),
  phone:     varchar('phone', { length: 30 }).notNull().unique(),
  isActive:  boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export const vehicles = pgTable('vehicles', {
  id:          uuid('id').primaryKey().defaultRandom(),
  customerId:  uuid('customer_id').notNull().references(() => customers.id),
  plateNumber: varchar('plate_number', { length: 20 }).notNull().unique(),
  vehicleType: vehicleTypeEnum('vehicle_type').notNull(),
  brand:       varchar('brand', { length: 100 }).notNull(),
  model:       varchar('model', { length: 100 }).notNull(),
  year:        integer('year'),
  isActive:    boolean('is_active').notNull().default(true),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Customer = typeof customers.$inferSelect
export type NewCustomer = typeof customers.$inferInsert
export type Vehicle = typeof vehicles.$inferSelect
export type NewVehicle = typeof vehicles.$inferInsert

// --- Service enums ---

export const workStatusEnum = pgEnum('work_status', ['BOOKING', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED'])

export const paymentStatusEnum = pgEnum('payment_status', ['UNPAID', 'PARTIAL', 'PAID'])

// --- Service catalog ---

export const serviceCatalog = pgTable('service_catalog', {
  id:           uuid('id').primaryKey().defaultRandom(),
  name:         varchar('name', { length: 255 }).notNull(),
  description:  text('description'),
  defaultPrice: integer('default_price').notNull(),
  isActive:     boolean('is_active').notNull().default(true),
  createdAt:    timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// --- Service orders ---

export const serviceOrders = pgTable('service_orders', {
  id:                   uuid('id').primaryKey().defaultRandom(),
  orderNumber:          varchar('order_number', { length: 20 }).notNull().unique(),
  vehicleId:            uuid('vehicle_id').notNull().references(() => vehicles.id),
  mechanicId:           uuid('mechanic_id'),  // no FK — mechanics table deferred
  workStatus:           workStatusEnum('work_status').notNull().default('BOOKING'),
  paymentStatus:        paymentStatusEnum('payment_status').notNull().default('UNPAID'),
  complaint:            text('complaint'),
  estimatedCompletionAt: timestamp('estimated_completion_at', { withTimezone: true }),
  estimatedCost:        integer('estimated_cost'),
  bookingDate:          timestamp('booking_date', { withTimezone: true }),
  checkedInAt:          timestamp('checked_in_at', { withTimezone: true }),
  completedAt:          timestamp('completed_at', { withTimezone: true }),
  createdBy:            uuid('created_by').notNull(),
  createdAt:            timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:            timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// --- Service order items ---

export const itemTypeEnum = pgEnum('item_type', ['SERVICE', 'PART'])

export const serviceOrderItems = pgTable('service_order_items', {
  id:              uuid('id').primaryKey().defaultRandom(),
  serviceOrderId:  uuid('service_order_id').notNull().references(() => serviceOrders.id),
  itemType:        itemTypeEnum('item_type').notNull(),
  catalogItemId:   uuid('catalog_item_id'),          // no FK — validated at service layer
  variantId:       uuid('variant_id'),               // no FK — validated at service layer
  description:     varchar('description', { length: 255 }).notNull(),
  qty:             integer('qty').notNull(),
  unitPrice:       integer('unit_price').notNull(),
  lineTotal:       integer('line_total').notNull(),
})

export type ServiceCatalogItem = typeof serviceCatalog.$inferSelect
export type NewServiceCatalogItem = typeof serviceCatalog.$inferInsert
export type ServiceOrder = typeof serviceOrders.$inferSelect
export type NewServiceOrder = typeof serviceOrders.$inferInsert
export type ServiceOrderItem = typeof serviceOrderItems.$inferSelect
export type NewServiceOrderItem = typeof serviceOrderItems.$inferInsert

// --- Service payments ---

export const servicePayments = pgTable('service_payments', {
  id:              uuid('id').primaryKey().defaultRandom(),
  serviceOrderId:  uuid('service_order_id').notNull().references(() => serviceOrders.id),
  amount:          integer('amount').notNull(),
  method:          paymentMethodEnum('method').notNull(),
  reference:       varchar('reference', { length: 100 }),
  paidAt:          timestamp('paid_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy:       uuid('created_by').notNull(),
})

export type ServicePayment = typeof servicePayments.$inferSelect
export type NewServicePayment = typeof servicePayments.$inferInsert
