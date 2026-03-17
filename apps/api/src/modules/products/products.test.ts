import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mock vars are available in the hoisted vi.mock factory
const { mockDbSelect, mockDbInsert, mockDbUpdate, mockDbDelete, mockTx } = vi.hoisted(() => {
  const mockTx = {
    insert: vi.fn(),
  }
  return {
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbDelete: vi.fn(),
    mockTx,
  }
})

vi.mock('../../db/index.js', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
    update: mockDbUpdate,
    delete: mockDbDelete,
    transaction: vi.fn((fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx)),
  },
}))

// Mock logAudit to avoid real DB writes
vi.mock('../../middleware/audit.js', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}))

import { createProduct, getProduct, updateProduct, listProducts, addVariant, updateVariant } from './products.service.js'

const PROD_ID = '11111111-1111-1111-1111-111111111111'
const CAT_ID = '22222222-2222-2222-2222-222222222222'
const VAR_ID = '33333333-3333-3333-3333-333333333333'
const USER_ID = '44444444-4444-4444-4444-444444444444'

const mockProduct = {
  id: PROD_ID,
  name: 'Laptop Pro',
  description: 'A great laptop',
  categoryId: CAT_ID,
  ppnType: 'TAXABLE' as const,
  isActive: true,
  createdBy: USER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const mockVariant = {
  id: VAR_ID,
  productId: PROD_ID,
  sku: 'laptop-pro-ABCD1234',
  barcode: null,
  attributes: {},
  price: '15000000.00',
  costPrice: '12000000.00',
  stockQty: 0,
  lowStockThreshold: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('products service', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default transaction mock: insert returns chainable
    mockTx.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([mockVariant]),
      }),
    })
  })

  describe('PROD-01: create product', () => {
    it('creates product with name, category, ppnType, defaultPrice, defaultCostPrice', async () => {
      // transaction: first insert (product) returns product, second insert (variant) already mocked above
      mockTx.insert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockProduct]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockVariant]),
          }),
        })

      const result = await createProduct(
        {
          name: 'Laptop Pro',
          description: 'A great laptop',
          categoryId: CAT_ID,
          ppnType: 'TAXABLE',
          defaultPrice: 15000000,
          defaultCostPrice: 12000000,
        },
        USER_ID,
        '127.0.0.1'
      )

      expect(result).toMatchObject({ name: 'Laptop Pro', categoryId: CAT_ID, ppnType: 'TAXABLE' })
      expect(result.variants).toBeDefined()
    })

    it('validates ppnType: rejects values outside TAXABLE | NON_TAXABLE', async () => {
      await expect(
        createProduct(
          {
            name: 'Product',
            categoryId: CAT_ID,
            ppnType: 'INVALID' as never,
            defaultPrice: 1000,
            defaultCostPrice: 800,
          },
          USER_ID,
          '127.0.0.1'
        )
      ).rejects.toThrow('INVALID_PPN_TYPE')
    })

    it('validates categoryId is a valid UUID', async () => {
      await expect(
        createProduct(
          {
            name: 'Product',
            categoryId: 'not-a-uuid',
            ppnType: 'TAXABLE',
            defaultPrice: 1000,
            defaultCostPrice: 800,
          },
          'user-uuid',
          '127.0.0.1'
        )
      ).rejects.toThrow('INVALID_CATEGORY_ID')
    })
  })

  describe('PROD-02: default variant on create', () => {
    it('createProduct always creates exactly one default variant with attributes: {}', async () => {
      const variantWithEmptyAttrs = { ...mockVariant, attributes: {} }

      mockTx.insert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockProduct]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([variantWithEmptyAttrs]),
          }),
        })

      const result = await createProduct(
        {
          name: 'Laptop Pro',
          categoryId: CAT_ID,
          ppnType: 'TAXABLE',
          defaultPrice: 15000000,
          defaultCostPrice: 12000000,
        },
        USER_ID,
        '127.0.0.1'
      )

      expect(result.variants).toHaveLength(1)
      expect(result.variants[0].attributes).toEqual({})
    })

    it('default variant SKU is auto-generated as slug-{8-char-id}', async () => {
      // Capture the values passed to the second insert (variant)
      let capturedVariantValues: Record<string, unknown> | null = null

      mockTx.insert
        .mockReturnValueOnce({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([mockProduct]),
          }),
        })
        .mockReturnValueOnce({
          values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
            capturedVariantValues = vals
            return {
              returning: vi.fn().mockResolvedValue([{ ...mockVariant, sku: vals.sku as string }]),
            }
          }),
        })

      const result = await createProduct(
        {
          name: 'Laptop Pro',
          categoryId: CAT_ID,
          ppnType: 'TAXABLE',
          defaultPrice: 15000000,
          defaultCostPrice: 12000000,
        },
        USER_ID,
        '127.0.0.1'
      )

      // SKU should be: slug-XXXXXXXX (slug from name, then dash, then 8-char uppercase)
      expect(result.variants[0].sku).toMatch(/^laptop-pro-[A-Z0-9]{8}$/)
    })

    it('addVariant creates additional variant with JSONB attributes record', async () => {
      // Check no duplicate SKU
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]), // no existing SKU
        }),
      })

      const additionalVariant = {
        ...mockVariant,
        id: 'var-uuid-2',
        sku: 'laptop-pro-RED-XL',
        attributes: { color: 'red', size: 'XL' },
      }

      mockDbInsert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([additionalVariant]),
        }),
      })

      const result = await addVariant(
        {
          productId: PROD_ID,
          attributes: { color: 'red', size: 'XL' },
          price: 16000000,
          costPrice: 13000000,
          sku: 'laptop-pro-RED-XL',
        },
        USER_ID,
        '127.0.0.1'
      )

      expect(result.attributes).toEqual({ color: 'red', size: 'XL' })
    })
  })

  describe('PROD-03: PPN classification', () => {
    it('getProduct returns ppnType field', async () => {
      // First select: product
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProduct]),
          }),
        }),
      })
      // Second select: variants
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockVariant]),
        }),
      })

      const result = await getProduct(PROD_ID)

      expect(result).toHaveProperty('ppnType', 'TAXABLE')
    })

    it('updateProduct can change ppnType', async () => {
      const updatedProduct = { ...mockProduct, ppnType: 'NON_TAXABLE' as const }

      // Select for old value
      mockDbSelect.mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([mockProduct]),
          }),
        }),
      })

      mockDbUpdate.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updatedProduct]),
          }),
        }),
      })

      const { logAudit } = await import('../../middleware/audit.js')
      const result = await updateProduct(
        { id: PROD_ID, ppnType: 'NON_TAXABLE' },
        USER_ID,
        '127.0.0.1'
      )

      expect(result).toMatchObject({ ppnType: 'NON_TAXABLE' })
      expect(logAudit).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE', tableName: 'products' }))
    })
  })
})
