import { pgTable, uuid, varchar, boolean, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('user_role', [
  'Owner',
  'Finance',
  'Warehouse Staff',
  'Cashier',
  'Admin',
])

export const users = pgTable('users', {
  id:                 uuid('id').primaryKey().defaultRandom(),
  name:               varchar('name', { length: 100 }),
  email:              varchar('email', { length: 255 }).notNull().unique(),
  passwordHash:       varchar('password_hash', { length: 255 }).notNull(),
  role:               roleEnum('role').notNull(),
  isActive:           boolean('is_active').notNull().default(true),
  mustChangePassword: boolean('must_change_password').notNull().default(true),
  createdAt:          timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:          timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
