'use client'

import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { offlineDB, type OfflineTransaction } from '@/lib/db/offline-db'
import { authFetch } from '@/lib/auth-fetch'

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

interface ConflictRowProps {
  tx: OfflineTransaction
}

function ConflictRow({ tx }: ConflictRowProps) {
  const [showVoidReason, setShowVoidReason] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleForceComplete() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await authFetch('/api/v1/pos/transactions/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...tx.payload, forceComplete: true }),
      })
      const body = await res.json() as { success: boolean; error?: string }
      if (!res.ok || !body.success) {
        setError(body.error ?? `HTTP ${res.status}`)
        return
      }
      await offlineDB.offlineQueue.update(tx.clientUuid, {
        status: 'synced',
        syncedAt: Date.now(),
      })
    } catch {
      setError('Gagal menghubungi server')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleVoid() {
    if (!voidReason.trim()) {
      setError('Alasan pembatalan wajib diisi')
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      // If there's no server transaction ID stored, just do a local void
      // (no server record was created — pure conflict, no insert happened)
      const serverId = tx.payload.clientUuid  // clientUuid is the idempotency key
      const res = await fetch(`/api/v1/pos/transactions/${serverId}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: voidReason }),
      })

      if (res.status === 404) {
        // No server record — local-only void
        await offlineDB.offlineQueue.delete(tx.clientUuid)
        return
      }

      const body = await res.json() as { success: boolean; error?: string }
      if (!res.ok || !body.success) {
        setError(body.error ?? `HTTP ${res.status}`)
        return
      }
      await offlineDB.offlineQueue.update(tx.clientUuid, {
        status: 'synced',
        syncedAt: Date.now(),
      })
    } catch {
      setError('Gagal menghubungi server')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="border border-red-200 rounded-lg p-3 bg-danger-muted space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <p className="text-xs font-mono text-ink-secondary">#{tx.clientUuid.slice(-8)}</p>
          <p className="text-sm text-red-800 font-medium">{tx.conflictDetail ?? 'Konflik stok'}</p>
          <p className="text-xs text-ink-faint">{formatTime(tx.createdAt)}</p>
        </div>
      </div>

      {error && (
        <p className="text-xs text-red-700 bg-danger-muted rounded px-2 py-1">{error}</p>
      )}

      {!showVoidReason ? (
        <div className="flex gap-2">
          <button
            onClick={handleForceComplete}
            disabled={isLoading}
            className="flex-1 bg-amber-500 text-white rounded px-3 py-1.5 text-xs font-semibold hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Memproses...' : 'Paksa Selesai'}
          </button>
          <button
            onClick={() => setShowVoidReason(true)}
            disabled={isLoading}
            className="flex-1 bg-danger text-white rounded px-3 py-1.5 text-xs font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Batalkan
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <input
            type="text"
            value={voidReason}
            onChange={e => setVoidReason(e.target.value)}
            placeholder="Alasan pembatalan..."
            className="w-full border border-border rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <div className="flex gap-2">
            <button
              onClick={handleVoid}
              disabled={isLoading}
              className="flex-1 bg-danger text-white rounded px-3 py-1.5 text-xs font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Memproses...' : 'Konfirmasi Batal'}
            </button>
            <button
              onClick={() => { setShowVoidReason(false); setVoidReason(''); setError(null) }}
              disabled={isLoading}
              className="flex-1 border border-border rounded px-3 py-1.5 text-xs text-ink-secondary hover:bg-surface disabled:opacity-50"
            >
              Kembali
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function SyncIssuesPanel() {
  const conflicts = useLiveQuery(
    () => offlineDB.offlineQueue.where('status').equals('conflict').toArray(),
    [],
    []
  )

  if (!conflicts || conflicts.length === 0) return null

  return (
    <div className="fixed right-0 top-0 z-30 h-full w-80 bg-surface-raised border-l border-red-200 shadow-lg overflow-y-auto">
      <div className="p-4 border-b border-red-200 bg-danger-muted">
        <h2 className="text-sm font-semibold text-red-900">
          Transaksi Bermasalah ({conflicts.length})
        </h2>
        <p className="text-xs text-red-700 mt-0.5">
          Pilih tindakan untuk setiap transaksi
        </p>
      </div>
      <div className="p-3 space-y-3">
        {conflicts.map(tx => (
          <ConflictRow key={tx.clientUuid} tx={tx} />
        ))}
      </div>
    </div>
  )
}
