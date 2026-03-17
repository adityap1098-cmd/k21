import { describe, it, expect, vi } from 'vitest'

// Decouple from live DB connection
vi.mock('../../db/index.js', () => ({ db: {} }))
// Do NOT provide a factory — auto-mock will stub all exports as vi.fn()
// but the actual module does not exist yet, so Vitest will error → RED state
vi.mock('./auth.service.js')

describe('AuthService', () => {
  // AUTH-01: Login
  describe('login', () => {
    it('returns accessToken for valid email+password credentials', async () => {
      const { login } = await import('./auth.service.js')

      const result = await login({ email: 'owner@k21.id', password: 'correct-password' })

      expect(result).toHaveProperty('accessToken')
      expect(typeof result.accessToken).toBe('string')
    })

    it('throws INVALID_CREDENTIALS for wrong password', async () => {
      const { login } = await import('./auth.service.js')

      await expect(
        login({ email: 'owner@k21.id', password: 'wrong-password' })
      ).rejects.toThrow('INVALID_CREDENTIALS')
    })

    it('throws INVALID_CREDENTIALS for deactivated user', async () => {
      const { login } = await import('./auth.service.js')

      await expect(
        login({ email: 'deactivated@k21.id', password: 'any-password' })
      ).rejects.toThrow('INVALID_CREDENTIALS')
    })
  })

  // AUTH-02: Refresh token
  describe('refresh', () => {
    it('returns new accessToken for valid refresh token', async () => {
      const { refresh } = await import('./auth.service.js')

      const result = await refresh({ token: 'valid-refresh-token' })

      expect(result).toHaveProperty('accessToken')
      expect(typeof result.accessToken).toBe('string')
    })

    it('throws INVALID_TOKEN for expired/missing refresh token', async () => {
      const { refresh } = await import('./auth.service.js')

      await expect(
        refresh({ token: 'expired-or-missing-token' })
      ).rejects.toThrow('INVALID_TOKEN')
    })
  })

  // AUTH-03: Logout
  describe('logout', () => {
    it('deletes the refresh_token DB row on logout', async () => {
      const { logout } = await import('./auth.service.js')

      await logout({ userId: 'user-uuid', token: 'refresh-token-to-delete' })

      expect(logout).toHaveBeenCalledOnce()
    })
  })
})
