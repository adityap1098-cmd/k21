'use client'

import { offlineDB } from './db/offline-db'

export interface SyncResult {
  clientUuid: string
  status: 'synced' | 'conflict'
  message?: string
}

export async function syncPendingTransactions(): Promise<SyncResult[]> {
  const pending = await offlineDB.offlineQueue
    .where('status').equals('pending')
    .sortBy('createdAt')

  const results: SyncResult[] = []
  for (const tx of pending) {
    try {
      const res = await fetch('/api/v1/pos/transactions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx.payload),
      })
      const data = await res.json() as { data?: { status?: string; message?: string } }
      if (data.data?.status === 'conflict') {
        await offlineDB.offlineQueue.update(tx.clientUuid, {
          status: 'conflict',
          conflictDetail: data.data?.message ?? 'Stock conflict',
        })
        results.push({ clientUuid: tx.clientUuid, status: 'conflict', message: data.data?.message })
      } else {
        await offlineDB.offlineQueue.update(tx.clientUuid, {
          status: 'synced',
          syncedAt: Date.now(),
        })
        results.push({ clientUuid: tx.clientUuid, status: 'synced' })
      }
    } catch {
      // Network error — leave as pending, retry on next online event
      break
    }
  }
  return results
}

export function startSyncListener(onUpdate?: (results: SyncResult[]) => void): () => void {
  const handleOnline = async () => {
    const results = await syncPendingTransactions()
    onUpdate?.(results)
  }
  window.addEventListener('online', handleOnline)
  // Also fire immediately if already online (catches background-tab reconnect)
  if (navigator.onLine) void syncPendingTransactions().then(r => onUpdate?.(r))
  return () => window.removeEventListener('online', handleOnline)
}
