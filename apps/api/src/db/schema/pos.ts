import { pgTable, uuid, varchar, integer, pgEnum, timestamp } from 'drizzle-orm/pg-core'

export const shiftStatusEnum = pgEnum('shift_status', ['OPEN', 'CLOSED'])
export const transactionStatusEnum = pgEnum('transaction_status', ['COMPLETED', 'VOIDED'])
export const paymentMethodEnum = pgEnum('payment_method', ['CASH', 'TRANSFER', 'QRIS'])

export const shifts = pgTable('shifts', {
  id:            uuid('id').primaryKey().defaultRandom(),
  cashierId:     uuid('cashier_id').notNull(),
  status:        shiftStatusEnum('status').notNull().default('OPEN'),
  openingFloat:  integer('opening_float').notNull(),
  closingCash:   integer('closing_cash'),
  openedAt:      timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt:      timestamp('closed_at', { withTimezone: true }),
})

export const transactions = pgTable('transactions', {
  id:             uuid('id').primaryKey().defaultRandom(),
  clientUuid:     varchar('client_uuid', { length: 36 }).notNull().unique(),
  shiftId:        uuid('shift_id').notNull().references(() => shifts.id),
  cashierId:      uuid('cashier_id').notNull(),
  subtotal:       integer('subtotal').notNull(),
  discountAmount: integer('discount_amount').notNull().default(0),
  total:          integer('total').notNull(),
  status:         transactionStatusEnum('status').notNull().default('COMPLETED'),
  voidReason:     varchar('void_reason', { length: 500 }),
  voidedAt:       timestamp('voided_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const transactionItems = pgTable('transaction_items', {
  id:             uuid('id').primaryKey().defaultRandom(),
  transactionId:  uuid('transaction_id').notNull().references(() => transactions.id),
  // No FK to product_variants — avoids cross-schema import cycles; enforced at service layer
  variantId:      uuid('variant_id').notNull(),
  qty:            integer('qty').notNull(),
  unitPrice:      integer('unit_price').notNull(),
  discountAmount: integer('discount_amount').notNull().default(0),
  lineTotal:      integer('line_total').notNull(),
})

export const transactionPayments = pgTable('transaction_payments', {
  id:            uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id),
  method:        paymentMethodEnum('method').notNull(),
  amount:        integer('amount').notNull(),
  reference:     varchar('reference', { length: 255 }),
})

export type Shift = typeof shifts.$inferSelect
export type NewShift = typeof shifts.$inferInsert
export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
export type TransactionItem = typeof transactionItems.$inferSelect
export type NewTransactionItem = typeof transactionItems.$inferInsert
export type TransactionPayment = typeof transactionPayments.$inferSelect
export type NewTransactionPayment = typeof transactionPayments.$inferInsert
