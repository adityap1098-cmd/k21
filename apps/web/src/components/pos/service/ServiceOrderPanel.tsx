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
      <div data-testid="service-order-panel" className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-8 bg-gray-100 rounded w-1/3" />
          <div className="h-24 bg-gray-100 rounded" />
          <div className="h-40 bg-gray-100 rounded" />
        </div>
      </div>
    )
  }

  if (!order) {
    return (
      <div data-testid="service-order-panel" className="p-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          Order tidak ditemukan
        </div>
        <button onClick={onBack} className="mt-3 text-sm text-blue-600 hover:text-blue-800">← Kembali</button>
      </div>
    )
  }

  return (
    <div data-testid="service-order-panel" className="p-4 space-y-4 max-h-full overflow-y-auto">
      {/* Back button + Header */}
      <div>
        <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-800 mb-2">← Kembali</button>
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-lg font-semibold text-gray-800">{order.orderNumber}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${WORK_STATUS_COLORS[order.workStatus] ?? 'bg-gray-100 text-gray-600'}`}>
            {WORK_STATUS_LABELS[order.workStatus] ?? order.workStatus}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[order.paymentStatus] ?? 'bg-gray-100 text-gray-600'}`}>
            {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
          </span>
        </div>

        {/* Vehicle info */}
        {order.vehicle ? (
          <p className="text-sm text-gray-500 mt-1">
            🚗 {order.vehicle.plateNumber}
            {order.vehicle.brand ? ` — ${order.vehicle.brand}` : ''}
            {order.vehicle.model ? ` ${order.vehicle.model}` : ''}
          </p>
        ) : null}

        {/* Complaint */}
        {order.complaint ? (
          <p className="text-sm text-gray-600 mt-1 bg-gray-50 rounded p-2">Keluhan: {order.complaint}</p>
        ) : null}
      </div>

      {/* Error banner */}
      {error ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {/* Mechanic assignment */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <label className="text-xs font-medium text-gray-600">Mekanik</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={mechanicInput}
            onChange={e => setMechanicInput(e.target.value)}
            placeholder="ID Mekanik"
            className="flex-1 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={saveMechanic}
            disabled={mechanicSaving || !mechanicInput.trim()}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 transition-colors"
          >
            {mechanicSaving ? '...' : 'Simpan'}
          </button>
        </div>
      </div>

      {/* Estimate fields */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-2">
        <label className="text-xs font-medium text-gray-600">Estimasi</label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500">Biaya (Rp)</label>
            <input
              type="number"
              value={estCost}
              onChange={e => setEstCost(e.target.value)}
              placeholder="Estimasi biaya"
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              min={0}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Selesai</label>
            <input
              type="datetime-local"
              value={estDate}
              onChange={e => setEstDate(e.target.value)}
              className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button
            onClick={saveEstimate}
            disabled={estimateSaving}
            className="px-3 py-1.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded disabled:opacity-50 transition-colors"
          >
            {estimateSaving ? '...' : 'Simpan Estimasi'}
          </button>
        </div>
      </div>

      {/* Line items */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200">
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Item Pekerjaan</h4>
        </div>
        {items.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-400">Belum ada item</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map(item => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {item.description || (item.itemType === 'SERVICE' ? 'Jasa' : 'Part')}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.qty} × {formatRp(item.unitPrice)} = {formatRp(item.lineTotal)}
                  </p>
                </div>
                <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 shrink-0">
                  {item.itemType}
                </span>
                <button
                  onClick={() => removeItem(item.id)}
                  className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0 px-1"
                  aria-label={`Remove ${item.description || 'item'}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        {/* Total */}
        <div className="px-3 py-2.5 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-700">Total</span>
          <span className="text-sm font-bold text-gray-900">{formatRp(lineItemsTotal)}</span>
        </div>
      </div>

      {/* Product selector — only show if order is not completed/paid */}
      {order.workStatus !== 'COMPLETED' || order.paymentStatus === 'UNPAID' ? (
        <div>
          <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Tambah Item</h4>
          <ServiceProductSelector serviceOrderId={orderId} onItemAdded={refreshAll} />
        </div>
      ) : null}

      {/* Status action bar */}
      <div className="border-t border-gray-200 pt-4">
        {order.paymentStatus === 'PAID' ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
            <span className="text-green-700 font-semibold">Lunas ✓</span>
          </div>
        ) : (
          <div className="flex gap-2 flex-wrap">
            {order.workStatus === 'BOOKING' ? (
              <button
                onClick={() => updateStatus('CHECKED_IN')}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Memproses...' : 'Check In'}
              </button>
            ) : null}

            {order.workStatus === 'CHECKED_IN' ? (
              <button
                onClick={() => updateStatus('IN_PROGRESS')}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-amber-500 text-white rounded-lg font-medium text-sm hover:bg-amber-600 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Memproses...' : 'Mulai Kerja'}
              </button>
            ) : null}

            {order.workStatus === 'IN_PROGRESS' ? (
              <button
                onClick={completeOrder}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-medium text-sm hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Memproses...' : 'Selesai'}
              </button>
            ) : null}

            {order.workStatus === 'COMPLETED' && order.paymentStatus !== 'PAID' ? (
              <button
                onClick={() => onRequestPayment(orderId, orderTotal, paidAmount)}
                disabled={actionLoading}
                className="flex-1 py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
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
