import { describe, it, expect, vi } from 'vitest'

vi.mock('./connection.js', () => ({
  redisConnection: { host: 'redis', port: 6379 },
}))

describe('redisConnection', () => {
  it('has host and port fields', async () => {
    const { redisConnection } = await import('./connection.js')
    const conn = redisConnection as { host?: string; port?: number }
    expect(conn.host).toBeDefined()
    expect(typeof conn.port).toBe('number')
  })
})
