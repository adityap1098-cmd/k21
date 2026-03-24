import { pgTable, uuid, varchar, integer, pgEnum, timestamp } from 'drizzle-orm/pg-core'
import { productVariants } from './products.js'

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
  note:           varchar('note', { length: 500 }),
  voidReason:     varchar('void_reason', { length: 500 }),
  voidedAt:       timestamp('voided_at', { withTimezone: true }),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const transactionItems = pgTable('transaction_items', {
  id:             uuid('id').primaryKey().defaultRandom(),
  transactionId:  uuid('transaction_id').notNull().references(() => transactions.id),
  variantId:      uuid('variant_id').notNull().references(() => productVariants.id),
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

export const cashTransactionTypeEnum = pgEnum('cash_transaction_type', ['IN', 'OUT'])

export const shiftCashTransactions = pgTable('shift_cash_transactions', {
  id:          uuid('id').primaryKey().defaultRandom(),
  shiftId:     uuid('shift_id').notNull().references(() => shifts.id, { onDelete: 'cascade' }),
  type:        cashTransactionTypeEnum('type').notNull(),
  amount:      integer('amount').notNull(),
  description: varchar('description', { length: 255 }).notNull(),
  createdBy:   uuid('created_by').notNull(),
  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Shift = typeof shifts.$inferSelect
export type NewShift = typeof shifts.$inferInsert
export type ShiftCashTransaction = typeof shiftCashTransactions.$inferSelect
export type NewShiftCashTransaction = typeof shiftCashTransactions.$inferInsert
export const transactionReturns = pgTable('transaction_returns', {
  id:            uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id),
  variantId:     uuid('variant_id').notNull().references(() => productVariants.id),
  qty:           integer('qty').notNull(),
  refundAmount:  integer('refund_amount').notNull(),
  reason:        varchar('reason', { length: 500 }).notNull(),
  performedBy:   uuid('performed_by').notNull(),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type TransactionReturn = typeof transactionReturns.$inferSelect

export type Transaction = typeof transactions.$inferSelect
export type NewTransaction = typeof transactions.$inferInsert
export type TransactionItem = typeof transactionItems.$inferSelect
export type NewTransactionItem = typeof transactionItems.$inferInsert
export type TransactionPayment = typeof transactionPayments.$inferSelect
export type NewTransactionPayment = typeof transactionPayments.$inferInsert
