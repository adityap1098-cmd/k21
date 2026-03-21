import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

function makeReq(overrides: Partial<Request & { user?: unknown }> = {}): Request & { user?: unknown } {
  return {
    headers: {},
    path: '/api/v1/some-resource',
    ...overrides,
  } as unknown as Request & { user?: unknown }
}

describe('requireRole middleware', () => {
  let next: NextFunction

  beforeEach(() => {
    next = vi.fn() as unknown as NextFunction
  })

  // AUTH-05: correct role → next() called
  it('calls next() when the authenticated user has the required role', async () => {
    const { requireRole } = await import('./require-role.js')

    const req = makeReq({ user: { sub: 'user-uuid', role: 'Owner', mustChangePassword: false } })
    const res = makeRes()
    const middleware = requireRole('Owner')

    middleware(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  // AUTH-05: wrong role → 403
  it('responds 403 when the authenticated user does not have the required role', async () => {
    const { requireRole } = await import('./require-role.js')

    const req = makeReq({ user: { sub: 'user-uuid', role: 'Cashier', mustChangePassword: false } })
    const res = makeRes()
    const middleware = requireRole('Owner')

    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(next).not.toHaveBeenCalled()
  })

  // AUTH-05: no req.user → 401
  it('responds 401 when there is no req.user (unauthenticated request)', async () => {
    const { requireRole } = await import('./require-role.js')

    const req = makeReq({ user: undefined })
    const res = makeRes()
    const middleware = requireRole('Owner')

    middleware(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  // AUTH-05: multiple allowed roles → next() called when role matches one
  it('calls next() when the user role matches one of multiple allowed roles', async () => {
    const { requireRole } = await import('./require-role.js')

    const req = makeReq({ user: { sub: 'user-uuid', role: 'Finance', mustChangePassword: false } })
    const res = makeRes()
    const middleware = requireRole('Owner', 'Finance')

    middleware(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })
})
