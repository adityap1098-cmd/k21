import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mock vars are available in the hoisted vi.mock factory
const { mockDbSelect, mockDbInsert, mockDbUpdate } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}))

// Mock logAudit to avoid real DB writes
vi.mock('../../middleware/audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { createCustomer, getCustomerById, getCustomers, updateCustomer, searchCustomers } from './customers.service.js'

const CUSTOMER_ID = '11111111-1111-1111-1111-111111111111'
const USER_ID = '44444444-4444-4444-4444-444444444444'

const mockCustomer = {
  id: CUSTOMER_ID,
  name: 'John Doe',
  phone: '081234567890',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('customers service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('BKL-01: create customer', () => {
    it('creates customer and calls logAudit with CREATE', async () => {
      // Check duplicate phone — returns empty
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      })

      // Insert returns created customer
      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCustomer]),
        }),
      })

      const result = await createCustomer(
        { name: 'John Doe', phone: '081234567890' },
        USER_ID,
        '127.0.0.1'
      )

      expect(result).toMatchObject({ name: 'John Doe', phone: '081234567890' })

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          tableName: 'customers',
          recordId: CUSTOMER_ID,
        })
      )
    })
  })

  describe('BKL-01: get by id', () => {
    it('returns customer when found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCustomer]),
          }),
        }),
      })

      const result = await getCustomerById(CUSTOMER_ID)
      expect(result).toMatchObject({ id: CUSTOMER_ID, name: 'John Doe' })
    })

    it('throws CUSTOMER_NOT_FOUND when not found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(getCustomerById('nonexistent-id')).rejects.toThrow('CUSTOMER_NOT_FOUND')
    })
  })

  describe('BKL-01: list customers', () => {
    it('returns all customers', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([mockCustomer]),
      })

      const result = await getCustomers()
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ name: 'John Doe' })
    })
  })

  describe('BKL-01: update customer', () => {
    it('updates customer and calls logAudit with UPDATE', async () => {
      const updatedCustomer = { ...mockCustomer, name: 'Jane Doe' }

      // Select for old value
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCustomer]),
          }),
        }),
      })

      // Update returns updated customer
      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedCustomer]),
          }),
        }),
      })

      const result = await updateCustomer(
        { id: CUSTOMER_ID, name: 'Jane Doe' },
        USER_ID,
        '127.0.0.1'
      )

      expect(result).toMatchObject({ name: 'Jane Doe' })

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          tableName: 'customers',
          recordId: CUSTOMER_ID,
        })
      )
    })
  })

  describe('BKL-01: search by name', () => {
    it('returns customers matching name via ilike', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockCustomer]),
        }),
      })

      const result = await searchCustomers('john')
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ name: 'John Doe' })
    })
  })

  describe('BKL-01: search by phone', () => {
    it('returns customers matching phone via ilike', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockCustomer]),
        }),
      })

      const result = await searchCustomers('08123')
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ phone: '081234567890' })
    })
  })

  describe('BKL-01: duplicate phone', () => {
    it('throws DUPLICATE_PHONE when phone already exists', async () => {
      // Check duplicate phone — returns existing
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockCustomer]),
        }),
      })

      await expect(
        createCustomer(
          { name: 'Another Person', phone: '081234567890' },
          USER_ID,
          '127.0.0.1'
        )
      ).rejects.toThrow('DUPLICATE_PHONE')
    })
  })

  describe('BKL-01: update not found', () => {
    it('throws CUSTOMER_NOT_FOUND when updating nonexistent customer', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(
        updateCustomer(
          { id: 'nonexistent-id', name: 'Test' },
          USER_ID,
          '127.0.0.1'
        )
      ).rejects.toThrow('CUSTOMER_NOT_FOUND')
    })
  })
})
