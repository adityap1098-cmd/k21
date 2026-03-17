import { SignJWT } from 'jose'
import argon2 from 'argon2'
import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users, refreshTokens } from '../../db/schema/index.js'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
)

async function signAccessToken(
  userId: string,
  role: string,
  mustChangePassword: boolean
): Promise<string> {
  return new SignJWT({ role, mustChangePassword })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(JWT_SECRET)
}

export async function login(params: {
  email: string
  password: string
}): Promise<{ accessToken: string; refreshToken: string }> {
  const { email, password } = params

  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  const user = rows[0]

  if (!user || user.isActive === false) {
    throw new Error('INVALID_CREDENTIALS')
  }

  const valid = await argon2.verify(user.passwordHash, password)
  if (!valid) {
    throw new Error('INVALID_CREDENTIALS')
  }

  const accessToken = await signAccessToken(
    user.id,
    user.role,
    user.mustChangePassword
  )

  const refreshToken = randomUUID()

  await db.insert(refreshTokens).values({
    id: randomUUID(),
    userId: user.id,
    token: refreshToken,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  })

  return { accessToken, refreshToken }
}

export async function refresh(params: {
  token: string
}): Promise<{ accessToken: string }> {
  const { token } = params

  const rows = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, token))
    .limit(1)

  const row = rows[0]

  if (!row) {
    throw new Error('INVALID_TOKEN')
  }

  if (row.expiresAt < new Date()) {
    throw new Error('INVALID_TOKEN')
  }

  const userRows = await db
    .select()
    .from(users)
    .where(eq(users.id, row.userId))
    .limit(1)

  const user = userRows[0]

  if (!user || user.isActive === false) {
    throw new Error('INVALID_TOKEN')
  }

  const accessToken = await signAccessToken(
    user.id,
    user.role,
    user.mustChangePassword
  )

  return { accessToken }
}

export async function logout(params: {
  userId?: string
  token: string
}): Promise<void> {
  const { token } = params
  await db.delete(refreshTokens).where(eq(refreshTokens.token, token))
}
