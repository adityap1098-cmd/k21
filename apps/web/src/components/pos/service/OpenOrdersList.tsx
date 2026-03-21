'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'

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
  BOOKING: 'bg-[rgba(122,132,144,0.1)] text-ink-muted',
  CHECKED_IN: 'bg-info-muted text-info',
  IN_PROGRESS: 'bg-warning-muted text-warning',
  COMPLETED: 'bg-success-muted text-success',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: 'bg-danger-muted text-danger',
  PARTIAL: 'bg-warning-muted text-warning',
  PAID: 'bg-success-muted text-success',
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
      const res = await authFetch('/api/v1/service-orders')
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
            <div key={i} className="h-20 bg-surface-subtle rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div data-testid="open-orders-list" className="p-4 space-y-3">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-ink">Order Aktif</h3>
        <button
          onClick={fetchOrders}
          className="px-3 py-1.5 text-[13px] font-medium text-brand hover:text-brand-hover hover:bg-brand-subtle rounded-lg transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* Error banner */}
      {error ? (
        <div className="bg-danger-muted border border-danger/20 rounded-xl p-3 text-[13px] text-danger">
          Gagal memuat order: {error}
        </div>
      ) : null}

      {/* Empty state */}
      {!error && orders.length === 0 ? (
        <div className="bg-surface-raised border border-border rounded-xl p-8 text-center">
          <p className="text-ink-faint text-[13px]">Tidak ada order aktif</p>
        </div>
      ) : null}

      {/* Order cards */}
      {orders.map(order => (
        <button
          key={order.id}
          onClick={() => onSelectOrder(order.id)}
          className="w-full text-left bg-surface-raised border border-border rounded-xl p-4 hover:border-brand/40 hover:bg-surface-subtle transition-all"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <span className="text-[13px] font-semibold text-ink">{order.orderNumber}</span>
            <div className="flex gap-1.5 shrink-0">
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${WORK_STATUS_COLORS[order.workStatus] ?? 'bg-[rgba(122,132,144,0.1)] text-ink-muted'}`}>
                {WORK_STATUS_LABELS[order.workStatus] ?? order.workStatus}
              </span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[order.paymentStatus] ?? 'bg-[rgba(122,132,144,0.1)] text-ink-muted'}`}>
                {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
              </span>
            </div>
          </div>

          {order.vehicle ? (
            <p className="text-[12px] text-ink-muted mb-1">
              🚗 {order.vehicle.plateNumber}
              {order.vehicle.brand ? ` — ${order.vehicle.brand}` : ''}
              {order.vehicle.model ? ` ${order.vehicle.model}` : ''}
            </p>
          ) : null}

          {order.complaint ? (
            <p className="text-[12px] text-ink-faint truncate">{order.complaint}</p>
          ) : null}
        </button>
      ))}
    </div>
  )
}
