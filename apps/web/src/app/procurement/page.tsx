'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Badge, Card, Input, Select } from '@/components/ui'
import { apiGet } from '@/lib/api'
import { authFetch } from '@/lib/auth-fetch'
import { useAuth } from '@/lib/auth'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  X,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  PackageCheck,
} from 'lucide-react'
/* ─── Types ─── */

interface PurchaseOrderItem {
  id: string
  variantId: string
  variantSku: string
  variantName: string
  qty: number
  unitCost: string | number
  lineTotal: string | number
  qtyReceived?: number
}

interface PurchaseOrder {
  id: string
  poNumber: string
  supplierName: string
  totalAmount?: number
  total?: string | number
  subtotal?: string | number
  status: string
  createdAt: string
  approvedBy: string | null
  notes?: string | null
  items?: PurchaseOrderItem[]
}

const STATUS_COLORS: Record<string, 'neutral' | 'amber' | 'blue' | 'green' | 'red' | 'brand'> = {
  'DRAFT': 'neutral',
  'PENDING_APPROVAL': 'amber',
  'APPROVED': 'blue',
  'PARTIALLY_RECEIVED': 'brand',
  'RECEIVED': 'green',
  'CANCELLED': 'red',
}

const STATUS_LABELS: Record<string, string> = {
  'DRAFT': 'Draft',
  'PENDING_APPROVAL': 'Menunggu',
  'APPROVED': 'Disetujui',
  'PARTIALLY_RECEIVED': 'Partial',
  'RECEIVED': 'Diterima',
  'CANCELLED': 'Dibatalkan',
}

const STATUS_FILTER = [
  { label: 'Semua', value: 'all' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Menunggu', value: 'PENDING_APPROVAL' },
  { label: 'Disetujui', value: 'APPROVED' },
  { label: 'Diterima', value: 'RECEIVED' },
]

function formatRp(amount: number | string | undefined): string {
  const n = Math.round(Number(amount) || 0)
  return `Rp ${n.toLocaleString('id-ID')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getTotal(po: PurchaseOrder): number {
  return Number(po.total ?? po.totalAmount ?? po.subtotal ?? 0)
}

/* ─── Receive Modal ─── */

interface ReceiveModalProps {
  po: PurchaseOrder
  onClose: () => void
  onSuccess: () => void
}

function ReceiveModal({ po, onClose, onSuccess }: ReceiveModalProps) {
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {}
    for (const item of po.items || []) {
      const remaining = item.qty - (item.qtyReceived ?? 0)
      init[item.id] = remaining > 0 ? remaining : 0
    }
    return init
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    const items = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qtyReceived]) => ({ itemId, qtyReceived }))

    if (items.length === 0) {
      setError('Masukkan jumlah yang diterima minimal 1 item')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await authFetch(`/api/v1/procurement/purchase-orders/${po.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        onSuccess()
        onClose()
      } else {
        setError(data.error || 'Gagal menerima barang')
      }
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in overflow-y-auto">
      <Card className="w-full max-w-lg p-6 animate-in scale-95 duration-200 my-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-ink">Terima Barang</h2>
            <p className="text-xs text-ink-muted mt-0.5">{po.poNumber} · {po.supplierName}</p>
          </div>
          <button onClick={onClose} className="text-ink-muted hover:text-ink"><X size={18} /></button>
        </div>

        <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
          {(po.items || []).map(item => {
            const remaining = item.qty - (item.qtyReceived ?? 0)
            return (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-surface-subtle rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium text-ink truncate">{item.variantName}</p>
                  <p className="text-xs text-ink-muted">{item.variantSku} · Dipesan: {item.qty} · Tersisa: {remaining}</p>
                </div>
                <input
                  type="number"
                  min={0}
                  max={remaining}
                  value={quantities[item.id] ?? 0}
                  onChange={e => setQuantities(prev => ({ ...prev, [item.id]: Math.min(remaining, Math.max(0, parseInt(e.target.value) || 0)) }))}
                  className="w-20 px-2 py-1.5 border border-border rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-brand"
                  disabled={remaining <= 0}
                />
              </div>
            )
          })}
        </div>

        {error && <p className="text-sm text-danger mb-3">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : <PackageCheck size={14} className="mr-1" />}
            Konfirmasi Terima
          </Button>
        </div>
      </Card>
    </div>
  )
}

