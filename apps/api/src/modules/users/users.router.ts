import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { resolveError } from '../../middleware/error-handler.js'
import { createUser, getAllUsers, updateUser, deactivateUser, reactivateUser, adminResetPassword } from './users.service.js'

export const usersRouter = Router()

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['Owner', 'Finance', 'Warehouse Staff', 'Cashier', 'Admin']),
  name: z.string().max(100).optional(),
})

const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    role: z.enum(['Owner', 'Finance', 'Warehouse Staff', 'Cashier', 'Admin']).optional(),
    name: z.string().max(100).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field required',
  })

// GET /api/v1/users
usersRouter.get('/', authenticate, requireRole('Admin', 'Owner'), async (_req, res) => {
  try {
    const userList = await getAllUsers()
    res.status(200).json({ success: true, data: userList, error: null })
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[users] GET / failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})

// POST /api/v1/users
usersRouter.post('/', authenticate, requireRole('Admin', 'Owner'), async (req, res) => {
  const result = createUserSchema.safeParse(req.body)
  if (!result.success) {
    res
      .status(400)
      .json({ success: false, data: null, error: result.error.issues[0]?.message ?? 'Invalid input' })
    return
  }
  try {
    const user = await createUser(result.data, req.user!.sub, req.ip ?? '0.0.0.0')
    const { passwordHash: _ph, auditLog: _al, ...safeUser } = user
    res.status(201).json({ success: true, data: safeUser, error: null })
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[users] POST / failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})

// PATCH /api/v1/users/:id
usersRouter.patch('/:id', authenticate, requireRole('Admin', 'Owner'), async (req, res) => {
  const result = updateUserSchema.safeParse(req.body)
  if (!result.success) {
    res
      .status(400)
      .json({ success: false, data: null, error: result.error.issues[0]?.message ?? 'Invalid input' })
    return
  }
  try {
    const { isActive, ...updates } = result.data
    if (isActive === false) {
      await deactivateUser({
        userId: req.params.id!,
        adminId: req.user!.sub,
        ipAddress: req.ip ?? '0.0.0.0',
      })
      res.status(200).json({ success: true, data: { isActive: false }, error: null })
    } else if (isActive === true) {
      await reactivateUser({
        userId: req.params.id!,
        adminId: req.user!.sub,
        ipAddress: req.ip ?? '0.0.0.0',
      })
      res.status(200).json({ success: true, data: { isActive: true }, error: null })
    } else {
      const updated = await updateUser(req.params.id!, updates, req.user!.sub, req.ip ?? '0.0.0.0')
      const { passwordHash: _, ...safeUser } = updated
      res.status(200).json({ success: true, data: safeUser, error: null })
    }
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[users] PATCH /:id failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})

// POST /api/v1/users/:id/reset-password
const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
})

usersRouter.post('/:id/reset-password', authenticate, requireRole('Admin', 'Owner'), async (req, res) => {
  const result = resetPasswordSchema.safeParse(req.body)
  if (!result.success) {
    res
      .status(400)
      .json({ success: false, data: null, error: result.error.issues[0]?.message ?? 'Password minimal 8 karakter' })
    return
  }
  try {
    await adminResetPassword({
      userId: req.params.id!,
      newPassword: result.data.newPassword,
      adminId: req.user!.sub,
      ipAddress: req.ip ?? '0.0.0.0',
    })
    res.status(200).json({ success: true, data: { passwordReset: true }, error: null })
  } catch (err) {
    const { status, message } = resolveError(err)
    if (status >= 500) console.error('[users] POST /:id/reset-password failed:', err)
    res.status(status).json({ success: false, data: null, error: message })
  }
})
