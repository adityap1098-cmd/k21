import { pgTable, uuid, varchar, text, boolean, timestamp } from 'drizzle-orm/pg-core'

export const suppliers = pgTable('suppliers', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      varchar('name', { length: 255 }).notNull(),
  contact:   varchar('contact', { length: 255 }),
  phone:     varchar('phone', { length: 50 }),
  email:     varchar('email', { length: 255 }),
  address:   text('address'),
  notes:     text('notes'),
  active:    boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Supplier = typeof suppliers.$inferSelect
export type NewSupplier = typeof suppliers.$inferInsert
