import { randomUUID } from 'crypto'
import { eq, ilike, or } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { customers } from '../../db/schema/index.js'
import { logAudit } from '../../middleware/audit.js'
import type { Customer } from '../../db/schema/index.js'

export async function createCustomer(
  params: { name: string; phone: string },
  userId: string,
  ipAddress: string
): Promise<Customer> {
  const { name, phone } = params

  // Check for duplicate phone
  const existing = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.phone, phone))

  if (existing.length > 0) {
    throw new Error('DUPLICATE_PHONE')
  }

  const id = randomUUID()

  const [customer] = await db
    .insert(customers)
    .values({ id, name, phone })
    .returning()

  await logAudit({
    userId,
    action: 'CREATE',
    tableName: 'customers',
    recordId: customer.id,
    oldValue: null,
    newValue: { name: customer.name, phone: customer.phone },
    ipAddress,
  })

  return customer
}

export async function getCustomerById(id: string): Promise<Customer> {
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1)

  if (!customer) {
    throw new Error('CUSTOMER_NOT_FOUND')
  }

  return customer
}

export async function getCustomers(filters?: {
  isActive?: boolean
}): Promise<Customer[]> {
  const all = await db.select().from(customers)

  let filtered = all
  if (filters?.isActive != null) {
    filtered = filtered.filter((c) => c.isActive === filters.isActive)
  }

  return filtered
}

export async function updateCustomer(
  params: {
    id: string
    name?: string
    phone?: string
    isActive?: boolean
  },
  userId: string,
  ipAddress: string
): Promise<Customer> {
  const { id, ...updates } = params

  const [old] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, id))
    .limit(1)

  if (!old) {
    throw new Error('CUSTOMER_NOT_FOUND')
  }

  // Check for duplicate phone if phone is being updated
  if (updates.phone && updates.phone !== old.phone) {
    const existing = await db
      .select({ id: customers.id })
      .from(customers)
      .where(eq(customers.phone, updates.phone))

    if (existing.length > 0) {
      throw new Error('DUPLICATE_PHONE')
    }
  }

  const [updated] = await db
    .update(customers)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(customers.id, id))
    .returning()

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'customers',
    recordId: id,
    oldValue: { name: old.name, phone: old.phone, isActive: old.isActive },
    newValue: { name: updated.name, phone: updated.phone, isActive: updated.isActive },
    ipAddress,
  })

  return updated
}

export async function searchCustomers(query: string): Promise<Customer[]> {
  const pattern = `%${query}%`

  const results = await db
    .select()
    .from(customers)
    .where(
      or(
        ilike(customers.name, pattern),
        ilike(customers.phone, pattern)
      )
    )

  return results
}
