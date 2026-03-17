import { pgTable, uuid, varchar, timestamp } from 'drizzle-orm/pg-core'

export const categories = pgTable('categories', {
  id:        uuid('id').primaryKey().defaultRandom(),
  name:      varchar('name', { length: 255 }).notNull(),
  // self-ref FK added in migration SQL — Drizzle v0.30 self-ref requires manual migration
  parentId:  uuid('parent_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Category = typeof categories.$inferSelect
export type NewCategory = typeof categories.$inferInsert
