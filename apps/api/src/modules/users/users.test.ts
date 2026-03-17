import { describe, it, expect, vi } from 'vitest'

// Decouple from live DB connection
vi.mock('../../db/index.js', () => ({ db: {} }))
// Do NOT provide a factory — actual module does not exist yet → RED state
vi.mock('./users.service.js')

describe('UsersService', () => {
  // AUTH-06: Deactivate user
  describe('deactivateUser', () => {
    it('sets isActive=false AND deletes all refresh_tokens for that user in one transaction', async () => {
      const { deactivateUser } = await import('./users.service.js')

      const result = await deactivateUser({ userId: 'user-uuid' })

      expect(deactivateUser).toHaveBeenCalledOnce()
      expect(result).toMatchObject({ isActive: false })
    })
  })

  // AUTH-08: Audit log on createUser
  describe('createUser', () => {
    it('writes an audit_log row with action=CREATE, tableName=users, and correct userId', async () => {
      const { createUser } = await import('./users.service.js')

      const result = await createUser({
        email: 'staff@k21.id',
        password: 'secure-password',
        role: 'Cashier',
      })

      expect(result).toHaveProperty('auditLog')
      expect(result.auditLog).toMatchObject({
        action: 'CREATE',
        tableName: 'users',
        userId: result.id,
      })
    })
  })
})
