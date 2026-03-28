import express from 'express'
import cookieParser from 'cookie-parser'
import compression from 'compression'
import helmet from 'helmet'
import cors from 'cors'
import { authRouter } from './modules/auth/index.js'
import { usersRouter } from './modules/users/index.js'
import { categoriesRouter } from './modules/categories/index.js'
import { productsRouter } from './modules/products/index.js'
import { inventoryRouter } from './modules/inventory/index.js'
import { warehouseRouter } from './modules/warehouse/index.js'
import { posRouter } from './modules/pos/index.js'
import { shiftsRouter } from './modules/shifts/index.js'
import { payrollRouter } from './modules/payroll/index.js'
import { procurementRouter } from './modules/procurement/index.js'
import { customersRouter } from './modules/customers/index.js'
import { vehiclesRouter } from './modules/vehicles/index.js'
import { serviceCatalogRouter } from './modules/service-catalog/index.js'
import { serviceOrdersRouter } from './modules/service-orders/index.js'
import { analyticsRouter } from './modules/analytics/index.js'
import { accountingRouter } from './modules/accounting/index.js'
import { marketplaceRouter } from './modules/marketplace/index.js'
import { mechanicsRouter } from './modules/mechanics/mechanics.router.js'
import { notificationsRouter } from './modules/notifications/index.js'
import { auditLogsRouter } from './modules/audit-logs/audit-logs.router.js'
import { suppliersRouter } from './modules/suppliers/suppliers.router.js'
import { createLowStockWorker } from './queues/lowstock.queue.js'
import { createMarketplaceWorker } from './queue/marketplace.worker.js'
import { webhookRouter } from './modules/marketplace/webhook.router.js'
import { globalErrorHandler } from './middleware/error-handler.js'
import { sql } from 'drizzle-orm'

export const app = express()
const PORT = process.env.PORT ?? 3001

// Trust Nginx X-Forwarded-For header for correct req.ip in audit_logs
app.set('trust proxy', 1)

// IMPORTANT: Webhook router MUST be mounted BEFORE express.json().
// It uses express.raw() at the route level to capture the raw Buffer
// needed for HMAC-SHA256 verification. Mounting after express.json()
// would parse the body first, destroying the raw bytes.
app.use('/api/v1/webhooks', webhookRouter)

app.use(express.json({ limit: '1mb' }))
app.use(cookieParser()) // Must be before routes
// H-05: Enable Content Security Policy — restrict script/style/connect sources
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      connectSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "blob:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}))
app.use(compression())

// CORS — allow web frontend origins
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3003',
  `http://${process.env.VPS_HOST ?? '151.240.0.236'}:3003`,
  'http://151.240.0.236:3003',
]
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile, curl, server-to-server)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error('Origin not allowed by CORS'))
  },
  credentials: true,
}))

// JWT_SECRET is validated at module import time in authenticate.ts and auth.service.ts

// Health endpoint — used by Docker healthcheck and smoke tests
// H-31: Deep health check verifies DB and Redis connectivity
app.get('/health', async (_req, res) => {
  const checks: Record<string, string> = { api: 'ok' }
  let healthy = true

  // Check DB
  try {
    const { db } = await import('./db/index.js')
    await db.execute(sql`SELECT 1`)
    checks.db = 'ok'
  } catch (err) {
    checks.db = 'error'
    healthy = false
  }

  // Check Redis (via ioredis — used by BullMQ)
  try {
    const IORedis = (await import('ioredis')).default
    const redis = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
      connectTimeout: 2000,
      lazyConnect: true,
    })
    await redis.ping()
    await redis.quit()
    checks.redis = 'ok'
  } catch {
    checks.redis = 'error'
    healthy = false
  }

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    checks,
  })
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
v1Router.use('/warehouse', warehouseRouter)

// Phase 3: POS & Shifts
v1Router.use('/pos', posRouter)
v1Router.use('/shifts', shiftsRouter)

// Phase 3.5: Payroll
v1Router.use('/payroll', payrollRouter)

// Phase 4: Procurement & Suppliers
v1Router.use('/procurement', procurementRouter)
v1Router.use('/suppliers', suppliersRouter)

// Phase 5: Analytics & Dashboard
v1Router.use('/analytics', analyticsRouter)

// Phase 7: Accounting & Reports
v1Router.use('/accounting', accountingRouter)

// Phase Future: Marketplace
v1Router.use('/marketplace', marketplaceRouter)

// Phase 6: Bengkel
v1Router.use('/customers', customersRouter)
v1Router.use('/vehicles', vehiclesRouter)
v1Router.use('/service-catalog', serviceCatalogRouter)
v1Router.use('/service-orders', serviceOrdersRouter)
v1Router.use('/mechanics', mechanicsRouter)

// Notifications & Audit
v1Router.use('/notifications', notificationsRouter)
v1Router.use('/audit-logs', auditLogsRouter)

// Global error handler — catches unhandled errors from all routes
// Must be mounted AFTER all route registrations
app.use(globalErrorHandler)

// Only start listening when run directly (not during tests)
if (process.env.NODE_ENV !== 'test') {
  // H-30: Catch unhandled rejections and exceptions to prevent silent crashes
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[fatal] Unhandled rejection at:', promise, 'reason:', reason)
  })
  process.on('uncaughtException', (err) => {
    console.error('[fatal] Uncaught exception:', err)
    process.exit(1)
  })

  const server = app.listen(PORT, () => {
    console.log(`Teladan27 Motor API listening on port ${PORT}`)
  })
  const worker = createLowStockWorker()
  console.log('[startup] low-stock worker started')
  const marketplaceWorker = createMarketplaceWorker()
  console.log('[startup] marketplace worker started')

  // Graceful shutdown
  const shutdown = async () => {
    console.log('[shutdown] Closing server...')
    server.close()
    await worker.close()
    await marketplaceWorker.close()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
