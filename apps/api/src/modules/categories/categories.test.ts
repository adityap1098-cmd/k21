import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mock vars are available in the hoisted vi.mock factory
const { mockDbSelect, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
  mockDbDelete: vi.fn(),
}))

vi.mock('../../db/index.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
  },
}))

// Mock logAudit to avoid real DB writes
vi.mock('../../middleware/audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { createCategory, getCategories, updateCategory, deleteCategory } from './categories.service.js'

const mockCategory = {
  id: 'cat-uuid-1',
  name: 'Electronics',
  parentId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockChildCategory = {
  id: 'cat-uuid-2',
  name: 'Laptops',
  parentId: 'cat-uuid-1',
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('categories service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createCategory', () => {
    it('creates a root category with name', async () => {
      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockCategory]),
        }),
      })

      const result = await createCategory({ name: 'Electronics' }, 'admin-id', '127.0.0.1')

      expect(result).toMatchObject({ name: 'Electronics', parentId: null })
    })

    it('creates a child category with valid parentId', async () => {
      // First select: find parent, which has parentId null
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCategory]), // parent has parentId: null
          }),
        }),
      })

      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockChildCategory]),
        }),
      })

      const result = await createCategory({ name: 'Laptops', parentId: 'cat-uuid-1' }, 'admin-id', '127.0.0.1')

      expect(result).toMatchObject({ name: 'Laptops', parentId: 'cat-uuid-1' })
    })

    it('rejects a grandchild (parent already has a parent) — max one level enforced', async () => {
      // Parent itself has a parentId (it's a child category)
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockChildCategory]), // has parentId set
          }),
        }),
      })

      await expect(
        createCategory({ name: 'Sub-Laptops', parentId: 'cat-uuid-2' }, 'admin-id', '127.0.0.1')
      ).rejects.toThrow('GRANDCHILD_NOT_ALLOWED')
    })
  })

  describe('getCategories', () => {
    it('returns flat list with parentId populated', async () => {
      mockDbSelect.mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue([mockCategory, mockChildCategory]),
        }),
      })

      const result = await getCategories()

      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({ name: 'Electronics', parentId: null })
      expect(result[1]).toMatchObject({ name: 'Laptops', parentId: 'cat-uuid-1' })
    })
  })

  describe('updateCategory', () => {
    it('updates category name and logs audit UPDATE', async () => {
      const updatedCategory = { ...mockCategory, name: 'Consumer Electronics' }

      // First select for old value
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockCategory]),
          }),
        }),
      })

      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedCategory]),
          }),
        }),
      })

      const { logAudit } = await import('../../middleware/audit.js')
      const result = await updateCategory({ id: 'cat-uuid-1', name: 'Consumer Electronics' }, 'admin-id', '127.0.0.1')

      expect(result).toMatchObject({ name: 'Consumer Electronics' })
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', tableName: 'categories' }))
    })
  })

  describe('deleteCategory', () => {
    it('rejects delete if category has products assigned', async () => {
      // Select returns count > 0
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: '1' }]),
        }),
      })

      await expect(
        deleteCategory('cat-uuid-1', 'admin-id', '127.0.0.1')
      ).rejects.toThrow('CATEGORY_HAS_PRODUCTS')
    })

    it('deletes category when no products are assigned', async () => {
      // Select returns count = 0
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: '0' }]),
        }),
      })

      mockDbDelete.mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      })

      const { logAudit } = await import('../../middleware/audit.js')
      await deleteCategory('cat-uuid-1', 'admin-id', '127.0.0.1')

      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'DELETE', tableName: 'categories' }))
    })
  })
})
