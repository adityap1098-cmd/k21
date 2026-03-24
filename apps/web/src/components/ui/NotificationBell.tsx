'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Bell, Check, CheckCheck, X, AlertTriangle, Package, ShoppingCart, Wrench, Info } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'

interface NotificationItem {
  id: string
  type: string
  payload: Record<string, any>
  readAt: string | null
  createdAt: string
}

const TYPE_ICONS: Record<string, typeof Bell> = {
  LOW_STOCK: AlertTriangle,
  PO_APPROVAL: ShoppingCart,
  SERVICE_COMPLETE: Wrench,
  PRODUCT_UPDATE: Package,
}

const TYPE_COLORS: Record<string, string> = {
  LOW_STOCK: 'text-amber-500',
  PO_APPROVAL: 'text-blue-500',
  SERVICE_COMPLETE: 'text-emerald-500',
  PRODUCT_UPDATE: 'text-brand',
}

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(ms / 60000)
  if (mins < 1) return 'Baru saja'
  if (mins < 60) return `${mins}m lalu`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}j lalu`
  const days = Math.floor(hours / 24)
  return `${days}h lalu`
}

function getNotifMessage(n: NotificationItem): string {
  const p = n.payload
  switch (n.type) {
    case 'LOW_STOCK': return `Stok ${p.productName || 'produk'} tinggal ${p.stockQty ?? 0}`
    case 'PO_APPROVAL': return `PO ${p.poNumber || ''} menunggu approval`
    case 'SERVICE_COMPLETE': return `Service ${p.orderNumber || ''} selesai`
    default: return p.message || 'Notifikasi baru'
  }
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  const fetchNotifications = useCallback(async () => {
    const res = await apiGet<{ items: NotificationItem[]; unreadCount: number }>('/api/v1/notifications')
    if (res.success && res.data) {
      setItems(res.data.items)
      setUnreadCount(res.data.unreadCount)
    }
  }, [])

  // Poll unread count every 30s
  useEffect(() => {
    fetchNotifications()
    const interval = setInterval(async () => {
      const res = await apiGet<{ count: number }>('/api/v1/notifications/unread-count')
      if (res.success && res.data) setUnreadCount(res.data.count)
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchNotifications])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleMarkAllRead() {
    await apiPost('/api/v1/notifications/read-all', {})
    setItems(prev => prev.map(i => ({ ...i, readAt: i.readAt || new Date().toISOString() })))
    setUnreadCount(0)
  }

  async function handleMarkRead(id: string) {
    await apiPost(`/api/v1/notifications/${id}/read`, {})
    setItems(prev => prev.map(i => i.id === id ? { ...i, readAt: new Date().toISOString() } : i))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => { setOpen(!open); if (!open) fetchNotifications() }}
        className="relative p-2 rounded-lg text-ink-muted hover:bg-sidebar-hover hover:text-white transition-colors"
        aria-label="Notifikasi"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 bottom-full mb-2 w-[340px] max-h-[420px] bg-surface-raised border border-border rounded-xl shadow-xl overflow-hidden z-50 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-light">
            <h3 className="text-sm font-semibold text-ink">Notifikasi</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] text-brand hover:underline flex items-center gap-1"
                >
                  <CheckCheck size={12} /> Baca semua
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-ink-muted hover:text-ink p-0.5">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {items.length === 0 ? (
              <div className="py-12 text-center">
                <Bell size={24} className="text-ink-faint mx-auto mb-2" />
                <p className="text-xs text-ink-muted">Belum ada notifikasi</p>
              </div>
            ) : (
              items.map(n => {
                const Icon = TYPE_ICONS[n.type] || Info
                const color = TYPE_COLORS[n.type] || 'text-ink-muted'
                const isUnread = !n.readAt

                return (
                  <div
                    key={n.id}
                    onClick={() => isUnread && handleMarkRead(n.id)}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-border-light last:border-0 cursor-pointer hover:bg-surface-subtle transition-colors ${
                      isUnread ? 'bg-brand/5' : ''
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${color} bg-current/10`}>
                      <Icon size={14} className={color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${isUnread ? 'font-semibold text-ink' : 'text-ink-secondary'}`}>
                        {getNotifMessage(n)}
                      </p>
                      <p className="text-[10px] text-ink-faint mt-0.5">{formatTimeAgo(n.createdAt)}</p>
                    </div>
                    {isUnread && (
                      <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0 mt-1.5" />
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
