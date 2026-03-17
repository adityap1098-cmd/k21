import { describe, it, expect, vi, beforeEach } from 'vitest'

// Decouple from live DB connection — provide mock db with chainable query builder
const mockDbSelect = vi.fn()
const mockDbInsert = vi.fn()
const mockDbUpdate = vi.fn()
const mockDbDelete = vi.fn()
const mockTx = {
  update: vi.fn(),
  delete: vi.fn(),
}

vi.mock('../../db/index.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  },
}))

// Mock argon2 to control password hashing
vi.mock('argon2')

// Mock logAudit to avoid real DB writes
vi.mock('../../middleware/audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

describe('UsersService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset transaction mock
    mockTx.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    })
    mockTx.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    })
  })

  // AUTH-06: Deactivate user
  describe('deactivateUser', () => {
    it('sets isActive=false AND deletes all refresh_tokens for that user in one transaction', async () => {
      const { deactivateUser } = await import('./users.service.js')

      const mockUser = {
        id: 'user-uuid',
        email: 'staff@k21.id',
        passwordHash: 'hashed',
        role: 'Cashier',
        isActive: true,
        mustChangePassword: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Select for finding old user
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockUser]),
          }),
        }),
      })

      const result = await deactivateUser({ userId: 'user-uuid' })

      expect(result).toMatchObject({ isActive: false })
    })
  })

  // AUTH-08: Audit log on createUser
  describe('createUser', () => {
    it('writes an audit_log row with action=CREATE, tableName=users, and correct userId', async () => {
      const { createUser } = await import('./users.service.js')
      const argon2 = await import('argon2')

      vi.mocked(argon2.hash).mockResolvedValue('hashed-password' as never)

      const createdUser = {
        id: 'new-user-uuid',
        email: 'staff@k21.id',
        passwordHash: 'hashed-password',
        role: 'Cashier',
        isActive: true,
        mustChangePassword: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([createdUser]),
        }),
      })

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
