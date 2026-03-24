import { eq, and, isNull, desc, count, sql } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { notifications, type Notification } from '../../db/schema/notifications.js'

export async function listNotifications(userId: string, limit = 20): Promise<Notification[]> {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function getUnreadCount(userId: string): Promise<number> {
  const result = await db
    .select({ cnt: count() })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))

  return Number(result[0]?.cnt ?? 0)
}

export async function markAsRead(userId: string, notificationId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, notificationId), eq(notifications.userId, userId)))
}

export async function markAllAsRead(userId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)))
}

export async function createNotification(params: {
  userId: string
  type: string
  payload: Record<string, unknown>
}): Promise<Notification> {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: params.userId,
      type: params.type,
      payload: params.payload,
    })
    .returning()

  return row
}

/**
 * Create a notification for all users with specific roles.
 * Useful for system-wide alerts like low stock, PO approvals, etc.
 */
export async function notifyByRoles(params: {
  roles: string[]
  type: string
  payload: Record<string, unknown>
}): Promise<void> {
  const userRows = await db.execute(sql`
    SELECT id FROM users WHERE role = ANY(${params.roles}) AND is_active = true
  `)

  const userIds = (userRows as unknown as Array<{ id: string }>).map(r => r.id)

  if (userIds.length === 0) return

  await db.insert(notifications).values(
    userIds.map(userId => ({
      userId,
      type: params.type,
      payload: params.payload,
    }))
  )
}
