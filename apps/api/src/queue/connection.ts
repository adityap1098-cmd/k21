import type { ConnectionOptions } from 'bullmq'

// H-29: Consolidate Redis config to use REDIS_URL (same as queues/redis.ts)
// Falls back to REDIS_HOST/REDIS_PORT for backward compat, then defaults
const redisUrl = process.env.REDIS_URL

function getRedisConfig(): { host: string; port: number; password?: string } {
  if (redisUrl) {
    try {
      const parsed = new URL(redisUrl)
      return {
        host: parsed.hostname || 'localhost',
        port: parsed.port ? Number(parsed.port) : 6379,
        password: parsed.password || undefined,
      }
    } catch {
      // fall through to host/port
    }
  }
  return {
    host: process.env.REDIS_HOST ?? 'redis',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD || undefined,
  }
}

const { host, port, password } = getRedisConfig()

export const redisConnection: ConnectionOptions = {
  host,
  port,
  password,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
}
