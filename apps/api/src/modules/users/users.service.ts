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
  params: { email: string; password: string; role: Role; name?: string },
  adminId = 'system',
  ipAddress = '0.0.0.0'
): Promise<typeof users.$inferSelect & { auditLog: { action: string; tableName: string; userId: string } }> {
  const { email, password, role, name } = params

  if (password.length < 8) {
    throw new Error('PASSWORD_TOO_SHORT')
  }

  const passwordHash = await argon2.hash(password, { type: argon2.argon2id })

  const [user] = await db
    .insert(users)
    .values({
      id: randomUUID(),
      name: name || null,
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
  name: string | null
  email: string
  role: string
  isActive: boolean
  mustChangePassword: boolean
  createdAt: Date
}>> {
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    isActive: users.isActive,
    mustChangePassword: users.mustChangePassword,
    createdAt: users.createdAt,
  }).from(users)
}

export async function updateUser(
  userId: string,
  updates: { email?: string; role?: Role; name?: string },
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

export async function changePassword(
  params: { userId: string; currentPassword: string; newPassword: string },
  ipAddress = '0.0.0.0'
): Promise<void> {
  const { userId, currentPassword, newPassword } = params

  if (newPassword.length < 8) {
    throw new Error('PASSWORD_TOO_SHORT')
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    throw new Error('USER_NOT_FOUND')
  }

  // Verify current password
  const valid = await argon2.verify(user.passwordHash, currentPassword)
  if (!valid) {
    throw new Error('INVALID_CURRENT_PASSWORD')
  }

  // Prevent reusing the same password
  if (currentPassword === newPassword) {
    throw new Error('PASSWORD_MUST_DIFFER')
  }

  const newHash = await argon2.hash(newPassword, { type: argon2.argon2id })

  await db
    .update(users)
    .set({
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, userId))

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'users',
    recordId: userId,
    oldValue: { mustChangePassword: user.mustChangePassword },
    newValue: { mustChangePassword: false, passwordChanged: true },
    ipAddress,
  })
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

export async function reactivateUser(
  params: { userId: string; adminId?: string; ipAddress?: string }
): Promise<{ isActive: true }> {
  const { userId, adminId = 'system', ipAddress = '0.0.0.0' } = params

  const [old] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!old) throw new Error('USER_NOT_FOUND')

  await db
    .update(users)
    .set({ isActive: true, updatedAt: new Date() })
    .where(eq(users.id, userId))

  await logAudit({
    userId: adminId,
    action: 'UPDATE',
    tableName: 'users',
    recordId: userId,
    oldValue: { isActive: false },
    newValue: { isActive: true },
    ipAddress,
  })

  return { isActive: true }
}

export async function adminResetPassword(
  params: { userId: string; newPassword: string; adminId?: string; ipAddress?: string }
): Promise<void> {
  const { userId, newPassword, adminId = 'system', ipAddress = '0.0.0.0' } = params

  if (newPassword.length < 8) throw new Error('PASSWORD_TOO_SHORT')

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new Error('USER_NOT_FOUND')

  const newHash = await argon2.hash(newPassword, { type: argon2.argon2id })

  await db
    .update(users)
    .set({ passwordHash: newHash, mustChangePassword: true, updatedAt: new Date() })
    .where(eq(users.id, userId))

  // Revoke all refresh tokens so user must re-login
  await db.delete(refreshTokens).where(eq(refreshTokens.userId, userId))

  await logAudit({
    userId: adminId,
    action: 'UPDATE',
    tableName: 'users',
    recordId: userId,
    oldValue: { passwordReset: false },
    newValue: { passwordReset: true, mustChangePassword: true },
    ipAddress,
  })
}
