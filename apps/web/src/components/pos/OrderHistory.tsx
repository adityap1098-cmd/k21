'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiGet } from '@/lib/api'

function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID')
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export interface UnifiedOrder {
  id: string
  order_type: 'RETAIL' | 'SERVICE'
  status: string
  total: number
  note: string | null
  created_at: string
  item_count: number
  payment_methods: string | null
  label: string | null
  plate_number: string | null
  work_status: string | null
  payment_status: string | null
}

interface OrderHistoryProps {
  shiftId: string | undefined
  onSelectOrder: (orderId: string, orderType: 'RETAIL' | 'SERVICE') => void
  refreshKey?: number
}

function StatusBadge({ order }: { order: UnifiedOrder }) {
  if (order.order_type === 'SERVICE') {
    const isPaid = order.payment_status === 'PAID'
    const isCompleted = order.work_status === 'COMPLETED'
    if (isPaid) return <span className="block w-2 h-2 rounded-full bg-[#2D8F5E]" />
    if (isCompleted) return <span className="block w-2 h-2 rounded-full bg-blue-400" />
    return <span className="block w-2 h-2 rounded-full bg-amber-400" />
  }
  // RETAIL
  if (order.status === 'VOIDED') return <span className="block w-2 h-2 rounded-full bg-red-400" />
  return <span className="block w-2 h-2 rounded-full bg-[#2D8F5E]" />
}

function TypeBadge({ type }: { type: 'RETAIL' | 'SERVICE' }) {
  if (type === 'SERVICE') {
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold leading-3 bg-blue-100 text-blue-700">
        SERVICE
      </span>
    )
  }
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold leading-3 bg-emerald-100 text-emerald-700">
      RETAIL
    </span>
  )
}

export function OrderHistory({ shiftId, onSelectOrder, refreshKey }: OrderHistoryProps) {
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const query = shiftId ? `?shiftId=${shiftId}&limit=50` : '?limit=50'
      const res = await apiGet<{ orders: UnifiedOrder[]; total: number }>(
        `/api/v1/pos/order-history${query}`
      )
      if (res.success && res.data) {
        setOrders(res.data.orders)
      }
    } catch {
      // silent
    }
    setLoading(false)
  }, [shiftId])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders, refreshKey])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-ink-faint gap-2">
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <rect x="6" y="4" width="20" height="24" rx="2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M11 10H21M11 14H21M11 18H17" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
        <span className="text-xs">Belum ada transaksi</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col overflow-y-auto">
      {orders.map((order) => {
        const isVoided = order.order_type === 'RETAIL' && order.status === 'VOIDED'
        return (
          <button
            key={`${order.order_type}-${order.id}`}
            onClick={() => onSelectOrder(order.id, order.order_type)}
            className="flex items-center gap-3 px-4 py-2.5 text-left hover:bg-surface transition-colors border-b border-border-light last:border-b-0"
          >
            {/* Status dot */}
            <div className="shrink-0">
              <StatusBadge order={order} />
            </div>

            {/* Info */}
            <div className="flex flex-col grow min-w-0 gap-0.5">
              <div className="flex items-center gap-1.5">
                <TypeBadge type={order.order_type} />
                <span className="text-ink text-[11px] font-medium leading-4 truncate">
                  {order.label || 'Transaksi'}
                </span>
              </div>
              <span className="text-ink-muted text-[10px] leading-3 truncate">
                {order.item_count} item · {order.payment_methods || '-'} · {formatTime(order.created_at)}
              </span>
            </div>

            {/* Total */}
            <span
              className={`shrink-0 font-mono font-semibold text-[11px] leading-4 ${
                isVoided ? 'text-red-400 line-through' : 'text-ink'
              }`}
            >
              {formatRupiah(order.total)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
