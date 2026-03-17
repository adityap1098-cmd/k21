import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db/index.js')
vi.mock('../../middleware/audit.js', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }))

// Import from not-yet-created file — RED state
import { createCategory, getCategories, updateCategory, deleteCategory } from './categories.service.js'

describe('categories service', () => {
  describe('createCategory', () => {
    it('creates a root category with name')
    it('creates a child category with valid parentId')
    it('rejects a grandchild (parent already has a parent) — max one level enforced')
  })
  describe('getCategories', () => {
    it('returns flat list with parentId populated')
  })
  describe('deleteCategory', () => {
    it('rejects delete if category has products assigned')
  })
})
