'use client'

import { useState, useEffect, useCallback } from 'react'

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
      const res = await fetch(url)
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
    <div data-testid="receivables-view" className="p-4 space-y-4">
      {/* Header with refresh and filter */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-gray-700 shrink-0">Piutang Outstanding</h3>
        <input
          type="text"
          value={customerFilter}
          onChange={(e) => setCustomerFilter(e.target.value)}
          placeholder="Filter nama customer, plat, atau order..."
          className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          data-testid="receivables-filter"
        />
        <button
          onClick={() => fetchReceivables()}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors shrink-0"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error banner */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Gagal memuat piutang: {error}
        </div>
      ) : null}

      {/* Loading state */}
      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-14 bg-gray-100 rounded-lg" />
          ))}
        </div>
      ) : null}

      {/* Results table */}
      {!loading && !error && filtered.length > 0 ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Order No.</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Customer</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Kendaraan</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Total</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Dibayar</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Sisa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(item => (
                <tr key={item.orderNumber} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{item.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {item.customerName ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{item.vehiclePlate ?? '—'}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{formatRupiah(item.total)}</td>
                  <td className="px-4 py-3 text-right text-gray-500">{formatRupiah(item.totalPaid)}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${item.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatRupiah(item.outstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Summary row */}
            <tfoot>
              <tr className="bg-gray-50 border-t-2 border-gray-300">
                <td colSpan={5} className="px-4 py-3 text-right font-semibold text-gray-700">
                  Total Piutang:
                </td>
                <td className="px-4 py-3 text-right font-bold text-red-600">
                  {formatRupiah(totalOutstanding)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : null}

      {/* Empty state */}
      {!loading && !error && filtered.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">
            {customerFilter.trim()
              ? 'Tidak ada piutang yang cocok dengan filter'
              : 'Tidak ada piutang outstanding'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
