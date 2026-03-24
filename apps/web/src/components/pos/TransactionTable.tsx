'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiGet } from '@/lib/api'
import type { UnifiedOrder } from './OrderHistory'

function formatRp(amount: number): string {
  return 'Rp' + amount.toLocaleString('id-ID')
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

interface Props {
  shiftId: string | undefined
  onPrintReceipt?: (orderId: string, orderType: 'RETAIL' | 'SERVICE') => void
  refreshKey?: number
}

export function TransactionTable({ shiftId, onPrintReceipt, refreshKey }: Props) {
  const [orders, setOrders] = useState<UnifiedOrder[]>([])
  const [loading, setLoading] = useState(true)

  const fetchOrders = useCallback(async () => {
    setLoading(true)
    try {
      const query = shiftId ? `?shiftId=${shiftId}&limit=20` : '?limit=20'
      const res = await apiGet<{ orders: UnifiedOrder[]; total: number }>(
        `/api/v1/pos/order-history${query}`
      )
      if (res.success && res.data) {
        setOrders(res.data.orders)
      }
    } catch { /* silent */ }
    setLoading(false)
  }, [shiftId])

  useEffect(() => {
    fetchOrders()
  }, [fetchOrders, refreshKey])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (orders.length === 0) {
    return (
      <div className="flex items-center justify-center py-6 text-ink-faint text-xs">
        Belum ada transaksi
      </div>
    )
  }

  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="bg-surface-subtle text-ink-muted uppercase tracking-wider text-[11px] font-semibold">
          <th className="text-left px-4 py-2">No</th>
          <th className="text-left px-4 py-2">Waktu</th>
          <th className="text-left px-4 py-2">Tipe</th>
          <th className="text-right px-4 py-2">Total</th>
          <th className="text-center px-4 py-2">Status</th>
          <th className="text-center px-4 py-2">Aksi</th>
        </tr>
      </thead>
      <tbody>
        {orders.map((order, i) => {
          const isRetail = order.order_type === 'RETAIL'
          const isVoided = isRetail && order.status === 'VOIDED'
          const isPaid = isRetail ? order.status !== 'VOIDED' : order.payment_status === 'PAID'

          return (
            <tr
              key={`${order.order_type}-${order.id}`}
              className="border-b border-border-light last:border-b-0 hover:bg-surface-subtle/50 transition-colors cursor-pointer"
              onClick={() => onPrintReceipt?.(order.id, order.order_type)}
            >
              <td className="px-4 py-2.5 font-mono text-ink-muted text-xs">
                {order.label || `TX-${String(i + 1).padStart(3, '0')}`}
              </td>
              <td className="px-4 py-2.5 text-ink-secondary text-xs">
                {formatTime(order.created_at)}
              </td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                  isRetail
                    ? 'bg-brand/10 text-brand'
                    : 'bg-success/10 text-success'
                }`}>
                  {isRetail ? 'Retail' : 'Service'}
                </span>
              </td>
              <td className={`px-4 py-2.5 text-right font-mono font-semibold text-xs ${isVoided ? 'text-red-400 line-through' : 'text-ink'}`}>
                {formatRp(order.total)}
              </td>
              <td className="px-4 py-2.5 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${
                  isVoided
                    ? 'bg-red-500/10 text-red-400'
                    : isPaid
                      ? 'bg-success/10 text-success'
                      : 'bg-amber-500/10 text-amber-500'
                }`}>
                  {isVoided ? 'Void' : isPaid ? 'Lunas' : 'Pending'}
                </span>
              </td>
              <td className="px-4 py-2.5 text-center">
                <span className="text-[11px] text-brand font-semibold px-2 py-1">
                  Detail
                </span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
