import { jwtVerify } from 'jose'
import type { RequestHandler } from 'express'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
)

export const authenticate: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ success: false, data: null, error: 'Missing or invalid Authorization header' })
    return
  }
  try {
    const token = authHeader.slice(7)
    const { payload } = await jwtVerify(token, JWT_SECRET)
    req.user = {
      sub: payload.sub as string,
      role: payload['role'] as string,
      mustChangePassword: payload['mustChangePassword'] as boolean,
    }
    // Enforce password change — blocks all routes except the change-password endpoint
    if (req.user.mustChangePassword && !req.originalUrl.includes('/auth/change-password')) {
      res.status(403).json({ success: false, data: null, error: 'PASSWORD_CHANGE_REQUIRED' })
      return
    }
    next()
  } catch {
    res.status(401).json({ success: false, data: null, error: 'Invalid or expired token' })
  }
}
