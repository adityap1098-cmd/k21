import { eq, desc, sql, and, ilike } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { suppliers, type Supplier, type NewSupplier } from '../../db/schema/suppliers.js'

export async function listSuppliers(params: {
  search?: string
  active?: boolean
}): Promise<Supplier[]> {
  const conditions: any[] = []

  if (params.active !== undefined) {
    conditions.push(eq(suppliers.active, params.active))
  }
  if (params.search) {
    conditions.push(
      sql`(${suppliers.name} ILIKE ${'%' + params.search + '%'} OR ${suppliers.phone} ILIKE ${'%' + params.search + '%'})`
    )
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined

  return db
    .select()
    .from(suppliers)
    .where(where)
    .orderBy(suppliers.name)
}

export async function getSupplier(id: string): Promise<Supplier | null> {
  const rows = await db.select().from(suppliers).where(eq(suppliers.id, id)).limit(1)
  return rows[0] ?? null
}

export async function createSupplier(data: Omit<NewSupplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> {
  const [row] = await db.insert(suppliers).values(data).returning()
  return row
}

export async function updateSupplier(id: string, data: Partial<Omit<NewSupplier, 'id' | 'createdAt'>>): Promise<Supplier> {
  const [row] = await db
    .update(suppliers)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(suppliers.id, id))
    .returning()

  if (!row) throw new Error('SUPPLIER_NOT_FOUND')
  return row
}

export async function deleteSupplier(id: string): Promise<void> {
  // Soft delete — set active = false
  const result = await db
    .update(suppliers)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(suppliers.id, id))
    .returning()

  if (result.length === 0) throw new Error('SUPPLIER_NOT_FOUND')
}
