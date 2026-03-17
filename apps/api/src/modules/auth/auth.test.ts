import { describe, it, expect, vi, beforeEach } from 'vitest'
import argon2 from 'argon2'

// Decouple from live DB connection — provide mock db with chainable query builder
const mockDbSelect = vi.fn()
const mockDbInsert = vi.fn()
const mockDbDelete = vi.fn()

vi.mock('../../db/index.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    delete: mockDbDelete,
  },
}))

// Mock argon2 to control password verification
vi.mock('argon2')

describe('AuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // AUTH-01: Login
  describe('login', () => {
    it('returns accessToken for valid email+password credentials', async () => {
      const { login } = await import('./auth.service.js')

      const mockUser = {
        id: 'user-uuid',
        email: 'owner@k21.id',
        passwordHash: 'hashed-password',
        role: 'Owner',
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Mock DB select for users query
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      })

      // Mock DB insert for refreshTokens
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue([]),
      })

      // Mock argon2.verify to return true
      vi.mocked(argon2.verify).mockResolvedValue(true)

      const result = await login({ email: 'owner@k21.id', password: 'correct-password' })

      expect(result).toHaveProperty('accessToken')
      expect(typeof result.accessToken).toBe('string')
    })

    it('throws INVALID_CREDENTIALS for wrong password', async () => {
      const { login } = await import('./auth.service.js')

      const mockUser = {
        id: 'user-uuid',
        email: 'owner@k21.id',
        passwordHash: 'hashed-password',
        role: 'Owner',
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      })

      // Mock argon2.verify to return false (wrong password)
      vi.mocked(argon2.verify).mockResolvedValue(false)

      await expect(
        login({ email: 'owner@k21.id', password: 'wrong-password' })
      ).rejects.toThrow('INVALID_CREDENTIALS')
    })

    it('throws INVALID_CREDENTIALS for deactivated user', async () => {
      const { login } = await import('./auth.service.js')

      const mockUser = {
        id: 'user-uuid',
        email: 'deactivated@k21.id',
        passwordHash: 'hashed-password',
        role: 'Owner',
        isActive: false,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      })

      await expect(
        login({ email: 'deactivated@k21.id', password: 'any-password' })
      ).rejects.toThrow('INVALID_CREDENTIALS')
    })
  })

  // AUTH-02: Refresh token
  describe('refresh', () => {
    it('returns new accessToken for valid refresh token', async () => {
      const { refresh } = await import('./auth.service.js')

      const mockTokenRow = {
        id: 'token-uuid',
        userId: 'user-uuid',
        token: 'valid-refresh-token',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // tomorrow
        createdAt: new Date(),
      }

      const mockUser = {
        id: 'user-uuid',
        email: 'owner@k21.id',
        passwordHash: 'hashed-password',
        role: 'Owner',
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // First call for refreshTokens, second for users
      mockDbSelect
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockTokenRow]),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([mockUser]),
            }),
          }),
        })

      const result = await refresh({ token: 'valid-refresh-token' })

      expect(result).toHaveProperty('accessToken')
      expect(typeof result.accessToken).toBe('string')
    })

    it('throws INVALID_TOKEN for expired/missing refresh token', async () => {
      const { refresh } = await import('./auth.service.js')

      // No token found in DB
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(
        refresh({ token: 'expired-or-missing-token' })
      ).rejects.toThrow('INVALID_TOKEN')
    })
  })

  // AUTH-03: Logout
  describe('logout', () => {
    it('deletes the refresh_token DB row on logout', async () => {
      const { logout } = await import('./auth.service.js')

      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      })

      await logout({ userId: 'user-uuid', token: 'refresh-token-to-delete' })

      expect(mockDbDelete).toHaveBeenCalledOnce()
    })
  })
})
