import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'

// Mock DB and Redis so app starts without live connections
vi.mock('./db/index', () => ({ db: {} }))
vi.mock('./queue/connection', () => ({ redisConnection: { host: 'redis', port: 6379 } }))

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const { app } = await import('./index')
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body.status).toBe('ok')
  })
})
