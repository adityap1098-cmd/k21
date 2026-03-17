import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'

// Decouple from live DB connection
vi.mock('../db/index.js', () => ({ db: {} }))
// Actual module does not exist yet → RED state
vi.mock('./authenticate.js')

function makeRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response
  return res
}

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    headers: {},
    path: '/api/v1/some-resource',
    ...overrides,
  } as unknown as Request
}

describe('authenticate middleware', () => {
  let next: NextFunction

  beforeEach(() => {
    next = vi.fn()
  })

  // AUTH-05: No bearer token → 401
  it('does NOT call next and responds 401 when no Bearer token is present', async () => {
    const { authenticate } = await import('./authenticate.js')

    const req = makeReq({ headers: {} })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  // AUTH-05: Valid token → req.user set, next() called
  it('sets req.user and calls next() when a valid Bearer token is provided', async () => {
    const { authenticate } = await import('./authenticate.js')

    const req = makeReq({ headers: { authorization: 'Bearer valid.jwt.token' } })
    const res = makeRes()

    authenticate(req, res, next)

    expect((req as any).user).toBeDefined()
    expect(next).toHaveBeenCalledOnce()
  })

  // AUTH-05: mustChangePassword=true on non-change-password path → 403
  it('responds 403 with PASSWORD_CHANGE_REQUIRED when mustChangePassword=true and path is not /change-password', async () => {
    const { authenticate } = await import('./authenticate.js')

    const req = makeReq({
      headers: { authorization: 'Bearer must-change.jwt.token' },
      path: '/api/v1/products',
    })
    const res = makeRes()

    authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'PASSWORD_CHANGE_REQUIRED' })
    )
    expect(next).not.toHaveBeenCalled()
  })
})
