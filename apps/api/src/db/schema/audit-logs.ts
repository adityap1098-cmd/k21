import { pgTable, uuid, varchar, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const actionEnum = pgEnum('audit_action', ['CREATE', 'UPDATE', 'DELETE'])

export const auditLogs = pgTable('audit_logs', {
  id:        uuid('id').primaryKey().defaultRandom(),
  userId:    uuid('user_id').notNull(), // intentionally no FK — preserve logs if user deleted
  action:    actionEnum('action').notNull(),
  tableName: varchar('table_name', { length: 100 }).notNull(),
  recordId:  uuid('record_id').notNull(),
  oldValue:  jsonb('old_value'),
  newValue:  jsonb('new_value'),
  ipAddress: varchar('ip_address', { length: 45 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export type AuditLog = typeof auditLogs.$inferSelect
