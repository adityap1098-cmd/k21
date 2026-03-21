'use client'

import { useState, useCallback, type FormEvent } from 'react'

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
  BOOKING: 'bg-gray-100 text-gray-700',
  CHECKED_IN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
}

const WORK_STATUS_LABELS: Record<string, string> = {
  BOOKING: 'Booking',
  CHECKED_IN: 'Checked In',
  IN_PROGRESS: 'Dikerjakan',
  COMPLETED: 'Selesai',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: 'bg-red-500 text-white',
  PARTIAL: 'bg-amber-500 text-white',
  PAID: 'bg-green-500 text-white',
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
      const res = await fetch(url)
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
    <div data-testid="service-history-view" className="p-4 space-y-4">
      {/* Search form */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          type="text"
          value={plateNumber}
          onChange={(e) => setPlateNumber(e.target.value)}
          placeholder="Cari plat nomor... (contoh: B1234CD)"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          data-testid="history-plate-search"
        />
        <button
          type="submit"
          disabled={!plateNumber.trim() || loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Mencari...' : 'Cari'}
        </button>
      </form>

      {/* Error banner */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Gagal memuat riwayat: {error}
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

      {/* Vehicle info header */}
      {!loading && vehicleInfo ? (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-lg">🚗</span>
            <span className="font-semibold text-blue-800">{vehicleInfo.plateNumber}</span>
            {vehicleInfo.brand ? (
              <span className="text-blue-600">
                {vehicleInfo.brand}{vehicleInfo.model ? ` ${vehicleInfo.model}` : ''}
              </span>
            ) : null}
            {vehicleInfo.type ? (
              <span className="text-blue-500 text-xs bg-blue-100 px-2 py-0.5 rounded-full">
                {vehicleInfo.type}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Results table */}
      {!loading && searched && !error && orders.length > 0 ? (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Order No.</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Tanggal</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Keluhan</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600">Status Kerja</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600">Status Bayar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{order.orderNumber}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(order.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[200px] truncate">
                    {order.complaint || '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${WORK_STATUS_COLORS[order.workStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                      {WORK_STATUS_LABELS[order.workStatus] ?? order.workStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[order.paymentStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                      {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {/* Empty state */}
      {!loading && searched && !error && orders.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">Belum ada riwayat service untuk plat ini</p>
        </div>
      ) : null}

      {/* Initial state — no search yet */}
      {!loading && !searched ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">Masukkan plat nomor untuk melihat riwayat service</p>
        </div>
      ) : null}
    </div>
  )
}
