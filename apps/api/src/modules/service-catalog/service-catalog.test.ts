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

import { createServiceItem, getServiceItemById, getServiceCatalog, updateServiceItem } from './service-catalog.service.js'

const ITEM_ID = '22222222-2222-2222-2222-222222222222'
const USER_ID = '44444444-4444-4444-4444-444444444444'

const mockItem = {
  id: ITEM_ID,
  name: 'Oil Change',
  description: 'Standard engine oil replacement',
  defaultPrice: 150000,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('service-catalog service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('BKL-04: create service item', () => {
    it('creates item and calls logAudit with CREATE', async () => {
      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockItem]),
        }),
      })

      const result = await createServiceItem(
        { name: 'Oil Change', defaultPrice: 150000 },
        USER_ID,
        '127.0.0.1'
      )

      expect(result).toMatchObject({ name: 'Oil Change', defaultPrice: 150000 })

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CREATE',
          tableName: 'service_catalog',
          recordId: ITEM_ID,
        })
      )
    })

    it('stores defaultPrice as integer', async () => {
      const intPriceItem = { ...mockItem, defaultPrice: 250000 }

      mockDbInsert.mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([intPriceItem]),
        }),
      })

      const result = await createServiceItem(
        { name: 'Brake Pad Replacement', defaultPrice: 250000 },
        USER_ID,
        '127.0.0.1'
      )

      expect(result.defaultPrice).toBe(250000)
      expect(Number.isInteger(result.defaultPrice)).toBe(true)
    })
  })

  describe('BKL-04: get by id', () => {
    it('returns item when found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockItem]),
          }),
        }),
      })

      const result = await getServiceItemById(ITEM_ID)
      expect(result).toMatchObject({ id: ITEM_ID, name: 'Oil Change' })
    })

    it('throws SERVICE_CATALOG_ITEM_NOT_FOUND when not found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(getServiceItemById('nonexistent-id')).rejects.toThrow('SERVICE_CATALOG_ITEM_NOT_FOUND')
    })
  })

  describe('BKL-04: list catalog', () => {
    it('returns all items', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockResolvedValue([mockItem]),
      })

      const result = await getServiceCatalog()
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ name: 'Oil Change' })
    })
  })

  describe('BKL-04: update service item', () => {
    it('updates and calls logAudit with UPDATE', async () => {
      const updatedItem = { ...mockItem, name: 'Full Synthetic Oil Change', defaultPrice: 200000 }

      // Select for old value
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockItem]),
          }),
        }),
      })

      // Update returns updated item
      mockDbUpdate.mockReturnValueOnce({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedItem]),
          }),
        }),
      })

      const result = await updateServiceItem(
        { id: ITEM_ID, name: 'Full Synthetic Oil Change', defaultPrice: 200000 },
        USER_ID,
        '127.0.0.1'
      )

      expect(result).toMatchObject({ name: 'Full Synthetic Oil Change', defaultPrice: 200000 })

      const { logAudit } = await import('../../middleware/audit.js')
      expect(logAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE',
          tableName: 'service_catalog',
          recordId: ITEM_ID,
        })
      )
    })

    it('throws SERVICE_CATALOG_ITEM_NOT_FOUND when not found', async () => {
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      })

      await expect(
        updateServiceItem(
          { id: 'nonexistent-id', name: 'Test' },
          USER_ID,
          '127.0.0.1'
        )
      ).rejects.toThrow('SERVICE_CATALOG_ITEM_NOT_FOUND')
    })
  })
})
