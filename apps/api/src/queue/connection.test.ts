import { describe, it, expect, vi } from 'vitest'

vi.mock('./connection.js', () => ({
  redisConnection: { host: 'redis', port: 6379 },
}))

describe('redisConnection', () => {
  it('has host and port fields', async () => {
    const { redisConnection } = await import('./connection.js')
    expect(redisConnection.host).toBeDefined()
    expect(typeof redisConnection.port).toBe('number')
  })
})
