import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { Router } from 'express'

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

// Phase 2 module mocks — mini routers that reject unauthenticated requests (401)
vi.mock('./modules/categories/index.js', () => {
  const r = Router()
  r.use((_req, res) => res.status(401).json({ success: false, data: null, error: 'Missing or invalid Authorization header' }))
  return { categoriesRouter: r }
})
vi.mock('./modules/products/index.js', () => {
  const r = Router()
  r.use((_req, res) => res.status(401).json({ success: false, data: null, error: 'Missing or invalid Authorization header' }))
  return { productsRouter: r }
})
vi.mock('./modules/inventory/index.js', () => {
  const r = Router()
  r.use((_req, res) => res.status(401).json({ success: false, data: null, error: 'Missing or invalid Authorization header' }))
  return { inventoryRouter: r }
})
vi.mock('./modules/pos/index.js', () => {
  const r = Router()
  r.use((_req, res) => res.status(401).json({ success: false, data: null, error: 'Missing or invalid Authorization header' }))
  return { posRouter: r }
})
vi.mock('./modules/shifts/index.js', () => {
  const r = Router()
  r.use((_req, res) => res.status(401).json({ success: false, data: null, error: 'Missing or invalid Authorization header' }))
  return { shiftsRouter: r }
})
vi.mock('./modules/procurement/index.js', () => {
  const r = Router()
  r.use((_req, res) => res.status(401).json({ success: false, data: null, error: 'Missing or invalid Authorization header' }))
  return { procurementRouter: r }
})
// Phase 5: Bengkel module mocks
vi.mock('./modules/customers/index.js', () => {
  const r = Router()
  r.use((_req, res) => res.status(401).json({ success: false, data: null, error: 'Missing or invalid Authorization header' }))
  return { customersRouter: r }
})
vi.mock('./modules/vehicles/index.js', () => {
  const r = Router()
  r.use((_req, res) => res.status(401).json({ success: false, data: null, error: 'Missing or invalid Authorization header' }))
  return { vehiclesRouter: r }
})
vi.mock('./modules/service-catalog/index.js', () => {
  const r = Router()
  r.use((_req, res) => res.status(401).json({ success: false, data: null, error: 'Missing or invalid Authorization header' }))
  return { serviceCatalogRouter: r }
})
vi.mock('./modules/service-orders/index.js', () => {
  const r = Router()
  r.use((_req, res) => res.status(401).json({ success: false, data: null, error: 'Missing or invalid Authorization header' }))
  return { serviceOrdersRouter: r }
})
vi.mock('./queues/lowstock.queue.js', () => ({ createLowStockWorker: vi.fn() }))

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

describe('Phase 2: Product & Inventory routes', () => {
  it('GET /api/v1/categories returns 401 without auth', async () => {
    const { app } = await import('./index.js')
    const res = await request(app).get('/api/v1/categories')
    expect(res.status).toBe(401)
  })
  it('GET /api/v1/products returns 401 without auth', async () => {
    const { app } = await import('./index.js')
    const res = await request(app).get('/api/v1/products')
    expect(res.status).toBe(401)
  })
  it('GET /api/v1/inventory/stock/some-id returns 401 without auth', async () => {
    const { app } = await import('./index.js')
    const res = await request(app).get('/api/v1/inventory/stock/00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(401)
  })
})

describe('Phase 5: Bengkel routes', () => {
  it('GET /api/v1/customers returns 401 without auth', async () => {
    const { app } = await import('./index.js')
    const res = await request(app).get('/api/v1/customers')
    expect(res.status).toBe(401)
  })
  it('GET /api/v1/vehicles returns 401 without auth', async () => {
    const { app } = await import('./index.js')
    const res = await request(app).get('/api/v1/vehicles')
    expect(res.status).toBe(401)
  })
  it('GET /api/v1/service-catalog returns 401 without auth', async () => {
    const { app } = await import('./index.js')
    const res = await request(app).get('/api/v1/service-catalog')
    expect(res.status).toBe(401)
  })
  it('GET /api/v1/service-orders returns 401 without auth', async () => {
    const { app } = await import('./index.js')
    const res = await request(app).get('/api/v1/service-orders')
    expect(res.status).toBe(401)
  })
})
