'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { ServiceProductSelector } from './ServiceProductSelector'

interface Vehicle {
  id: string
  plateNumber: string
  vehicleType: string
  brand: string | null
  model: string | null
}

interface ServiceOrderDetail {
  id: string
  orderNumber: string
  vehicleId: string
  customerId: string
  complaint: string | null
  workStatus: string
  paymentStatus: string
  mechanicId: string | null
  estimatedCost: number | null
  estimatedCompletionAt: string | null
  totalAmount: number | null
  paidAmount: number | null
  vehicle?: Vehicle | null
  createdAt: string
}

interface LineItem {
  id: string
  itemType: 'SERVICE' | 'PART'
  catalogItemId: string | null
  variantId: string | null
  description: string | null
  qty: number
  unitPrice: number
  lineTotal: number
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

interface Props {
  orderId: string
  onBack: () => void
  onOrderUpdated: () => void
  onRequestPayment: (orderId: string, total: number, paid: number) => void
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
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

/* ── Shared input class ── */
const inputClass = 'w-full bg-surface-raised border border-border rounded-xl py-3 px-4 text-[13px] text-ink placeholder:text-ink-faint outline-none focus:border-brand focus:ring-2 focus:ring-brand-subtle transition-colors'
const inputCompactClass = 'w-full bg-surface-raised border border-border rounded-xl py-2.5 px-4 text-[13px] text-ink placeholder:text-ink-faint outline-none focus:border-brand focus:ring-2 focus:ring-brand-subtle transition-colors'

export function ServiceOrderPanel({ orderId, onBack, onOrderUpdated, onRequestPayment }: Props) {
  const [order, setOrder] = useState<ServiceOrderDetail | null>(null)
  const [items, setItems] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Mechanic assignment
  const [mechanicInput, setMechanicInput] = useState('')
  const [mechanicSaving, setMechanicSaving] = useState(false)

  // Estimate fields
  const [estCost, setEstCost] = useState('')
  const [estDate, setEstDate] = useState('')
  const [estimateSaving, setEstimateSaving] = useState(false)

  const fetchOrder = useCallback(async () => {
    try {
      const res = await authFetch(`/api/v1/service-orders/${orderId}`)
      const body: ApiResponse<ServiceOrderDetail> = await res.json()
      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        console.error('[ServiceOrderPanel] Failed to fetch order:', { orderId, status: res.status, error: msg })
        setError(msg)
        return
      }
      const o = body.data!
      setOrder(o)
      setMechanicInput(o.mechanicId ?? '')
      setEstCost(o.estimatedCost != null ? String(o.estimatedCost) : '')
      setEstDate(o.estimatedCompletionAt ? o.estimatedCompletionAt.slice(0, 16) : '')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[ServiceOrderPanel] Fetch order error:', { orderId, error: msg })
      setError(msg)
    }
  }, [orderId])

