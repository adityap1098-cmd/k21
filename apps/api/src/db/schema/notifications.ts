import { pgTable, uuid, varchar, jsonb, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const notifications = pgTable('notifications', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type:      varchar('type', { length: 50 }).notNull(),
  payload:   jsonb('payload').notNull(),
  readAt:    timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type Notification = typeof notifications.$inferSelect
