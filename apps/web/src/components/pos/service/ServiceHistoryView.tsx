'use client'

import { useState, useCallback, type FormEvent } from 'react'
import { authFetch } from '@/lib/auth-fetch'

interface VehicleInfo {
  id: string
  plateNumber: string
  brand: string | null
  model: string | null
  type: string | null
}

interface HistoryOrder {
  id: string
  orderNumber: string
  workStatus: string
  paymentStatus: string
  complaint: string | null
  estimatedCost: number | null
  completedAt: string | null
  createdAt: string
  vehicle?: VehicleInfo | null
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

const WORK_STATUS_COLORS: Record<string, string> = {
  BOOKING: 'bg-[rgba(122,132,144,0.1)] text-ink-muted',
  CHECKED_IN: 'bg-info-muted text-info',
  IN_PROGRESS: 'bg-warning-muted text-warning',
  COMPLETED: 'bg-success-muted text-success',
}

const WORK_STATUS_LABELS: Record<string, string> = {
  BOOKING: 'Booking',
  CHECKED_IN: 'Checked In',
  IN_PROGRESS: 'Dikerjakan',
  COMPLETED: 'Selesai',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: 'bg-danger-muted text-danger',
  PARTIAL: 'bg-warning-muted text-warning',
  PAID: 'bg-success-muted text-success',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Belum Bayar',
  PARTIAL: 'Sebagian',
  PAID: 'Lunas',
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

/* ── Search Icon (matching ProductPanel) ── */
function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

export function ServiceHistoryView() {
  const [plateNumber, setPlateNumber] = useState('')
  const [orders, setOrders] = useState<HistoryOrder[]>([])
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  const handleSearch = useCallback(async (e?: FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = plateNumber.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setOrders([])
    setVehicleInfo(null)
    setSearched(true)

    try {
      const url = `/api/v1/service-orders/history/${encodeURIComponent(trimmed)}`
      const res = await authFetch(url)
      const body: ApiResponse<HistoryOrder[]> = await res.json()

      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        console.error('[ServiceHistoryView] Failed to fetch history:', { url, status: res.status, error: msg })
        setError(msg)
        return
      }

      const data = body.data ?? []
      setOrders(data)

      // Extract vehicle info from first result if available
      if (data.length > 0 && data[0].vehicle) {
        setVehicleInfo(data[0].vehicle)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[ServiceHistoryView] Fetch error:', { url: `/api/v1/service-orders/history/${trimmed}`, error: msg })
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [plateNumber])

  return (
    <div data-testid="service-history-view" className="p-5 space-y-4">
      {/* Search form — matching POS search bar */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex items-center flex-1 rounded-xl py-3 px-4 gap-2.5 bg-surface-raised border border-border">
          <span className="text-ink-muted">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={plateNumber}
            onChange={(e) => setPlateNumber(e.target.value)}
            placeholder="Cari plat nomor... (contoh: B1234CD)"
            className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
            data-testid="history-plate-search"
          />
        </div>
        <button
          type="submit"
          disabled={!plateNumber.trim() || loading}
          className="px-5 py-3 bg-brand text-white text-[13px] font-semibold rounded-xl hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all press-scale"
        >
          {loading ? 'Mencari...' : 'Cari'}
        </button>
      </form>

      {/* Error banner */}
      {error ? (
        <div className="bg-danger-muted rounded-xl p-3 text-[13px] text-danger">
          Gagal memuat riwayat: {error}
        </div>
      ) : null}

      {/* Loading state */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-surface-subtle rounded-xl" />
          ))}
        </div>
      ) : null}

      {/* Vehicle info header */}
      {!loading && vehicleInfo ? (
        <div className="bg-brand-subtle border border-brand/20 rounded-xl p-4">
          <div className="flex items-center gap-2 text-[13px]">
            <span className="text-lg">🚗</span>
            <span className="font-semibold text-ink">{vehicleInfo.plateNumber}</span>
            {vehicleInfo.brand ? (
              <span className="text-ink-secondary">
                {vehicleInfo.brand}{vehicleInfo.model ? ` ${vehicleInfo.model}` : ''}
              </span>
            ) : null}
            {vehicleInfo.type ? (
              <span className="text-[11px] text-ink-muted bg-[rgba(122,132,144,0.1)] px-2 py-0.5 rounded-full font-medium">
                {vehicleInfo.type}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Results — card list (matching OpenOrdersList style) */}
      {!loading && searched && !error && orders.length > 0 ? (
        <div className="space-y-2">
          {orders.map(order => (
            <div key={order.id} className="bg-surface-raised border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-[13px] font-semibold text-ink">{order.orderNumber}</span>
                  <span className="text-[12px] text-ink-muted ml-2">{formatDate(order.createdAt)}</span>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${WORK_STATUS_COLORS[order.workStatus] ?? 'bg-[rgba(122,132,144,0.1)] text-ink-muted'}`}>
                    {WORK_STATUS_LABELS[order.workStatus] ?? order.workStatus}
                  </span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[order.paymentStatus] ?? 'bg-[rgba(122,132,144,0.1)] text-ink-muted'}`}>
                    {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                  </span>
                </div>
              </div>
              {order.complaint ? (
                <p className="text-[12px] text-ink-muted truncate">{order.complaint}</p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {/* Empty state */}
      {!loading && searched && !error && orders.length === 0 ? (
        <div className="bg-surface-raised border border-border rounded-xl p-8 text-center">
          <p className="text-ink-faint text-[13px]">Belum ada riwayat service untuk plat ini</p>
        </div>
      ) : null}

      {/* Initial state — no search yet */}
      {!loading && !searched ? (
        <div className="bg-surface-raised border border-border rounded-xl p-8 text-center">
          <p className="text-ink-faint text-[13px]">Masukkan plat nomor untuk melihat riwayat service</p>
        </div>
      ) : null}
    </div>
  )
}
