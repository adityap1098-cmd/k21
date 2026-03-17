import { Router } from 'express'
import { z } from 'zod'
import { login, refresh, logout } from './auth.service.js'

export const authRouter = Router()

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
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: '/api/v1/auth/refresh',
    })
    res.status(200).json({ success: true, data: { accessToken }, error: null })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Login failed'
    if (message === 'INVALID_CREDENTIALS') {
      res.status(401).json({ success: false, data: null, error: 'Invalid email or password' })
    } else {
      res.status(500).json({ success: false, data: null, error: 'Internal server error' })
    }
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

// POST /api/v1/auth/logout
authRouter.post('/logout', async (req, res) => {
  const token = req.cookies?.refresh_token as string | undefined
  if (token) {
    await logout({ token })
  }
  res.clearCookie('refresh_token', { path: '/api/v1/auth/refresh' })
  res.status(200).json({ success: true, data: null, error: null })
})
