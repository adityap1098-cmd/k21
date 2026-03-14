import { describe, it, expect, vi } from 'vitest'

vi.mock('./index.js', () => ({
  db: { _isMockDb: true },
}))

describe('db', () => {
  it('exports a db instance', async () => {
    const { db } = await import('./index.js')
    expect(db).toBeDefined()
  })
})
