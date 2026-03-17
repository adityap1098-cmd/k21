import type { ConnectionOptions } from 'bullmq'

const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379'

// Parse REDIS_URL into host/port/password for ioredis ConnectionOptions
function parseRedisUrl(url: string): { host: string; port: number; password?: string } {
  try {
    const parsed = new URL(url)
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? Number(parsed.port) : 6379,
      password: parsed.password || undefined,
    }
  } catch {
    return { host: 'localhost', port: 6379 }
  }
}

const { host, port, password } = parseRedisUrl(redisUrl)

// BullMQ connection — requires maxRetriesPerRequest: null and enableReadyCheck: false
// BullMQ holds a subscriber-mode connection; sharing with cache causes protocol errors
export const bullmqRedis: ConnectionOptions = {
  host,
  port,
  password,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
}

// Cache connection — general purpose ioredis options for stock cache reads/writes
export const cacheRedis: ConnectionOptions = {
  host,
  port,
  password,
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
}
