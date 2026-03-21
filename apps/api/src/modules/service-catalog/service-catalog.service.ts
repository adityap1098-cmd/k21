import { randomUUID } from 'crypto'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { serviceCatalog } from '../../db/schema/index.js'
import { logAudit } from '../../middleware/audit.js'
import type { ServiceCatalogItem } from '../../db/schema/index.js'

export async function createServiceItem(
  params: { name: string; description?: string; defaultPrice: number },
  userId: string,
  ipAddress: string
): Promise<ServiceCatalogItem> {
  const { name, description, defaultPrice } = params
  const id = randomUUID()

  const [item] = await db
    .insert(serviceCatalog)
    .values({ id, name, description: description ?? null, defaultPrice })
    .returning()

  await logAudit({
    userId,
    action: 'CREATE',
    tableName: 'service_catalog',
    recordId: item.id,
    oldValue: null,
    newValue: { name: item.name, defaultPrice: item.defaultPrice },
    ipAddress,
  })

  return item
}

export async function getServiceCatalog(): Promise<ServiceCatalogItem[]> {
  return db.select().from(serviceCatalog)
}

export async function getServiceItemById(id: string): Promise<ServiceCatalogItem> {
  const [item] = await db
    .select()
    .from(serviceCatalog)
    .where(eq(serviceCatalog.id, id))
    .limit(1)

  if (!item) {
    throw new Error('SERVICE_CATALOG_ITEM_NOT_FOUND')
  }

  return item
}

export async function updateServiceItem(
  params: {
    id: string
    name?: string
    description?: string
    defaultPrice?: number
    isActive?: boolean
  },
  userId: string,
  ipAddress: string
): Promise<ServiceCatalogItem> {
  const { id, ...updates } = params

  const [old] = await db
    .select()
    .from(serviceCatalog)
    .where(eq(serviceCatalog.id, id))
    .limit(1)

  if (!old) {
    throw new Error('SERVICE_CATALOG_ITEM_NOT_FOUND')
  }

  const [updated] = await db
    .update(serviceCatalog)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(serviceCatalog.id, id))
    .returning()

  await logAudit({
    userId,
    action: 'UPDATE',
    tableName: 'service_catalog',
    recordId: id,
    oldValue: { name: old.name, defaultPrice: old.defaultPrice, isActive: old.isActive },
    newValue: { name: updated.name, defaultPrice: updated.defaultPrice, isActive: updated.isActive },
    ipAddress,
  })

  return updated
}
