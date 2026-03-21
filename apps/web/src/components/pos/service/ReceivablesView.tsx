'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'

interface ReceivableOrder {
  orderNumber: string
  customerName: string | null
  customerPhone: string | null
  vehiclePlate: string | null
  total: number
  totalPaid: number
  outstanding: number
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID')
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

export function ReceivablesView() {
  const [receivables, setReceivables] = useState<ReceivableOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerFilter, setCustomerFilter] = useState('')

  const fetchReceivables = useCallback(async (customerId?: string) => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (customerId) params.set('customerId', customerId)
      const queryStr = params.toString()
      const url = `/api/v1/service-orders/receivables${queryStr ? `?${queryStr}` : ''}`
      const res = await authFetch(url)
      const body: ApiResponse<ReceivableOrder[]> = await res.json()

      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        console.error('[ReceivablesView] Failed to fetch receivables:', { url, status: res.status, error: msg })
        setError(msg)
        return
      }

      setReceivables(body.data ?? [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[ReceivablesView] Fetch error:', { url: '/api/v1/service-orders/receivables', error: msg })
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReceivables()
  }, [fetchReceivables])

  // Client-side filtering by customer name (API returns all, we filter locally for quick search)
  const filtered = customerFilter.trim()
    ? receivables.filter(r =>
        (r.customerName ?? '').toLowerCase().includes(customerFilter.toLowerCase()) ||
        (r.vehiclePlate ?? '').toLowerCase().includes(customerFilter.toLowerCase()) ||
        r.orderNumber.toLowerCase().includes(customerFilter.toLowerCase())
      )
    : receivables

  const totalOutstanding = filtered.reduce((sum, r) => sum + r.outstanding, 0)

  return (
    <div data-testid="receivables-view" className="p-5 space-y-4">
      {/* Header with search + refresh */}
      <div className="flex items-center gap-3">
        <h3 className="text-[15px] font-semibold text-ink shrink-0">Piutang</h3>
        <div className="flex items-center flex-1 rounded-xl py-2.5 px-4 gap-2.5 bg-surface-raised border border-border">
          <span className="text-ink-muted">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={customerFilter}
            onChange={(e) => setCustomerFilter(e.target.value)}
            placeholder="Filter nama customer, plat, atau order..."
            className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
            data-testid="receivables-filter"
          />
        </div>
        <button
          onClick={() => fetchReceivables()}
          className="px-3 py-1.5 text-[13px] font-medium text-brand hover:text-brand-hover hover:bg-brand-subtle rounded-lg transition-colors shrink-0"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error banner */}
      {error ? (
        <div className="bg-danger-muted rounded-xl p-3 text-[13px] text-danger">
          Gagal memuat piutang: {error}
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

      {/* Results — card list */}
      {!loading && !error && filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.orderNumber} className="bg-surface-raised border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <span className="text-[13px] font-semibold text-ink">{item.orderNumber}</span>
                  {item.vehiclePlate ? (
                    <span className="text-[12px] text-ink-muted ml-2">🚗 {item.vehiclePlate}</span>
                  ) : null}
                </div>
                <span className="text-danger font-semibold font-mono tabular-nums text-[13px]">
                  {formatRupiah(item.outstanding)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[12px]">
                <span className="text-ink-secondary">{item.customerName ?? '—'}</span>
                <span className="text-ink-faint">
                  Total: <span className="font-mono">{formatRupiah(item.total)}</span>
                </span>
                <span className="text-ink-faint">
                  Dibayar: <span className="font-mono">{formatRupiah(item.totalPaid)}</span>
                </span>
              </div>
            </div>
          ))}

          {/* Summary bar */}
          <div className="bg-surface-subtle border border-border rounded-xl p-4 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">Total Piutang</span>
            <span className="text-danger font-bold font-mono tabular-nums text-[15px]">
              {formatRupiah(totalOutstanding)}
            </span>
          </div>
        </div>
      ) : null}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 ? (
        <div className="bg-surface-raised border border-border rounded-xl p-8 text-center">
          <p className="text-ink-faint text-[13px]">
            {customerFilter.trim()
              ? 'Tidak ada piutang yang cocok dengan filter'
              : 'Tidak ada piutang outstanding'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
