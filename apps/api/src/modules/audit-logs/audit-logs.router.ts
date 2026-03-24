import { Router } from 'express'
import { z } from 'zod'
import { desc, eq, and, gte, lte, sql, count } from 'drizzle-orm'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { db } from '../../db/index.js'
import { auditLogs } from '../../db/schema/audit-logs.js'
import { users } from '../../db/schema/users.js'

export const auditLogsRouter = Router()

const querySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE']).optional(),
  tableName: z.string().optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

// GET /audit-logs — list with filters and pagination
auditLogsRouter.get(
  '/',
  authenticate,
  requireRole('Owner', 'Admin'),
  async (req, res) => {
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      res.status(400).json({ success: false, data: null, error: 'Invalid query parameters' })
      return
    }

    const { page, limit, action, tableName, userId, dateFrom, dateTo } = parsed.data

    try {
      // Build WHERE fragments
      const fragments: any[] = []
      if (action) fragments.push(sql`a.action = ${action}`)
      if (tableName) fragments.push(sql`a.table_name = ${tableName}`)
      if (userId) fragments.push(sql`a.user_id = ${userId}`)
      if (dateFrom) fragments.push(sql`a.created_at >= ${new Date(dateFrom).toISOString()}`)
      if (dateTo) {
        const end = new Date(dateTo)
        end.setDate(end.getDate() + 1)
        fragments.push(sql`a.created_at < ${end.toISOString()}`)
      }

      const whereClause = fragments.length > 0
        ? sql`WHERE ${sql.join(fragments, sql` AND `)}`
        : sql``

      // Count
      const countResult = await db.execute(sql`
        SELECT COUNT(*) AS total FROM audit_logs a ${whereClause}
      `)
      const total = Number((countResult as unknown as any[])[0]?.total ?? 0)

      // Fetch with user join
      const rows = await db.execute(sql`
        SELECT
          a.id,
          a.user_id,
          COALESCE(u.name, u.email, 'Deleted User') AS user_name,
          a.action,
          a.table_name,
          a.record_id,
          a.old_value,
          a.new_value,
          a.ip_address,
          a.created_at
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.user_id
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT ${limit} OFFSET ${(page - 1) * limit}
      `)

      res.json({ success: true, data: { items: rows, total }, error: null })
    } catch (err) {
      console.error('[audit-logs] GET / failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)

// GET /audit-logs/tables — distinct table names for filter dropdown
auditLogsRouter.get(
  '/tables',
  authenticate,
  requireRole('Owner', 'Admin'),
  async (_req, res) => {
    try {
      const rows = await db.execute(sql`
        SELECT DISTINCT table_name FROM audit_logs ORDER BY table_name
      `)
      const tables = (rows as unknown as Array<{ table_name: string }>).map(r => r.table_name)
      res.json({ success: true, data: tables, error: null })
    } catch (err) {
      console.error('[audit-logs] GET /tables failed:', err)
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
  }
)