/* ─── PO Detail Modal ─── */

interface PODetailModalProps {
  po: PurchaseOrder
  userRole: string
  onClose: () => void
  onRefresh: () => void
}

function PODetailModal({ po, userRole, onClose, onRefresh }: PODetailModalProps) {
  const [detail, setDetail] = useState<PurchaseOrder>(po)
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showReceive, setShowReceive] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isOwnerOrAdmin = userRole === 'Owner' || userRole === 'Admin'

  useEffect(() => {
    const fetchDetail = async () => {
      setLoading(true)
      const res = await apiGet<PurchaseOrder>(`/api/v1/procurement/purchase-orders/${po.id}`)
      if (res.success && res.data) setDetail(res.data)
      setLoading(false)
    }
    fetchDetail()
  }, [po.id])

  const doAction = async (action: string, label: string) => {
    setActionLoading(action)
    setError(null)
    try {
      const res = await authFetch(`/api/v1/procurement/purchase-orders/${detail.id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = await res.json()
      if (res.ok && data.success) {
        // Refresh detail
        const refreshed = await apiGet<PurchaseOrder>(`/api/v1/procurement/purchase-orders/${detail.id}`)
        if (refreshed.success && refreshed.data) setDetail(refreshed.data)
        onRefresh()
      } else {
        const MSG: Record<string, string> = {
          INVALID_STATUS_TRANSITION: 'Transisi status tidak valid',
          PO_NOT_FOUND: 'PO tidak ditemukan',
        }
        setError(MSG[data.error] || data.error || `Gagal ${label}`)
      }
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setActionLoading(null)
    }
  }

  const status = detail.status as string

  return (
    <>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in overflow-y-auto">
        <Card className="w-full max-w-2xl p-6 animate-in scale-95 duration-200 my-8">
          <div className="flex items-start justify-between mb-5">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-base font-semibold text-ink">{detail.poNumber}</h2>
                <Badge color={STATUS_COLORS[status] || 'neutral'}>{STATUS_LABELS[status] || status}</Badge>
              </div>
              <p className="text-sm text-ink-muted">{detail.supplierName} · {formatDate(detail.createdAt)}</p>
            </div>
            <button onClick={onClose} className="text-ink-muted hover:text-ink mt-0.5"><X size={18} /></button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={24} className="animate-spin text-ink-faint" />
            </div>
          ) : (
            <>
              {/* Items table */}
              <div className="border border-border rounded-lg overflow-hidden mb-4">
                <div className="grid grid-cols-[1fr_60px_90px_80px] gap-3 px-4 py-2.5 bg-surface-subtle border-b border-border">
                  <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Item</span>
                  <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider text-right">Qty</span>
                  <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider text-right">Harga</span>
                  <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider text-right">Total</span>
                </div>
                {(detail.items || []).length === 0 ? (
                  <p className="text-sm text-ink-muted text-center py-6">Tidak ada item</p>
                ) : (detail.items || []).map(item => (
                  <div key={item.id} className="grid grid-cols-[1fr_60px_90px_80px] gap-3 px-4 py-3 border-b border-border-light last:border-0">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">{item.variantName}</p>
                      <p className="text-xs text-ink-muted">{item.variantSku}
                        {item.qtyReceived !== undefined && item.qtyReceived > 0 && (
                          <span className="ml-2 text-success">✓ {item.qtyReceived} diterima</span>
                        )}
                      </p>
                    </div>
                    <span className="text-[13px] text-ink-secondary text-right tabular-nums">{item.qty}</span>
                    <span className="text-[13px] text-ink-secondary text-right tabular-nums">{formatRp(item.unitCost)}</span>
                    <span className="text-[13px] font-medium text-ink text-right tabular-nums">{formatRp(item.lineTotal)}</span>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex justify-end mb-4">
                <div className="text-right">
                  <p className="text-xs text-ink-muted mb-0.5">Total</p>
                  <p className="text-lg font-bold text-ink">{formatRp(getTotal(detail))}</p>
                </div>
              </div>

              {detail.notes && (
                <p className="text-sm text-ink-secondary mb-4 p-3 bg-surface-subtle rounded-lg">
                  <span className="font-medium text-ink-muted text-xs uppercase tracking-wide block mb-1">Catatan</span>
                  {detail.notes}
                </p>
              )}

              {error && <p className="text-sm text-danger mb-4">{error}</p>}

              {/* Action buttons by status */}
              <div className="flex flex-wrap gap-2 justify-end border-t border-border pt-4">
                {/* DRAFT → submit */}
                {status === 'DRAFT' && isOwnerOrAdmin && (
                  <Button
                    onClick={() => doAction('submit', 'submit')}
                    disabled={!!actionLoading}
                    icon={actionLoading === 'submit' ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  >
                    Ajukan Persetujuan
                  </Button>
                )}

                {/* PENDING_APPROVAL → approve */}
                {status === 'PENDING_APPROVAL' && isOwnerOrAdmin && (
                  <Button
                    onClick={() => doAction('approve', 'approve')}
                    disabled={!!actionLoading}
                    icon={actionLoading === 'approve' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                  >
                    Setujui
                  </Button>
                )}

                {/* APPROVED / PARTIALLY_RECEIVED → receive */}
                {(status === 'APPROVED' || status === 'PARTIALLY_RECEIVED') && (
                  <Button
                    onClick={() => setShowReceive(true)}
                    icon={<PackageCheck size={14} />}
                  >
                    Terima Barang
                  </Button>
                )}

                {/* DRAFT / PENDING_APPROVAL → cancel */}
                {(status === 'DRAFT' || status === 'PENDING_APPROVAL') && isOwnerOrAdmin && (
                  <Button
                    variant="secondary"
                    onClick={() => doAction('cancel', 'batalkan')}
                    disabled={!!actionLoading}
                    icon={actionLoading === 'cancel' ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                    className="text-danger border-danger/30 hover:bg-danger/5"
                  >
                    Batalkan PO
                  </Button>
                )}

                <Button variant="secondary" onClick={onClose}>Tutup</Button>
              </div>
            </>
          )}
        </Card>
      </div>

      {showReceive && (
        <ReceiveModal
          po={detail}
          onClose={() => setShowReceive(false)}
          onSuccess={() => {
            // Refresh detail after receive
            apiGet<PurchaseOrder>(`/api/v1/procurement/purchase-orders/${detail.id}`).then(res => {
              if (res.success && res.data) setDetail(res.data)
            })
            onRefresh()
          }}
        />
      )}
    </>
  )
}

/* ─── Create PO Form ─── */

interface ProductVariant {
  variantId: string
  variantSku: string
  variantName: string
  costPrice: number
}

interface LineItem {
  id: string
  variantId: string
  variantSku: string
  variantName: string
  qty: number
  unitCost: number
}

interface Supplier {
  id: string
  name: string
}

interface CreatePOModalProps {
  onClose: () => void
  onSuccess: () => void
}

function VariantSearchInput({
  onSelect,
}: {
  onSelect: (v: ProductVariant) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ProductVariant[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (query.length < 1) { setResults([]); return }
    setLoading(true)
    const timer = setTimeout(async () => {
      const res = await apiGet<Array<{
        id: string; name: string
        variants?: Array<{ id: string; sku: string; costPrice: number; attributes: Record<string,string> | null }>
      }>>(`/api/v1/products?variants=true`)
      if (res.success && res.data) {
        const q = query.toLowerCase()
        const matches: ProductVariant[] = []
        for (const p of res.data) {
          for (const v of p.variants ?? []) {
            const attrs = v.attributes ? Object.values(v.attributes).join(' / ') : ''
            const fullName = attrs ? `${p.name} — ${attrs}` : p.name
            if (
              fullName.toLowerCase().includes(q) ||
              v.sku.toLowerCase().includes(q)
            ) {
              matches.push({
                variantId: v.id,
                variantSku: v.sku,
                variantName: fullName,
                costPrice: parseFloat(String(v.costPrice ?? 0)) || 0,
              })
            }
          }
        }
        setResults(matches.slice(0, 8))
        setOpen(true)
      }
      setLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  return (
    <div className="relative">
      <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-transparent focus-within:ring-2 focus-within:ring-brand">
        <Search size={14} className="text-ink-faint flex-shrink-0" />
        <input
          type="text"
          placeholder="Cari produk atau SKU..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          className="flex-1 text-sm bg-transparent outline-none text-ink placeholder:text-ink-faint"
        />
        {loading && <Loader2 size={13} className="animate-spin text-ink-faint" />}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-raised border border-border rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
          {results.map(v => (
            <button
              key={v.variantId}
              onMouseDown={() => {
                onSelect(v)
                setQuery('')
                setResults([])
                setOpen(false)
              }}
              className="w-full text-left px-3 py-2.5 hover:bg-surface-subtle transition-colors border-b border-border-light last:border-0"
            >
              <p className="text-[13px] font-medium text-ink">{v.variantName}</p>
              <p className="text-xs text-ink-muted">{v.variantSku} · Hpp: Rp {v.costPrice.toLocaleString('id-ID')}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function CreatePOModal({ onClose, onSuccess }: CreatePOModalProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [supplierQuery, setSupplierQuery] = useState('')
  const [supplierOpen, setSupplierOpen] = useState(false)
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [supplierName, setSupplierName] = useState('')

  const [notes, setNotes] = useState('')
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load suppliers once
  useEffect(() => {
    apiGet<Supplier[]>('/api/v1/suppliers?active=true').then(res => {
      if (res.success && res.data) setSuppliers(res.data)
    })
  }, [])

  const filteredSuppliers = suppliers.filter(s =>
    s.name.toLowerCase().includes(supplierQuery.toLowerCase())
  )

  const selectSupplier = (s: Supplier) => {
    setSelectedSupplierId(s.id)
    setSupplierName(s.name)
    setSupplierQuery(s.name)
    setSupplierOpen(false)
  }

  const addVariant = (v: ProductVariant) => {
    // Prevent duplicate
    if (lineItems.some(i => i.variantId === v.variantId)) {
      setLineItems(prev => prev.map(i =>
        i.variantId === v.variantId ? { ...i, qty: i.qty + 1 } : i
      ))
      return
    }
    setLineItems(prev => [...prev, {
      id: String(Date.now()),
      variantId: v.variantId,
      variantSku: v.variantSku,
      variantName: v.variantName,
      qty: 1,
      unitCost: v.costPrice,
    }])
  }

  const removeItem = (id: string) => setLineItems(prev => prev.filter(i => i.id !== id))

  const updateItem = (id: string, field: 'qty' | 'unitCost', value: number) => {
    setLineItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i))
  }

  const subtotal = lineItems.reduce((sum, i) => sum + i.qty * i.unitCost, 0)

  const handleSubmit = async () => {
    setError(null)

    const finalSupplierName = supplierName.trim()
    if (!finalSupplierName) { setError('Pilih atau masukkan nama supplier'); return }
    if (lineItems.length === 0) { setError('Tambahkan minimal 1 produk'); return }
    if (lineItems.some(i => i.qty <= 0)) { setError('Qty semua item harus lebih dari 0'); return }

    setSubmitting(true)
    try {
      const res = await authFetch('/api/v1/procurement/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierName: finalSupplierName,
          supplierId: selectedSupplierId ?? undefined,
          notes: notes.trim() || undefined,
          items: lineItems.map(i => ({
            variantId: i.variantId,
            variantSku: i.variantSku,
            variantName: i.variantName,
            qty: i.qty,
            unitCost: i.unitCost,
          })),
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        onSuccess()
        onClose()
      } else {
        setError(data.error || 'Gagal membuat Purchase Order')
      }
    } catch {
      setError('Terjadi kesalahan jaringan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 animate-in fade-in overflow-y-auto">
      <Card className="w-full max-w-2xl p-6 animate-in scale-95 duration-200 my-8">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-ink">Buat Purchase Order</h2>
          <button onClick={onClose} className="text-ink-muted hover:text-ink"><X size={18} /></button>
        </div>

        <div className="space-y-4 mb-5">
          {/* Supplier */}
          <div className="relative">
            <label className="text-sm font-medium text-ink block mb-1.5">Supplier *</label>
            <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-transparent focus-within:ring-2 focus-within:ring-brand">
              <input
                type="text"
                placeholder="Pilih dari daftar atau ketik nama baru..."
                value={supplierQuery}
                onChange={e => {
                  setSupplierQuery(e.target.value)
                  setSupplierName(e.target.value)
                  setSelectedSupplierId(null)
                  setSupplierOpen(true)
                }}
                onFocus={() => setSupplierOpen(true)}
                onBlur={() => setTimeout(() => setSupplierOpen(false), 150)}
                className="flex-1 text-sm bg-transparent outline-none text-ink placeholder:text-ink-faint"
              />
              {selectedSupplierId && (
                <span className="text-xs text-success font-medium">✓ Terdaftar</span>
              )}
            </div>
            {supplierOpen && filteredSuppliers.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-surface-raised border border-border rounded-lg shadow-lg overflow-hidden max-h-40 overflow-y-auto">
                {filteredSuppliers.map(s => (
                  <button
                    key={s.id}
                    onMouseDown={() => selectSupplier(s)}
                    className="w-full text-left px-3 py-2.5 hover:bg-surface-subtle transition-colors border-b border-border-light last:border-0 text-[13px] text-ink"
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            )}
            {!selectedSupplierId && supplierName.trim() && (
              <p className="text-xs text-ink-muted mt-1">Supplier baru (tidak terdaftar)</p>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-ink block mb-1.5">Catatan</label>
            <textarea
              placeholder="Catatan tambahan untuk PO ini"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-transparent text-ink"
              rows={2}
            />
          </div>

          {/* Product search */}
          <div>
            <label className="text-sm font-medium text-ink block mb-1.5">Tambah Produk *</label>
            <VariantSearchInput onSelect={addVariant} />
          </div>

          {/* Line items */}
          {lineItems.length > 0 && (
            <div>
              <div className="grid grid-cols-[1fr_64px_96px_28px] gap-2 px-2 mb-1">
                <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Produk</span>
                <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Qty</span>
                <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Hpp/unit</span>
                <span />
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {lineItems.map(item => (
                  <div key={item.id} className="grid grid-cols-[1fr_64px_96px_28px] gap-2 items-center p-2 bg-surface-subtle rounded-lg">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">{item.variantName}</p>
                      <p className="text-xs text-ink-muted font-mono">{item.variantSku}</p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={item.qty}
                      onChange={e => updateItem(item.id, 'qty', parseInt(e.target.value) || 1)}
                      className="w-full text-center text-[13px] border border-border rounded-md px-1 py-1 focus:outline-none focus:ring-2 focus:ring-brand bg-transparent text-ink tabular-nums"
                    />
                    <input
                      type="number"
                      min={0}
                      value={item.unitCost}
                      onChange={e => updateItem(item.id, 'unitCost', parseFloat(e.target.value) || 0)}
                      className="w-full text-center text-[13px] border border-border rounded-md px-1 py-1 focus:outline-none focus:ring-2 focus:ring-brand bg-transparent text-ink tabular-nums"
                    />
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-ink-faint hover:text-danger transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Subtotal */}
          {lineItems.length > 0 && (
            <div className="flex justify-end pt-1 border-t border-border">
              <p className="text-sm text-ink-muted">
                Subtotal: <span className="font-semibold text-ink">{formatRp(subtotal)}</span>
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-sm text-danger mb-4">{error}</p>}

        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>Batal</Button>
          <Button onClick={handleSubmit} disabled={submitting || lineItems.length === 0}>
            {submitting && <Loader2 size={14} className="animate-spin mr-1.5" />}
            Buat PO
          </Button>
        </div>
      </Card>
    </div>
  )
}


/* ─── Main Page ─── */

export default function ProcurementPage() {
  const { user } = useAuth()
  const userRole = user?.role ?? 'Cashier'

  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [showCreatePO, setShowCreatePO] = useState(false)
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const loadData = useCallback(async () => {
    setLoading(true)
    const statusParam = statusFilter !== 'all' ? `&status=${statusFilter}` : ''
    const res = await apiGet<{ data: PurchaseOrder[]; total: number } | PurchaseOrder[]>(
      `/api/v1/procurement/purchase-orders?page=${page}${statusParam}`
    )
    if (res.success && res.data) {
      const list = Array.isArray(res.data)
        ? res.data
        : (res.data as { data: PurchaseOrder[] }).data || []
      setOrders(list)
      if (!Array.isArray(res.data) && (res.data as any).total) {
        setTotalPages(Math.ceil((res.data as any).total / 10))
      }
    }
    setLoading(false)
  }, [statusFilter, page])

  useEffect(() => { loadData() }, [loadData])

  const filtered = orders.filter(po => {
    if (!search) return true
    const q = search.toLowerCase()
    return po.poNumber.toLowerCase().includes(q) || po.supplierName.toLowerCase().includes(q)
  })

  return (
    <DashboardLayout>
      <PageHeader
        title="Procurement"
        subtitle="Purchase Order dan penerimaan barang"
        actions={
          (userRole === 'Owner' || userRole === 'Admin') ? (
            <Button icon={<Plus size={15} />} onClick={() => setShowCreatePO(true)}>Buat PO Baru</Button>
          ) : undefined
        }
      />

      <div className="flex items-center gap-3 animate-in stagger-2">
        <div className="flex-1">
          <Input
            icon={<Search size={16} />}
            placeholder="Cari nomor PO atau nama supplier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select
          label="Status:"
          options={STATUS_FILTER}
          value={statusFilter}
          onChange={v => { setStatusFilter(v); setPage(1) }}
        />
      </div>

      <Card padding={false} className="flex-1 flex flex-col overflow-hidden animate-in stagger-3">
        <div className="overflow-x-auto flex-1 flex flex-col">
          <div className="min-w-[700px] flex flex-col flex-1">
            <div className="grid grid-cols-[minmax(120px,1.5fr)_minmax(140px,2fr)_minmax(100px,1.3fr)_110px_100px_90px] items-center px-6 py-3 bg-surface-subtle border-b border-border gap-3">
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">No. PO</span>
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Supplier</span>
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Total</span>
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status</span>
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Tanggal</span>
              <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider text-right">Aksi</span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={24} className="text-ink-faint animate-spin" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-2">
                  <FileText size={32} className="text-ink-faint" />
                  <p className="text-sm font-medium text-ink-muted">Belum ada Purchase Order</p>
                </div>
              ) : filtered.map(po => (
                <div
                  key={po.id}
                  onClick={() => setSelectedPO(po)}
                  className="grid grid-cols-[minmax(120px,1.5fr)_minmax(140px,2fr)_minmax(100px,1.3fr)_110px_100px_90px] items-center px-6 py-3.5 border-b border-border-light hover:bg-surface-subtle transition-colors cursor-pointer gap-3"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-md bg-surface-subtle flex items-center justify-center flex-shrink-0 border border-border-light">
                      <FileText size={13} className="text-ink-faint" />
                    </div>
                    <span className="font-mono text-xs font-medium text-ink truncate">{po.poNumber}</span>
                  </div>
                  <span className="text-[13px] text-ink-secondary truncate min-w-0">{po.supplierName}</span>
                  <span className="text-[13px] font-medium text-ink tabular-nums">{formatRp(getTotal(po))}</span>
                  <div>
                    <Badge color={STATUS_COLORS[po.status] || 'neutral'}>{STATUS_LABELS[po.status] || po.status}</Badge>
                  </div>
                  <span className="text-[13px] text-ink-muted">{formatDate(po.createdAt)}</span>
                  <div className="flex justify-end">
                    <span className="text-xs text-brand font-medium">Detail →</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <span className="text-xs text-ink-muted">{filtered.length} Purchase Order</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-surface-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={14} className="text-ink-faint" />
            </button>
            <button className="w-8 h-8 rounded-md bg-brand text-white text-xs font-semibold flex items-center justify-center">{page}</button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-surface-subtle transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={14} className="text-ink-secondary" />
            </button>
          </div>
        </div>
      </Card>

      {showCreatePO && (
        <CreatePOModal
          onClose={() => setShowCreatePO(false)}
          onSuccess={loadData}
        />
      )}

      {selectedPO && (
        <PODetailModal
          po={selectedPO}
          userRole={userRole}
          onClose={() => setSelectedPO(null)}
          onRefresh={loadData}
        />
      )}
    </DashboardLayout>
  )
}
