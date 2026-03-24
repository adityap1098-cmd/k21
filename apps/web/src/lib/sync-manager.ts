'use client'

import { offlineDB } from './db/offline-db'
import { authFetch } from './auth-fetch'

export interface SyncResult {
  clientUuid: string
  status: 'synced' | 'conflict' | 'error'
  message?: string
}

const MAX_RETRIES = 5

/**
 * Syncs all pending offline transactions to the server.
 *
 * Improvements over the original:
 * - Per-transaction error isolation: one failure doesn't block the rest
 * - Retry counter: tracks attempts per transaction, stops after MAX_RETRIES
 * - Network vs server error distinction: network errors skip remaining (no point),
 *   but server errors (4xx/5xx) are recorded and the loop continues
 * - Failed transactions with too many retries are marked 'error' so they
 *   surface in the SyncIssuesPanel for manual resolution
 */
export async function syncPendingTransactions(): Promise<SyncResult[]> {
  const pending = await offlineDB.offlineQueue
    .where('status').equals('pending')
    .sortBy('createdAt')

  const results: SyncResult[] = []
  let networkDown = false

  for (const tx of pending) {
    // Skip if we already detected network is down
    if (networkDown) break

    // Check retry count — mark as permanent error if exceeded
    const retryCount = (tx as any).retryCount ?? 0
    if (retryCount >= MAX_RETRIES) {
      await offlineDB.offlineQueue.update(tx.clientUuid, {
        status: 'error' as any,
        conflictDetail: `Gagal sync setelah ${MAX_RETRIES} percobaan`,
      })
      results.push({
        clientUuid: tx.clientUuid,
        status: 'error',
        message: `Failed after ${MAX_RETRIES} retries`,
      })
      continue
    }

    try {
      const res = await authFetch('/api/v1/pos/transactions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tx.payload),
      })

      if (!res.ok) {
        // Server error (4xx/5xx) — record retry, continue to next transaction
        const errorBody = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
        const errorMsg = (errorBody as any)?.error ?? `HTTP ${res.status}`

        await offlineDB.offlineQueue.update(tx.clientUuid, {
          retryCount: retryCount + 1,
          lastError: errorMsg,
          lastRetryAt: Date.now(),
        } as any)

        results.push({
          clientUuid: tx.clientUuid,
          status: 'error',
          message: errorMsg,
        })
        continue
      }

      const data = await res.json() as { data?: { status?: string; message?: string } }

      if (data.data?.status === 'conflict') {
        await offlineDB.offlineQueue.update(tx.clientUuid, {
          status: 'conflict',
          conflictDetail: data.data?.message ?? 'Stock conflict',
        })
        results.push({
          clientUuid: tx.clientUuid,
          status: 'conflict',
          message: data.data?.message,
        })
      } else {
        await offlineDB.offlineQueue.update(tx.clientUuid, {
          status: 'synced',
          syncedAt: Date.now(),
        })
        results.push({ clientUuid: tx.clientUuid, status: 'synced' })
      }
    } catch {
      // Network error (fetch failed) — no point trying remaining transactions
      // Increment retry count for this one, then stop the loop
      await offlineDB.offlineQueue.update(tx.clientUuid, {
        retryCount: retryCount + 1,
        lastRetryAt: Date.now(),
      } as any).catch(() => {})

      networkDown = true
    }
  }

  return results
}

/**
 * Starts listening for online events to trigger sync.
 * Also runs immediately if already online.
 *
 * Returns a cleanup function to remove the event listener.
 */
export function startSyncListener(onUpdate?: (results: SyncResult[]) => void, onSyncStart?: () => void): () => void {
  let syncing = false

  const handleOnline = async () => {
    // Prevent concurrent sync runs
    if (syncing) return
    syncing = true
    onSyncStart?.()
    try {
      const results = await syncPendingTransactions()
      onUpdate?.(results)
    } finally {
      syncing = false
    }
  }

  window.addEventListener('online', handleOnline)

  // Also fire immediately if already online (catches background-tab reconnect)
  if (navigator.onLine) void handleOnline()

  return () => window.removeEventListener('online', handleOnline)
}
