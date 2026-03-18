'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { offlineDB, type CatalogProduct } from './db/offline-db'

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
      const res = await fetch('/api/v1/products?variants=true&active=true')
      if (!res.ok) {
        throw new Error(`Sync failed: ${res.status} ${res.statusText}`)
      }
      const data = await res.json() as { data: CatalogProduct[] }
      const products: CatalogProduct[] = data.data ?? []
      const now = Date.now()
      const records = products.map(p => ({ ...p, lastSyncedAt: now }))
      await offlineDB.catalog.bulkPut(records)
      setLastSyncedAt(now)
    } finally {
      setIsSyncing(false)
    }
  }

  return { syncCatalog, lastSyncedAt, isSyncing }
}

export async function getQuickAddProducts(): Promise<CatalogProduct[]> {
  return offlineDB.catalog
    .orderBy('price')
    .reverse()
    .limit(20)
    .toArray()
}