  const fetchItems = useCallback(async () => {
    try {
      const res = await authFetch(`/api/v1/service-orders/${orderId}/items`)
      const body: ApiResponse<LineItem[]> = await res.json()
      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        console.error('[ServiceOrderPanel] Failed to fetch items:', { orderId, status: res.status, error: msg })
        return
      }
      setItems(body.data ?? [])
    } catch (err) {
      console.error('[ServiceOrderPanel] Fetch items error:', { orderId, error: err instanceof Error ? err.message : 'Network error' })
    }
  }, [orderId])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    await Promise.all([fetchOrder(), fetchItems()])
    setLoading(false)
  }, [fetchOrder, fetchItems])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchOrder(), fetchItems()])
    onOrderUpdated()
  }, [fetchOrder, fetchItems, onOrderUpdated])

  // Remove line item
  const removeItem = async (itemId: string) => {
    setError(null)
    try {
      const res = await authFetch(`/api/v1/service-orders/${orderId}/items/${itemId}`, { method: 'DELETE' })
      const body: ApiResponse<unknown> = await res.json()
      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        console.error('[ServiceOrderPanel] Failed to remove item:', { orderId, itemId, status: res.status, error: msg })
        setError(msg)
        return
      }
      await refreshAll()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[ServiceOrderPanel] Remove item error:', { error: msg })
      setError(msg)
    }
  }

  // Status transitions
  const updateStatus = async (newStatus: string) => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/v1/service-orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      const body: ApiResponse<unknown> = await res.json()
      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        console.error('[ServiceOrderPanel] Status update failed:', { orderId, newStatus, status: res.status, error: msg })
        setError(msg)
        return
      }
      await refreshAll()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[ServiceOrderPanel] Status update error:', { error: msg })
      setError(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // Complete order (special endpoint — atomic inventory + accrual)
  const completeOrder = async () => {
    setActionLoading(true)
    setError(null)
    try {
      const res = await authFetch(`/api/v1/service-orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const body: ApiResponse<unknown> = await res.json()
      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        console.error('[ServiceOrderPanel] Complete order failed:', { orderId, status: res.status, error: msg })
        setError(msg)
        return
      }
      await refreshAll()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[ServiceOrderPanel] Complete order error:', { error: msg })
      setError(msg)
    } finally {
      setActionLoading(false)
    }
  }

  // Assign mechanic
  const saveMechanic = async () => {
    if (!mechanicInput.trim()) return
    setMechanicSaving(true)
    setError(null)
    try {
      const res = await authFetch(`/api/v1/service-orders/${orderId}/mechanic`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mechanicId: mechanicInput.trim() }),
      })
      const body: ApiResponse<unknown> = await res.json()
      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        console.error('[ServiceOrderPanel] Assign mechanic failed:', { orderId, status: res.status, error: msg })
        setError(msg)
        return
      }
      await fetchOrder()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[ServiceOrderPanel] Assign mechanic error:', { error: msg })
      setError(msg)
    } finally {
      setMechanicSaving(false)
    }
  }

  // Update estimate
  const saveEstimate = async () => {
    setEstimateSaving(true)
    setError(null)
    try {
      const payload: Record<string, unknown> = {}
      if (estCost) payload.estimatedCost = Number(estCost)
      if (estDate) payload.estimatedCompletionAt = new Date(estDate).toISOString()

      const res = await authFetch(`/api/v1/service-orders/${orderId}/estimate`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const body: ApiResponse<unknown> = await res.json()
      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        console.error('[ServiceOrderPanel] Update estimate failed:', { orderId, status: res.status, error: msg })
        setError(msg)
        return
      }
      await fetchOrder()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[ServiceOrderPanel] Update estimate error:', { error: msg })
      setError(msg)
    } finally {
      setEstimateSaving(false)
    }
  }

  // Compute line item total
  const lineItemsTotal = items.reduce((sum, item) => sum + item.lineTotal, 0)
  const orderTotal = order?.totalAmount ?? lineItemsTotal
  const paidAmount = order?.paidAmount ?? 0

  if (loading) {
    return (
      <div data-testid="service-order-panel" className="p-5">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-surface-subtle rounded-xl w-1/3" />
          <div className="h-24 bg-surface-subtle rounded-xl" />
          <div className="h-40 bg-surface-subtle rounded-xl" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div data-testid="service-order-panel" className="p-5">
        <div className="bg-danger-muted rounded-xl p-4 text-[13px] text-danger">
          Order tidak ditemukan
        </div>
        <button onClick={onBack} className="mt-3 text-[13px] text-brand hover:text-brand-hover font-medium">← Kembali</button>
      </div>
    )
  }

  return (
    <div data-testid="service-order-panel" className="p-5 space-y-4 max-h-full overflow-y-auto">
      {/* Back button + Header */}
      <div>
        <button onClick={onBack} className="text-[13px] text-brand hover:text-brand-hover font-medium mb-2">← Kembali</button>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-[17px] font-semibold text-ink tracking-[-0.02em]">{order.orderNumber}</h3>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${WORK_STATUS_COLORS[order.workStatus] ?? 'bg-[rgba(122,132,144,0.1)] text-ink-muted'}`}>
            {WORK_STATUS_LABELS[order.workStatus] ?? order.workStatus}
          </span>
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[order.paymentStatus] ?? 'bg-[rgba(122,132,144,0.1)] text-ink-muted'}`}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
          </span>
        </div>

        {/* Vehicle info */}
        {order.vehicle ? (
          <p className="text-[13px] text-ink-muted mt-1">
            🚗 {order.vehicle.plateNumber}
            {order.vehicle.brand ? ` — ${order.vehicle.brand}` : ''}
            {order.vehicle.model ? ` ${order.vehicle.model}` : ''}
          </p>
        ) : null}

        {/* Complaint */}
        {order.complaint ? (
          <p className="text-[13px] text-ink-secondary mt-2 bg-surface-subtle rounded-xl p-3">Keluhan: {order.complaint}</p>
        ) : null}
      </div>

      {/* Error banner */}
      {error ? (
        <div className="bg-danger-muted rounded-xl p-3 text-[13px] text-danger">
          {error}
        </div>
      ) : null}

      {/* Mechanic assignment */}
      <div className="bg-surface-raised border border-border rounded-xl p-4 space-y-2">
        <label className="text-[13px] font-medium text-ink">Mekanik</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={mechanicInput}
            onChange={e => setMechanicInput(e.target.value)}
            placeholder="ID Mekanik"
            className={inputCompactClass + ' flex-1'}
          />
          <button
            onClick={saveMechanic}
            disabled={mechanicSaving || !mechanicInput.trim()}
            className="px-4 py-2.5 text-[13px] font-medium bg-surface-raised border border-border rounded-xl text-ink-secondary hover:bg-surface-subtle disabled:opacity-50 transition-colors"
          >
            {mechanicSaving ? '...' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* Estimate fields */}
      <div className="bg-surface-raised border border-border rounded-xl p-4 space-y-3">
        <label className="text-[13px] font-medium text-ink">Estimasi</label>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[12px] text-ink-muted mb-1 block">Biaya (Rp)</label>
            <input
              type="number"
              value={estCost}
              onChange={e => setEstCost(e.target.value)}
              placeholder="Estimasi biaya"
              className={inputCompactClass}
              min={0}
            />
          </div>
          <div>
            <label className="text-[12px] text-ink-muted mb-1 block">Selesai</label>
            <input
              type="datetime-local"
              value={estDate}
              onChange={e => setEstDate(e.target.value)}
              className={inputCompactClass}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={saveEstimate}
            disabled={estimateSaving}
            className="px-4 py-2.5 text-[13px] font-medium bg-surface-raised border border-border rounded-xl text-ink-secondary hover:bg-surface-subtle disabled:opacity-50 transition-colors"
          >
            {estimateSaving ? '...' : 'Simpan Estimasi'}
          </button>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-surface-raised border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-surface-subtle border-b border-border">
          <h4 className="text-[12px] font-semibold text-ink-muted uppercase tracking-wide">Item Pekerjaan</h4>
        </div>
        {items.length === 0 ? (
          <div className="p-4 text-center text-[13px] text-ink-faint">Belum ada item</div>
        ) : (
          <div className="divide-y divide-border-light">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink truncate">
                    {item.description || (item.itemType === 'SERVICE' ? 'Jasa' : 'Part')}
                  </p>
                  <p className="text-[12px] text-ink-muted font-mono">
                    {item.qty} × {formatRp(item.unitPrice)} = {formatRp(item.lineTotal)}
                  </p>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-[rgba(122,132,144,0.1)] text-ink-muted font-medium shrink-0">
                  {item.itemType}
                </span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-danger hover:text-danger text-lg leading-none shrink-0 px-1"
                  aria-label={`Remove ${item.description || 'item'}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Total */}
        <div className="px-4 py-3 bg-surface-subtle border-t border-border flex justify-between items-center">
          <span className="text-[13px] font-semibold text-ink">Total</span>
          <span className="text-[15px] font-bold text-ink font-mono">{formatRp(lineItemsTotal)}</span>
        </div>
      </div>

      {/* Product selector — only show if order is not completed/paid */}
      {order.workStatus !== 'COMPLETED' || order.paymentStatus === 'UNPAID' ? (
        <div>
          <h4 className="text-[12px] font-semibold text-ink-muted uppercase tracking-wide mb-2">Tambah Item</h4>
          <ServiceProductSelector serviceOrderId={orderId} onItemAdded={refreshAll} />
        </div>
      ) : null}

      {/* Status action bar */}
      <div className="border-t border-border pt-4">
        {order.paymentStatus === 'PAID' ? (
          <div className="bg-success-muted rounded-xl p-4 text-center">
            <span className="text-success font-semibold text-[15px]">Lunas ✓</span>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {order.workStatus === 'BOOKING' ? (
              <button
                onClick={() => updateStatus('CHECKED_IN')}
                disabled={actionLoading}
                className="flex-1 py-3 bg-brand text-white rounded-xl font-semibold text-[13px] hover:bg-brand-hover disabled:opacity-50 transition-all press-scale"
              >
                {actionLoading ? 'Memproses...' : 'Check In'}
              </button>
            ) : null}

            {order.workStatus === 'CHECKED_IN' ? (
              <button
                onClick={() => updateStatus('IN_PROGRESS')}
                disabled={actionLoading}
                className="flex-1 py-3 bg-brand text-white rounded-xl font-semibold text-[13px] hover:bg-brand-hover disabled:opacity-50 transition-all press-scale"
              >
                {actionLoading ? 'Memproses...' : 'Mulai Kerja'}
              </button>
            ) : null}

            {order.workStatus === 'IN_PROGRESS' ? (
              <button
                onClick={completeOrder}
                disabled={actionLoading}
                className="flex-1 py-3 bg-brand text-white rounded-xl font-semibold text-[13px] hover:bg-brand-hover disabled:opacity-50 transition-all press-scale"
              >
                {actionLoading ? 'Memproses...' : 'Selesai'}
              </button>
            ) : null}

            {order.workStatus === 'COMPLETED' && order.paymentStatus !== 'PAID' ? (
              <button
                onClick={() => onRequestPayment(orderId, orderTotal, paidAmount)}
                disabled={actionLoading}
                className="flex-1 py-3 bg-brand text-white rounded-xl font-semibold text-[13px] hover:bg-brand-hover disabled:opacity-50 transition-all press-scale"
              >
                Bayar
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
