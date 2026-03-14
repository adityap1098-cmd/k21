import express from 'express'

export const app = express()
const PORT = process.env.PORT ?? 3001

app.use(express.json())

// Health endpoint — used by Docker healthcheck and smoke tests
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// API versioning — all future routes registered under this prefix
const v1Router = express.Router()
app.use('/api/v1', v1Router)
// Phase 0: no routes yet. v1Router catches /api/v1/* and returns 404 by default.

// Only start listening when run directly (not during tests)
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`K21 API listening on port ${PORT}`)
  })
}
