import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { SignJWT } from 'jose'

// Decouple from live DB connection
vi.mock('../db/index.js', () => ({ db: {} }))

const JWT_SECRET_RAW = 'dev-secret-change-in-production'
const JWT_SECRET = new TextEncoder().encode(JWT_SECRET_RAW)

async function makeJwt(payload: Record<string, unknown>, expired = false) {
  const jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub as string)
    .setIssuedAt()

  if (expired) {
    jwt.setExpirationTime('1s')
    // Build with past iat/exp by manipulating
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(payload.sub as string)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 1800)
      .sign(JWT_SECRET)
    return token
  }

  return jwt.setExpirationTime('1h').sign(JWT_SECRET)
}

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
    process.env.JWT_SECRET = JWT_SECRET_RAW
  })

  // AUTH-05: No bearer token → 401
  it('does NOT call next and responds 401 when no Bearer token is present', async () => {
    const { authenticate } = await import('./authenticate.js')

    const req = makeReq({ headers: {} })
    const res = makeRes()

    await authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })

  // AUTH-05: Valid token → req.user set, next() called
  it('sets req.user and calls next() when a valid Bearer token is provided', async () => {
    const { authenticate } = await import('./authenticate.js')

    const token = await makeJwt({ sub: 'user-uuid', role: 'Owner', mustChangePassword: false })
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    const res = makeRes()

    await authenticate(req, res, next)

    expect((req as any).user).toBeDefined()
    expect((req as any).user.sub).toBe('user-uuid')
    expect((req as any).user.role).toBe('Owner')
    expect(next).toHaveBeenCalledOnce()
  })

  // AUTH-05: mustChangePassword=true on non-change-password path → 403
  it('responds 403 with PASSWORD_CHANGE_REQUIRED when mustChangePassword=true and path is not /change-password', async () => {
    const { authenticate } = await import('./authenticate.js')

    const token = await makeJwt({ sub: 'user-uuid', role: 'Cashier', mustChangePassword: true })
    const req = makeReq({
      headers: { authorization: `Bearer ${token}` },
      path: '/api/v1/products',
    })
    const res = makeRes()

    await authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'PASSWORD_CHANGE_REQUIRED' })
    )
    expect(next).not.toHaveBeenCalled()
  })

  // AUTH-05: mustChangePassword=true, path IS /auth/change-password → next() called
  it('calls next() when mustChangePassword=true and path is /auth/change-password', async () => {
    const { authenticate } = await import('./authenticate.js')

    const token = await makeJwt({ sub: 'user-uuid', role: 'Cashier', mustChangePassword: true })
    const req = makeReq({
      headers: { authorization: `Bearer ${token}` },
      path: '/auth/change-password',
    })
    const res = makeRes()

    await authenticate(req, res, next)

    expect(next).toHaveBeenCalledOnce()
    expect(res.status).not.toHaveBeenCalled()
  })

  // AUTH-05: Expired JWT → 401
  it('responds 401 when the JWT is expired', async () => {
    const { authenticate } = await import('./authenticate.js')

    const token = await makeJwt({ sub: 'user-uuid', role: 'Owner', mustChangePassword: false }, true)
    const req = makeReq({ headers: { authorization: `Bearer ${token}` } })
    const res = makeRes()

    await authenticate(req, res, next)

    expect(res.status).toHaveBeenCalledWith(401)
    expect(next).not.toHaveBeenCalled()
  })
})
