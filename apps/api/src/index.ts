import express from 'express'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import helmet from 'helmet'
import { authRouter } from './modules/auth/index.js'
import { usersRouter } from './modules/users/index.js'
import { categoriesRouter } from './modules/categories/index.js'
import { productsRouter } from './modules/products/index.js'
import { inventoryRouter } from './modules/inventory/index.js'
import { posRouter } from './modules/pos/index.js'
import { shiftsRouter } from './modules/shifts/index.js'
import { procurementRouter } from './modules/procurement/index.js'
import { customersRouter } from './modules/customers/index.js'
import { vehiclesRouter } from './modules/vehicles/index.js'
import { serviceCatalogRouter } from './modules/service-catalog/index.js'
import { serviceOrdersRouter } from './modules/service-orders/index.js'
import { createLowStockWorker } from './queues/lowstock.queue.js'

export const app = express()
const PORT = process.env.PORT ?? 3001

// Trust Nginx X-Forwarded-For header for correct req.ip in audit_logs
app.set('trust proxy', 1)

app.use(express.json({ limit: '1mb' }))
app.use(cookieParser()) // Must be before routes
app.use(helmet({ contentSecurityPolicy: false })) // CSP handled by Next.js
app.use(compression())

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

// Phase 4: Procurement
v1Router.use('/procurement', procurementRouter)

// Phase 5: Bengkel
v1Router.use('/customers', customersRouter)
v1Router.use('/vehicles', vehiclesRouter)
v1Router.use('/service-catalog', serviceCatalogRouter)
v1Router.use('/service-orders', serviceOrdersRouter)

// Only start listening when run directly (not during tests)
if (process.env.NODE_ENV !== 'test') {
  const server = app.listen(PORT, () => {
    console.log(`K21 API listening on port ${PORT}`)
  })
  const worker = createLowStockWorker()
  console.log('[startup] low-stock worker started')

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[shutdown] Closing server...')
    server.close()
    await worker.close()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
