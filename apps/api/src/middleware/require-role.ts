import type { RequestHandler } from 'express'

export type Role = 'Owner' | 'Finance' | 'Warehouse Staff' | 'Cashier' | 'Admin'

export const requireRole = (...roles: Role[]): RequestHandler => (req, res, next) => {
  if (!req.user) {
    res.status(401).json({ success: false, data: null, error: 'Unauthenticated' })
    return
  }
  if (!roles.includes(req.user.role as Role)) {
    res.status(403).json({ success: false, data: null, error: 'Forbidden: insufficient role' })
    return
  }
  next()
}
