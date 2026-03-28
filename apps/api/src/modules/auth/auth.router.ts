import { Router } from 'express'
import { z } from 'zod'
import rateLimit from 'express-rate-limit'
import { login, refresh, logout } from './auth.service.js'
import { authenticate } from '../../middleware/authenticate.js'
import { resolveError } from '../../middleware/error-handler.js'
import { changePassword } from '../users/users.service.js'

export const authRouter = Router()

// Rate limiting — 10 requests per minute per IP on auth endpoints
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, data: null, error: 'Terlalu banyak percobaan, coba lagi dalam 1 menit' },
})
authRouter.use(authLimiter)

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})

// POST /api/v1/auth/login
authRouter.post('/login', async (req, res) => {
  const result = loginSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({
      success: false,
      data: null,
      error: result.error.issues[0]?.message ?? 'Invalid input',
    })
    return
  }
  try {
    const { accessToken, refreshToken } = await login(result.data)
    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/',
    })
    res.status(200).json({ success: true, data: { accessToken }, error: null })
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[auth] POST /login failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})

// POST /api/v1/auth/refresh
authRouter.post('/refresh', async (req, res) => {
  const token = req.cookies?.refresh_token as string | undefined
  if (!token) {
    res.status(401).json({ success: false, data: null, error: 'Missing refresh token' })
    return
  }
  try {
    const { accessToken } = await refresh({ token })
    res.status(200).json({ success: true, data: { accessToken }, error: null })
  } catch {
    res.status(401).json({ success: false, data: null, error: 'Invalid or expired refresh token' })
  }
})

// POST /api/v1/auth/change-password
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Password lama harus diisi'),
  newPassword: z.string().min(8, 'Password baru minimal 8 karakter'),
})

authRouter.post('/change-password', authenticate, async (req, res) => {
  const result = changePasswordSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).json({
      success: false,
      data: null,
      error: result.error.issues[0]?.message ?? 'Invalid input',
    })
    return
  }
  try {
    await changePassword(
      {
        userId: req.user!.sub,
        currentPassword: result.data.currentPassword,
        newPassword: result.data.newPassword,
      },
      req.ip ?? '0.0.0.0'
    )
    res.status(200).json({ success: true, data: { passwordChanged: true }, error: null })
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[auth] POST /change-password failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})

// POST /api/v1/auth/logout
authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.refresh_token as string | undefined
  if (token) {
    await logout({ token })
  }
  res.clearCookie('refresh_token', { path: '/' })
  res.status(200).json({ success: true, data: null, error: null })
})
