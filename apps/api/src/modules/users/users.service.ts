import argon2 from 'argon2'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users, refreshTokens } from '../../db/schema/index.js'
import { logAudit } from '../../middleware/audit.js'
import type { Role } from '../../middleware/require-role.js'

export type SafeUser = Omit<
  typeof users.$inferSelect,
  'passwordHash'
> & { passwordHash?: never }

export async function createUser(
  params: { email: string; password: string; role: Role },
  adminId = 'system',
  ipAddress = '0.0.0.0'
): Promise<typeof users.$inferSelect & { auditLog: { action: string; tableName: string; userId: string } }> {
  const { email, password, role } = params

  if (password.length < 8) {
    throw new Error('PASSWORD_TOO_SHORT')
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id })

  const [user] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      email,
      passwordHash,
      role,
      isActive: true,
      mustChangePassword: true,
    })
    .returning()

  await logAudit({
    userId: adminId,
    action: 'CREATE',
    tableName: 'users',
    recordId: user.id,
    oldValue: null,
    newValue: { email: user.email, role: user.role },
    ipAddress,
  })

  const auditLog = {
    action: 'CREATE' as const,
    tableName: 'users',
    userId: user.id,
  }

  return { ...user, auditLog }
}

export async function getAllUsers(): Promise<Array<{
  id: string
  email: string
  role: string
  isActive: boolean
  mustChangePassword: boolean
  createdAt: Date
}>> {
  return db.select({
    id: users.id,
    email: users.email,
    role: users.role,
    isActive: users.isActive,
    mustChangePassword: users.mustChangePassword,
    createdAt: users.createdAt,
  }).from(users)
}

export async function updateUser(
  userId: string,
  updates: { email?: string; role?: Role },
  adminId = 'system',
  ipAddress = '0.0.0.0'
): Promise<typeof users.$inferSelect> {
  const [old] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!old) {
    throw new Error('USER_NOT_FOUND')
  }

  const [updated] = await db
    .update(users)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning()

  await logAudit({
    userId: adminId,
    action: 'UPDATE',
    tableName: 'users',
    recordId: userId,
    oldValue: { email: old.email, role: old.role },
    newValue: { email: updated.email, role: updated.role },
    ipAddress,
  })

  return updated
}

export async function deactivateUser(
  params: { userId: string; adminId?: string; ipAddress?: string }
): Promise<{ isActive: false }> {
  const { userId, adminId = 'system', ipAddress = '0.0.0.0' } = params

  const [old] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!old) {
    throw new Error('USER_NOT_FOUND')
  }

  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, userId))
    await tx
      .delete(refreshTokens)
      .where(eq(refreshTokens.userId, userId))
  })

  await logAudit({
    userId: adminId,
    action: 'UPDATE',
    tableName: 'users',
    recordId: userId,
    oldValue: { isActive: old.isActive },
    newValue: { isActive: false },
    ipAddress,
  })

  return { isActive: false }
}
