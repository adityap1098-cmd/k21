import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '../../middleware/authenticate.js'
import { requireRole } from '../../middleware/require-role.js'
import { createUser, getAllUsers, updateUser, deactivateUser } from './users.service.js'

export const usersRouter = Router()

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['Owner', 'Finance', 'Warehouse Staff', 'Cashier', 'Admin']),
})

const updateUserSchema = z
  .object({
    email: z.string().email().optional(),
    role: z.enum(['Owner', 'Finance', 'Warehouse Staff', 'Cashier', 'Admin']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field required',
  })

// GET /api/v1/users
usersRouter.get('/', authenticate, requireRole('Admin'), async (_req, res) => {
  const userList = await getAllUsers()
  res.status(200).json({ success: true, data: userList, error: null })
})

// POST /api/v1/users
usersRouter.post('/', authenticate, requireRole('Admin'), async (req, res) => {
  const result = createUserSchema.safeParse(req.body)
  if (!result.success) {
    res
      .status(400)
      .json({ success: false, data: null, error: result.error.issues[0]?.message ?? 'Invalid input' })
    return
  }
  try {
    const user = await createUser(result.data, req.user!.sub, req.ip ?? '0.0.0.0')
    // Strip passwordHash and internal auditLog from response
    const { passwordHash: _ph, auditLog: _al, ...safeUser } = user
    res.status(201).json({ success: true, data: safeUser, error: null })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Create user failed'
    res.status(400).json({ success: false, data: null, error: msg })
  }
})

// PATCH /api/v1/users/:id
usersRouter.patch('/:id', authenticate, requireRole('Admin'), async (req, res) => {
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
    } else {
      const updated = await updateUser(req.params.id!, updates, req.user!.sub, req.ip ?? '0.0.0.0')
      const { passwordHash: _, ...safeUser } = updated
      res.status(200).json({ success: true, data: safeUser, error: null })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Update failed'
    const status = msg === 'USER_NOT_FOUND' ? 404 : 400
    res.status(status).json({ success: false, data: null, error: msg })
  }
})
