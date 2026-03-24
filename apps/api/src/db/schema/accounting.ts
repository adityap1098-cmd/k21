import { pgTable, uuid, varchar, integer, boolean, text, timestamp, pgEnum } from 'drizzle-orm/pg-core'
import { transactions } from './pos.js'

// ─── Accounts (Chart of Accounts) ───────────────────────────────────────────

export const accountTypeEnum = pgEnum('account_type', ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'])

export const accounts = pgTable('accounts', {
  id:         uuid('id').primaryKey().defaultRandom(),
  code:       varchar('code', { length: 10 }).notNull().unique(),
  name:       varchar('name', { length: 100 }).notNull(),
  type:       accountTypeEnum('type').notNull(),
  parentCode: varchar('parent_code', { length: 10 }),
  isActive:   boolean('is_active').notNull().default(true),
  createdAt:  timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

// ─── Journal Entries ────────────────────────────────────────────────────────

export const journalEntryStatusEnum = pgEnum('journal_entry_status', ['PENDING', 'POSTED', 'REVERSED'])
export const debitCreditEnum = pgEnum('debit_credit', ['DR', 'CR'])
export const journalSourceTypeEnum = pgEnum('journal_source_type', [
  'POS_SALE', 'VOID', 'SERVICE_COMPLETION', 'CASH_RECEIPT',
  'MARKETPLACE_SALE', 'PURCHASE', 'SUPPLIER_PAYMENT', 'PAYROLL', 'ADJUSTMENT',
])

export const journalEntries = pgTable('journal_entries', {
  id:            uuid('id').primaryKey().defaultRandom(),
  transactionId: uuid('transaction_id').notNull().references(() => transactions.id),
  sourceType:    journalSourceTypeEnum('source_type').notNull(),
  sourceId:      uuid('source_id'),
  amount:        integer('amount').notNull(),
  status:        journalEntryStatusEnum('status').notNull().default('PENDING'),
  debitCredit:   debitCreditEnum('debit_credit').notNull(),
  referenceId:   uuid('reference_id'),
  notes:         text('notes'),
  postedAt:      timestamp('posted_at', { withTimezone: true }),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Account = typeof accounts.$inferSelect
export type NewAccount = typeof accounts.$inferInsert
export type JournalEntry = typeof journalEntries.$inferSelect
export type NewJournalEntry = typeof journalEntries.$inferInsert
