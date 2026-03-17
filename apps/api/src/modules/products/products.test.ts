import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../db/index.js')
vi.mock('../../middleware/audit.js', () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }))

import { createProduct, getProduct, updateProduct, listProducts, addVariant, updateVariant } from './products.service.js'

describe('products service', () => {
  describe('PROD-01: create product', () => {
    it('creates product with name, category, ppnType, defaultPrice, defaultCostPrice')
    it('validates ppnType: rejects values outside TAXABLE | NON_TAXABLE')
    it('validates categoryId is a valid UUID')
  })
  describe('PROD-02: default variant on create', () => {
    it('createProduct always creates exactly one default variant with attributes: {}')
    it('default variant SKU is auto-generated as slug-{8-char-id}')
    it('addVariant creates additional variant with JSONB attributes record')
  })
  describe('PROD-03: PPN classification', () => {
    it('getProduct returns ppnType field')
    it('updateProduct can change ppnType')
  })
})
