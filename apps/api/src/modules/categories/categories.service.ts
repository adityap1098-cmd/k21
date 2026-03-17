import { eq, sql, asc, isNull } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { categories, products } from '../../db/schema/index.js'
import { logAudit } from '../../middleware/audit.js'
import type { Category } from '../../db/schema/index.js'

export async function createCategory(
  params: { name: string; parentId?: string },
  userId: string,
  ipAddress: string
): Promise<Category> {
  const { name, parentId } = params

  // Max one level: if parentId provided, check that parent itself has no parentId
  if (parentId) {
    const [parent] = await db
      .select()
      .from(categories)
      .where(eq(categories.id, parentId))
      .limit(1)

    if (parent?.parentId != null) {
      throw new Error('GRANDCHILD_NOT_ALLOWED')
    }
  }

  const [category] = await db
    .insert(categories)
    .values({ name, parentId: parentId ?? null })
    .returning()

  await logAudit({
    userId,
    action: 'CREATE',
    tableName: 'categories',
    recordId: category.id,
    oldValue: null,
    newValue: { name: category.name, parentId: category.parentId },
    ipAddress,
  })

  return category
}

export async function getCategories(): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .orderBy(asc(categories.name))
}

export async function updateCategory(
  params: { id: string; name: string },
  userId: string,
  ipAddress: string
): Promise<Category> {
  const { id, name } = params

  const [old] = await db
    .select()
    .from(categories)
    .where(eq(categories.id, id))
    .limit(1)

  if (!old) {
    throw new Error('CATEGORY_NOT_FOUND')
  }

  const [updated] = await db
    .update(categories)
    .set({ name, updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning()

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'categories',
    recordId: id,
    oldValue: { name: old.name },
    newValue: { name: updated.name },
    ipAddress,
  })

  return updated
}

export async function deleteCategory(
  id: string,
  userId: string,
  ipAddress: string
): Promise<void> {
  // Block delete if any product references this category
  const rows = await db
    .select({ count: sql<string>`count(*)` })
    .from(products)
    .where(eq(products.categoryId, id))

  const count = parseInt(rows[0]?.count ?? '0', 10)
  if (count > 0) {
    throw new Error('CATEGORY_HAS_PRODUCTS')
  }

  await db.delete(categories).where(eq(categories.id, id))

  await logAudit({
    userId,
    action: 'DELETE',
    tableName: 'categories',
    recordId: id,
    oldValue: { id },
    newValue: null,
    ipAddress,
  })
}
