import Dexie, { type Table } from 'dexie'

// Inlined from apps/api/src/modules/pos/pos.service.ts — not yet in @k21/shared
export interface CompleteSaleParams {
  clientUuid: string
  shiftId: string
  cashierId: string
  subtotal: number
  discountAmount: number
  total: number
  items: Array<{
    variantId: string
    qty: number
    unitPrice: number
    discountAmount: number
    lineTotal: number
  }>
  payments: Array<{
    method: 'CASH' | 'TRANSFER' | 'QRIS'
    amount: number
    reference?: string
  }>
}

export interface OfflineTransaction {
  clientUuid: string        // primary key
  status: 'pending' | 'synced' | 'conflict'
  payload: CompleteSaleParams  // full sale params, sent to /pos/transactions/sync
  createdAt: number            // Date.now()
  syncedAt?: number
  conflictDetail?: string
}

export interface CatalogProduct {
  variantId: string        // primary key
  productId: string
  name: string
  sku: string
  barcode?: string
  price: number
  stockQty: number         // "last known" — stale when offline
  lastSyncedAt: number
}

export class OfflineDB extends Dexie {
  offlineQueue!: Table<OfflineTransaction>
  catalog!: Table<CatalogProduct>

  constructor() {
    super('k21-pos')
    this.version(1).stores({
      offlineQueue: 'clientUuid, status, createdAt',
      catalog: 'variantId, barcode, name',
    })
  }
}

export const offlineDB = new OfflineDB()
