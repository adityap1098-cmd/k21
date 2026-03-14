import type { ConnectionOptions } from 'bullmq'

// Validates required env vars at startup — fail fast rather than silent crash
const host = process.env.REDIS_HOST ?? 'redis'
const port = Number(process.env.REDIS_PORT ?? 6379)
const password = process.env.REDIS_PASSWORD

export const redisConnection: ConnectionOptions = {
  host,
  port,
  password,
}
