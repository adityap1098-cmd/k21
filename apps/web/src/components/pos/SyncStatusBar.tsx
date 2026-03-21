'use client'

import { useLiveQuery } from 'dexie-react-hooks'
import { offlineDB } from '@/lib/db/offline-db'

interface Props {
  isSyncing: boolean
}

export function SyncStatusBar({ isSyncing }: Props) {
  const pendingCount = useLiveQuery(
    () => offlineDB.offlineQueue.where('status').equals('pending').count(),
    [],
    0
  )

  if (pendingCount === 0 && !isSyncing) return null

  return (
    <div className="w-full bg-warning text-surface-raised px-4 py-2 flex items-center gap-2 text-sm font-medium sticky top-0 z-40">
      {isSyncing ? (
        <>
          {/* Spinner */}
          <span className="inline-block w-4 h-4 border-2 border-surface-raised border-t-transparent rounded-full animate-spin shrink-0" />
          <span>Menyinkronkan {pendingCount} transaksi...</span>
        </>
      ) : (
        <>
          {/* Pulsing dot */}
          <span className="inline-block w-2 h-2 bg-warning rounded-full animate-pulse shrink-0" />
          <span>{pendingCount} transaksi menunggu sinkronisasi</span>
        </>
      )}
    </div>
  )
}
