'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'

interface ReceivableOrder {
  serviceOrderId: string
  orderNumber: string
  customerName: string | null
  customerId: string | null
  vehicleId: string | null
  plateNumber: string | null
  workStatus: string
  paymentStatus: string
  total: number
  totalPaid: number
  outstanding: number
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

interface Props {
  onRequestPayment?: (orderId: string, total: number, paid: number) => void
}

function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID')
}

/* ── Search Icon ── */
function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
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

export function ReceivablesView({ onRequestPayment }: Props) {
  const [receivables, setReceivables] = useState<ReceivableOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [customerFilter, setCustomerFilter] = useState('')

  const fetchReceivables = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await authFetch('/api/v1/service-orders/receivables')
      const body: ApiResponse<ReceivableOrder[]> = await res.json()

      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        setError(msg)
        return
      }

      setReceivables(body.data ?? [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchReceivables()
  }, [fetchReceivables])

  // Client-side filtering
  const filtered = customerFilter.trim()
    ? receivables.filter(r =>
        (r.customerName ?? '').toLowerCase().includes(customerFilter.toLowerCase()) ||
        (r.plateNumber ?? '').toLowerCase().includes(customerFilter.toLowerCase()) ||
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
          />
        </div>
        <button
          onClick={() => fetchReceivables()}
          className="px-3 py-1.5 text-[13px] font-medium text-brand hover:text-brand-hover hover:bg-brand-subtle rounded-lg transition-colors shrink-0"
        >
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error ? (
        <div className="bg-danger-muted rounded-xl p-3 text-[13px] text-danger">
          Gagal memuat piutang: {error}
        </div>
      ) : null}

      {/* Loading */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-surface-subtle rounded-xl" />
          ))}
        </div>
      ) : null}

      {/* Receivable cards */}
      {!loading && !error && filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.serviceOrderId} className="bg-surface-raised border border-border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink">{item.orderNumber}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[item.paymentStatus] ?? 'bg-[rgba(122,132,144,0.1)] text-ink-muted'}`}>
                    {PAYMENT_STATUS_LABELS[item.paymentStatus] ?? item.paymentStatus}
                  </span>
                </div>
                <span className="text-danger font-semibold font-mono tabular-nums text-[13px]">
                  {formatRupiah(item.outstanding)}
                </span>
              </div>

              <div className="flex items-center gap-3 text-[12px] mb-3">
                <span className="text-ink-secondary">{item.customerName ?? '—'}</span>
                {item.plateNumber ? (
                  <span className="text-ink-muted">{item.plateNumber}</span>
                ) : null}
                <span className="text-ink-faint">
                  Total: <span className="font-mono">{formatRupiah(item.total)}</span>
                </span>
                <span className="text-ink-faint">
                  Dibayar: <span className="font-mono">{formatRupiah(item.totalPaid)}</span>
                </span>
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 pt-2 border-t border-border-light">
                {onRequestPayment && item.outstanding > 0 ? (
                  <button
                    onClick={() => onRequestPayment(item.serviceOrderId, item.total, item.totalPaid)}
                    className="flex-1 py-2 bg-brand text-white rounded-lg font-semibold text-[12px] hover:bg-brand-hover transition-all"
                  >
                    Bayar Rp {item.outstanding.toLocaleString('id-ID')}
                  </button>
                ) : null}
              </div>
            </div>
          ))}

          {/* Summary bar */}
          <div className="bg-surface-subtle border border-border rounded-xl p-4 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-ink">Total Piutang ({filtered.length} order)</span>
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
