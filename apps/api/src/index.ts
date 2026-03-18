import express from 'express'
import cookieParser from 'cookie-parser'
import { authRouter } from './modules/auth/index.js'
import { usersRouter } from './modules/users/index.js'
import { categoriesRouter } from './modules/categories/index.js'
import { productsRouter } from './modules/products/index.js'
import { inventoryRouter } from './modules/inventory/index.js'
import { posRouter } from './modules/pos/index.js'
import { shiftsRouter } from './modules/shifts/index.js'
import { createLowStockWorker } from './queues/lowstock.queue.js'

export const app = express()
const PORT = process.env.PORT ?? 3001

// Trust Nginx X-Forwarded-For header for correct req.ip in audit_logs
app.set('trust proxy', 1)

app.use(express.json())
app.use(cookieParser()) // Must be before routes

// Fail-fast: JWT_SECRET required in production
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required in production')
}

// Health endpoint — used by Docker healthcheck and smoke tests
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API versioning — all future routes registered under this prefix
const v1Router = express.Router()
app.use('/api/v1', v1Router)

// Phase 1: Auth & RBAC
v1Router.use('/auth', authRouter)
v1Router.use('/users', usersRouter)

// Phase 2: Product & Inventory
v1Router.use('/categories', categoriesRouter)
v1Router.use('/products', productsRouter)
v1Router.use('/inventory', inventoryRouter)

// Phase 3: POS & Shifts
v1Router.use('/pos', posRouter)
v1Router.use('/shifts', shiftsRouter)

// Only start listening when run directly (not during tests)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`K21 API listening on port ${PORT}`)
  })
  createLowStockWorker()
  console.log('[startup] low-stock worker started')
}
