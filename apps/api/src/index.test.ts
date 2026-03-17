import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

// Mock DB and Redis so app starts without live connections
vi.mock('./db/index.js', () => ({ db: {} }))
vi.mock('./queue/connection.js', () => ({ redisConnection: { host: 'redis', port: 6379 } }))

// Mock auth service to prevent DB connections during route resolution
vi.mock('./modules/auth/auth.service.js', () => ({
  login: vi.fn(),
  refresh: vi.fn(),
  logout: vi.fn(),
}))

// Mock DB schema to prevent import-time DB connection attempts
vi.mock('./db/schema/index.js', () => ({
  users: {},
  refreshTokens: {},
  auditLogs: {},
  roleEnum: { enumValues: ['Owner', 'Finance', 'Warehouse Staff', 'Cashier', 'Admin'] },
  actionEnum: { enumValues: ['CREATE', 'UPDATE', 'DELETE'] },
}))

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const { app } = await import('./index.js')
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})

describe('AUTH-07: /api/v1/ prefix', () => {
  it('POST /api/v1/auth/login with no body returns 400 (route exists)', async () => {
    const { app } = await import('./index.js')
    const res = await request(app).post('/api/v1/auth/login').send({})
    expect(res.status).toBe(400)
  })

  it('GET /api/v1/users without token returns 401 (route exists and is protected)', async () => {
    const { app } = await import('./index.js')
    const res = await request(app).get('/api/v1/users')
    expect(res.status).toBe(401)
  })
})
