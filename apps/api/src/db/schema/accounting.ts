import { pgTable, uuid, varchar, integer, timestamp } from 'drizzle-orm/pg-core'

export const journalEntries = pgTable('journal_entries', {
  id:            uuid('id').primaryKey().defaultRandom(),
  // No FK to transactions — Phase 7 will formalize the accounting module
  transactionId: uuid('transaction_id').notNull(),
  sourceType:    varchar('source_type', { length: 50 }).notNull(),
  amount:        integer('amount').notNull(),
  status:        varchar('status', { length: 20 }).notNull().default('PENDING'),
  debitCredit:   varchar('debit_credit', { length: 2 }),
  referenceId:   uuid('reference_id'),
  createdAt:     timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type JournalEntry = typeof journalEntries.$inferSelect
export type NewJournalEntry = typeof journalEntries.$inferInsert
