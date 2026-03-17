import { eq } from 'drizzle-orm'
import { cacheRedisClient } from '../../queues/redis.js'
import { db } from '../../db/index.js'
import { productVariants } from '../../db/schema/index.js'

const STOCK_KEY = (variantId: string) => `stock:variant:${variantId}`
const STOCK_TTL = 300 // 5 minutes

/**
 * Returns the stock quantity for a variant.
 * Checks Redis cache first; on miss, queries Postgres and populates cache.
 */
export async function getStockCached(variantId: string): Promise<number> {
  const cached = await cacheRedisClient.get(STOCK_KEY(variantId))
  if (cached !== null) return parseInt(cached, 10)

  const rows = await db
    .select({ stockQty: productVariants.stockQty })
    .from(productVariants)
    .where(eq(productVariants.id, variantId))
    .limit(1)

  const stock = rows[0]?.stockQty ?? 0
  await cacheRedisClient.setex(STOCK_KEY(variantId), STOCK_TTL, stock.toString())
  return stock
}

/**
 * Removes the Redis cache entry for a variant's stock.
 * Must be called after any stock-modifying transaction commits.
 */
export async function invalidateStockCache(variantId: string): Promise<void> {
  await cacheRedisClient.del(STOCK_KEY(variantId))
}
