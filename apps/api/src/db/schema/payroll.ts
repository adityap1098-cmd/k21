import { pgTable, uuid, varchar, integer, boolean, timestamp } from 'drizzle-orm/pg-core'
import { users } from './users.js'

export const payrollEmployees = pgTable('payroll_employees', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  nama: varchar('nama', { length: 100 }).notNull(),
  jabatan: varchar('jabatan', { length: 100 }).notNull(),
  gajiPokok: integer('gaji_pokok').notNull().default(0),
  tunjangan: integer('tunjangan').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

export type PayrollEmployee = typeof payrollEmployees.$inferSelect
