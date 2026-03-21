'use client'

import { useState, useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { offlineDB, type CatalogProduct } from './db/offline-db'
import { authFetch } from './auth-fetch'

export type { CatalogProduct }

export function useCatalogSearch(query: string): CatalogProduct[] {
  return useLiveQuery(async () => {
    if (!query || query.length < 1) return []
    const q = query.toLowerCase()
    return offlineDB.catalog
      .filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode === query)
      .limit(20)
      .toArray()
  }, [query], []) ?? []
}

interface ApiProduct {
  id: string
  name: string
  variants?: Array<{
    id: string
    sku: string
    barcode: string | null
    price: number
    costPrice: number
    stockQty: number
    attributes: Record<string, string> | null
  }>
}

export function useCatalogSync(): {
  syncCatalog: () => Promise<void>
  lastSyncedAt: number | null
  isSyncing: boolean
} {
  const [isSyncing, setIsSyncing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null)

  async function syncCatalog(): Promise<void> {
    setIsSyncing(true)
    try {
      const res = await authFetch('/api/v1/products?variants=true&active=true')
      if (!res.ok) throw new Error(`Sync failed: ${res.status}`)

      const json = await res.json() as { success: boolean; data: ApiProduct[] }
      if (!json.success || !Array.isArray(json.data)) return

      const now = Date.now()
      const records: CatalogProduct[] = []

      for (const product of json.data) {
        for (const variant of product.variants || []) {
          const attrs = variant.attributes ? Object.values(variant.attributes).join(' / ') : ''
          records.push({
            variantId: variant.id,
            productId: product.id,
            name: attrs ? `${product.name} — ${attrs}` : product.name,
            sku: variant.sku,
            barcode: variant.barcode || undefined,
            price: variant.price,
            stockQty: variant.stockQty,
            lastSyncedAt: now,
          })
        }
      }

      await offlineDB.catalog.clear()
      if (records.length > 0) {
        await offlineDB.catalog.bulkPut(records)
      }
      setLastSyncedAt(now)
    } finally {
      setIsSyncing(false)
    }
  }

  return { syncCatalog, lastSyncedAt, isSyncing }
}

/** Auto-sync catalog on mount — call in POS page */
export function useAutoSyncCatalog() {
  const { syncCatalog, isSyncing } = useCatalogSync()

  useEffect(() => {
    syncCatalog()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { isSyncing, syncCatalog }
}

export async function getQuickAddProducts(): Promise<CatalogProduct[]> {
  return offlineDB.catalog
    .orderBy('price')
    .reverse()
    .limit(20)
    .toArray()
}
