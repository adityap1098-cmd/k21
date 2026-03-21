'use client'

import { useState, useEffect, useCallback } from 'react'

interface ServiceOrder {
  id: string
  orderNumber: string
  vehicleId: string
  complaint: string | null
  workStatus: string
  paymentStatus: string
  vehicle?: {
    id: string
    plateNumber: string
    brand: string | null
    model: string | null
  } | null
  createdAt: string
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

interface Props {
  onSelectOrder: (orderId: string) => void
}

const WORK_STATUS_COLORS: Record<string, string> = {
  BOOKING: 'bg-gray-100 text-gray-700',
  CHECKED_IN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  COMPLETED: 'bg-green-100 text-green-700',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: 'bg-red-100 text-red-700',
  PARTIAL: 'bg-amber-100 text-amber-700',
  PAID: 'bg-green-100 text-green-700',
}

const WORK_STATUS_LABELS: Record<string, string> = {
  BOOKING: 'Booking',
  CHECKED_IN: 'Checked In',
  IN_PROGRESS: 'Dikerjakan',
  COMPLETED: 'Selesai',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Belum Bayar',
  PARTIAL: 'Sebagian',
  PAID: 'Lunas',
}

export function OpenOrdersList({ onSelectOrder }: Props) {
  const [orders, setOrders] = useState<ServiceOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/v1/service-orders')
      const body: ApiResponse<ServiceOrder[]> = await res.json()
      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        console.error('[OpenOrdersList] Failed to fetch orders:', { url: '/api/v1/service-orders', status: res.status, error: msg })
        setError(msg)
        return
      }
      setOrders(body.data ?? [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[OpenOrdersList] Fetch error:', { url: '/api/v1/service-orders', error: msg })
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders])

  if (loading) {
    return (
      <div data-testid="open-orders-list" className="p-4">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-gray-100 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div data-testid="open-orders-list" className="p-4 space-y-3">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Order Aktif</h3>
        <button
          onClick={fetchOrders}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error banner */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          Gagal memuat order: {error}
        </div>
      ) : null}

      {/* Empty state */}
      {!error && orders.length === 0 ? (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
          <p className="text-gray-400 text-sm">Tidak ada order aktif</p>
        </div>
      ) : null}

      {/* Order cards */}
      {orders.map(order => (
        <button
          key={order.id}
          onClick={() => onSelectOrder(order.id)}
          className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-sm font-semibold text-gray-800">{order.orderNumber}</span>
            <div className="flex gap-1.5 shrink-0">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${WORK_STATUS_COLORS[order.workStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                {WORK_STATUS_LABELS[order.workStatus] ?? order.workStatus}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[order.paymentStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
              </span>
            </div>
          </div>

          {order.vehicle ? (
            <p className="text-xs text-gray-500 mb-1">
              🚗 {order.vehicle.plateNumber}
              {order.vehicle.brand ? ` — ${order.vehicle.brand}` : ''}
              {order.vehicle.model ? ` ${order.vehicle.model}` : ''}
            </p>
          ) : null}

          {order.complaint ? (
            <p className="text-xs text-gray-400 truncate">{order.complaint}</p>
          ) : null}
        </button>
      ))}
    </div>
  )
}
