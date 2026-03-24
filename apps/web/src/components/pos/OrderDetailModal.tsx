'use client'

import { useEffect, useState, useCallback } from 'react'
import { apiGet, apiPatch, apiPost } from '@/lib/api'
import { ReturnModal } from './ReturnModal'

function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID')
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/* ── Retail transaction detail ── */

interface RetailTransactionDetail {
  id: string
  clientUuid: string
  subtotal: number
  discountAmount: number
  total: number
  status: 'COMPLETED' | 'VOIDED'
  note: string | null
  voidReason: string | null
  createdAt: string
  items: Array<{
    id: string
    variant_id: string
    qty: number
    unit_price: number
    discount_amount: number
    line_total: number
    product_name: string
    sku: string
  }>
  payments: Array<{
    id: string
    method: 'CASH' | 'TRANSFER' | 'QRIS'
    amount: number
    reference: string | null
  }>
}

/* ── Service order detail ── */

interface ServiceOrderDetail {
  id: string
  orderNumber: string
  workStatus: string
  paymentStatus: string
  mechanicId: string | null
  complaint: string | null
  estimatedCost: number | null
  kilometer: number | null
  createdAt: string
  completedAt: string | null
  vehicle: {
    plateNumber: string
    brand: string
    model: string
    customer: { name: string; phone: string }
  }
  items: Array<{
    id: string
    itemType: 'SERVICE' | 'PART'
    description: string
    qty: number
    unitPrice: number
    lineTotal: number
  }>
  payments: Array<{
    id: string
    method: 'CASH' | 'TRANSFER' | 'QRIS'
    amount: number
    reference: string | null
    paidAt: string
  }>
}

interface OrderDetailModalProps {
  isOpen: boolean
  orderId: string | null
  orderType: 'RETAIL' | 'SERVICE'
  onClose: () => void
  onUpdated?: () => void
}

export function OrderDetailModal({ isOpen, orderId, orderType, onClose, onUpdated }: OrderDetailModalProps) {
  const [retailDetail, setRetailDetail] = useState<RetailTransactionDetail | null>(null)
  const [serviceDetail, setServiceDetail] = useState<ServiceOrderDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [editingNote, setEditingNote] = useState(false)
  const [noteValue, setNoteValue] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [voidMode, setVoidMode] = useState(false)
  const [voidReason, setVoidReason] = useState('')
  const [voiding, setVoiding] = useState(false)
  const [showReturn, setShowReturn] = useState(false)

  const fetchDetail = useCallback(async () => {
    if (!orderId) return
    setLoading(true)
    setRetailDetail(null)
    setServiceDetail(null)

    try {
      if (orderType === 'RETAIL') {
        const res = await apiGet<RetailTransactionDetail>(`/api/v1/pos/transactions/${orderId}`)
        if (res.success && res.data) {
          setRetailDetail(res.data)
          setNoteValue(res.data.note || '')
        }
      } else {
        // Service order: fetch order + items
        const [orderRes, itemsRes] = await Promise.all([
          apiGet<ServiceOrderDetail>(`/api/v1/service-orders/${orderId}`),
          apiGet<ServiceOrderDetail['items']>(`/api/v1/service-orders/${orderId}/items`),
        ])
        if (orderRes.success && orderRes.data) {
          const raw = orderRes.data as unknown as Record<string, unknown>
          const detail: ServiceOrderDetail = {
            id: raw.id as string,
            orderNumber: raw.orderNumber as string,
            workStatus: raw.workStatus as string,
            paymentStatus: raw.paymentStatus as string,
            mechanicId: raw.mechanicId as string | null,
            complaint: raw.complaint as string | null,
            estimatedCost: raw.estimatedCost as number | null,
            kilometer: raw.kilometer as number | null,
            createdAt: raw.createdAt as string,
            completedAt: raw.completedAt as string | null,
            vehicle: (raw.vehicle as ServiceOrderDetail['vehicle']) || { plateNumber: '-', brand: '', model: '', customer: { name: '-', phone: '' } },
            items: [],
            payments: (raw.payments as ServiceOrderDetail['payments']) || [],
          }
          if (itemsRes.success && itemsRes.data) {
            detail.items = itemsRes.data as ServiceOrderDetail['items']
          }
          setServiceDetail(detail)
        }
      }
    } catch {
      // silent
    }
    setLoading(false)
  }, [orderId, orderType])

  useEffect(() => {
    if (isOpen && orderId) {
      fetchDetail()
      setEditingNote(false)
      setVoidMode(false)
      setVoidReason('')
    }
  }, [isOpen, orderId, fetchDetail])

  const handleSaveNote = async () => {
    if (!orderId) return
    setSavingNote(true)
    try {
      await apiPatch(`/api/v1/pos/transactions/${orderId}/note`, { note: noteValue })
      setEditingNote(false)
      fetchDetail()
      onUpdated?.()
    } catch {
      // silent
    }
    setSavingNote(false)
  }

  const handleVoid = async () => {
    if (!orderId || !voidReason.trim()) return
    setVoiding(true)
    try {
      await apiPost(`/api/v1/pos/transactions/${orderId}/void`, { reason: voidReason })
      setVoidMode(false)
      fetchDetail()
      onUpdated?.()
    } catch {
      // silent
    }
    setVoiding(false)
  }

  if (!isOpen) return null

  const isRetail = orderType === 'RETAIL'
  const detail = isRetail ? retailDetail : serviceDetail

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-surface-raised rounded-xl border border-border shadow-xl w-[480px] max-h-[85vh] overflow-hidden flex flex-col animate-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold leading-3 ${
                isRetail ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {isRetail ? 'RETAIL' : 'SERVICE'}
              </span>
              <span className="text-ink font-bold text-[15px] leading-5">Detail Transaksi</span>
            </div>
            {isRetail && retailDetail && (
              <span className="text-ink-muted text-[11px] leading-3 font-mono">
                #{retailDetail.id.slice(0, 8)} · {formatDateTime(retailDetail.createdAt)}
              </span>
            )}
            {!isRetail && serviceDetail && (
              <span className="text-ink-muted text-[11px] leading-3 font-mono">
                {serviceDetail.orderNumber} · {formatDateTime(serviceDetail.createdAt)}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center size-8 rounded-lg hover:bg-surface transition-colors text-ink-muted"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : isRetail && retailDetail ? (
            <RetailDetailContent
              detail={retailDetail}
              editingNote={editingNote}
              noteValue={noteValue}
              savingNote={savingNote}
              onEditNote={() => setEditingNote(true)}
              onNoteChange={setNoteValue}
              onSaveNote={handleSaveNote}
              onCancelNote={() => { setEditingNote(false); setNoteValue(retailDetail.note || '') }}
            />
          ) : !isRetail && serviceDetail ? (
            <ServiceDetailContent detail={serviceDetail} />
          ) : (
            <div className="text-center py-12 text-ink-faint text-sm">Gagal memuat data</div>
          )}
        </div>

        {/* Footer actions — only for RETAIL (void + return) */}
        {isRetail && retailDetail && retailDetail.status !== 'VOIDED' && (
          <div className="border-t border-border px-5 py-3 shrink-0">
            {voidMode ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Alasan void..."
                  className="w-full px-3 py-2 text-[12px] border border-red-200 rounded-lg bg-surface text-ink placeholder:text-ink-faint focus:outline-none focus:ring-1 focus:ring-red-400"
                  autoFocus
                />
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setVoidMode(false); setVoidReason('') }}
                    className="px-3 py-1.5 text-[11px] font-medium text-ink-muted hover:text-ink transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleVoid}
                    disabled={voiding || !voidReason.trim()}
                    className="px-3 py-1.5 text-[11px] font-medium text-white bg-red-500 rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    {voiding ? 'Memproses...' : 'Konfirmasi Void'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <button
                  onClick={() => setShowReturn(true)}
                  className="flex-1 py-2 text-[12px] font-medium text-amber-600 border border-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  Retur Barang
                </button>
                <button
                  onClick={() => setVoidMode(true)}
                  className="flex-1 py-2 text-[12px] font-medium text-red-500 border border-red-200 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                >
                  Void Transaksi
                </button>
              </div>
            )}
          </div>
        )}

        {/* Return Modal */}
        {isRetail && retailDetail && (
          <ReturnModal
            isOpen={showReturn}
            transactionId={orderId}
            items={retailDetail.items}
            onClose={() => setShowReturn(false)}
            onSuccess={() => {
              setShowReturn(false)
              fetchDetail()
              onUpdated?.()
            }}
          />
        )}
      </div>
    </div>
  )
}

/* ── RETAIL detail content ── */

function RetailDetailContent({
  detail,
  editingNote, noteValue, savingNote,
  onEditNote, onNoteChange, onSaveNote, onCancelNote,
}: {
  detail: RetailTransactionDetail
  editingNote: boolean; noteValue: string; savingNote: boolean
  onEditNote: () => void; onNoteChange: (v: string) => void
  onSaveNote: () => void; onCancelNote: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      {/* Status badge */}
      {detail.status === 'VOIDED' && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
          <span className="text-red-600 text-xs font-medium">
            VOID — {detail.voidReason || 'Tidak ada alasan'}
          </span>
        </div>
      )}

      {/* Items table */}
      <div>
        <span className="text-ink-muted text-[11px] leading-3 uppercase tracking-wider font-semibold">Item</span>
        <div className="mt-2 border border-border rounded-lg overflow-hidden">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-surface text-ink-muted">
                <th className="text-left font-medium px-3 py-2">Produk</th>
                <th className="text-center font-medium px-2 py-2 w-12">Qty</th>
                <th className="text-right font-medium px-3 py-2 w-24">Harga</th>
                <th className="text-right font-medium px-3 py-2 w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((item) => (
                <tr key={item.id} className="border-t border-border-light">
                  <td className="px-3 py-2">
                    <div className="text-ink font-medium truncate max-w-[160px]">{item.product_name}</div>
                    <div className="text-ink-muted text-[10px] font-mono">{item.sku}</div>
                  </td>
                  <td className="text-center px-2 py-2 text-ink font-mono">{item.qty}</td>
                  <td className="text-right px-3 py-2 text-ink font-mono">{formatRupiah(item.unit_price)}</td>
                  <td className="text-right px-3 py-2 text-ink font-mono font-medium">{formatRupiah(item.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payments */}
      <PaymentsList payments={detail.payments} />

      {/* Totals */}
      <div className="border-t border-border pt-3 flex flex-col gap-1.5">
        <div className="flex justify-between text-[12px]">
          <span className="text-ink-muted">Subtotal</span>
          <span className="text-ink font-mono">{formatRupiah(detail.subtotal)}</span>
        </div>
        {detail.discountAmount > 0 && (
          <div className="flex justify-between text-[12px]">
            <span className="text-ink-muted">Diskon</span>
            <span className="text-[#2D8F5E] font-mono">- {formatRupiah(detail.discountAmount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[14px] font-semibold">
          <span className="text-ink">Total</span>
          <span className="text-ink font-mono">{formatRupiah(detail.total)}</span>
        </div>
      </div>

      {/* Note / Keterangan */}
      <div className="border-t border-border pt-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-ink-muted text-[11px] leading-3 uppercase tracking-wider font-semibold">Keterangan</span>
          {!editingNote && detail.status !== 'VOIDED' && (
            <button onClick={onEditNote} className="text-brand text-[11px] font-medium hover:text-brand-hover transition-colors">
              {detail.note ? 'Edit' : 'Tambah'}
            </button>
          )}
        </div>
        {editingNote ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={noteValue}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder="Tambah keterangan..."
              rows={2}
              maxLength={500}
              className="w-full px-3 py-2 text-[12px] border border-border rounded-lg bg-surface text-ink placeholder:text-ink-faint resize-none focus:outline-none focus:ring-1 focus:ring-brand"
            />
            <div className="flex gap-2 justify-end">
              <button onClick={onCancelNote} className="px-3 py-1.5 text-[11px] font-medium text-ink-muted hover:text-ink transition-colors">Batal</button>
              <button onClick={onSaveNote} disabled={savingNote} className="px-3 py-1.5 text-[11px] font-medium text-white bg-brand rounded-md hover:bg-brand-hover disabled:opacity-50 transition-colors">
                {savingNote ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-ink text-[12px] leading-5">
            {detail.note || <span className="text-ink-faint italic">Tidak ada keterangan</span>}
          </p>
        )}
      </div>
    </div>
  )
}

/* ── SERVICE detail content ── */

function ServiceDetailContent({ detail }: { detail: ServiceOrderDetail }) {
  const itemsTotal = detail.items?.reduce((sum, i) => sum + i.lineTotal, 0) ?? 0
  const paidTotal = detail.payments?.reduce((sum, p) => sum + p.amount, 0) ?? 0
  const remaining = itemsTotal - paidTotal

  return (
    <div className="flex flex-col gap-4">
      {/* Vehicle & customer info */}
      <div className="flex flex-col gap-1.5 px-3 py-2.5 bg-surface rounded-lg border border-border-light">
        {detail.vehicle && detail.vehicle.plateNumber !== '-' && (
          <div className="flex justify-between text-[12px]">
            <span className="text-ink-muted">Kendaraan</span>
            <span className="text-ink font-medium">
              {detail.vehicle.plateNumber} — {detail.vehicle.brand} {detail.vehicle.model}
            </span>
          </div>
        )}
        {detail.vehicle?.customer?.name && detail.vehicle.customer.name !== '-' && (
          <div className="flex justify-between text-[12px]">
            <span className="text-ink-muted">Customer</span>
            <span className="text-ink font-medium">{detail.vehicle.customer.name}</span>
          </div>
        )}
        {detail.mechanicId && (
          <div className="flex justify-between text-[12px]">
            <span className="text-ink-muted">Mekanik</span>
            <span className="text-ink font-medium">{detail.mechanicId}</span>
          </div>
        )}
        {detail.kilometer != null && (
          <div className="flex justify-between text-[12px]">
            <span className="text-ink-muted">KM</span>
            <span className="text-ink font-mono">{detail.kilometer.toLocaleString('id-ID')} km</span>
          </div>
        )}
        {detail.complaint && (
          <div className="flex justify-between text-[12px]">
            <span className="text-ink-muted shrink-0 mr-3">Keluhan</span>
            <span className="text-ink text-right">{detail.complaint}</span>
          </div>
        )}
      </div>

      {/* Status badges */}
      <div className="flex gap-2">
        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-semibold ${
          detail.workStatus === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' :
          detail.workStatus === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
          'bg-amber-100 text-amber-700'
        }`}>
          {detail.workStatus}
        </span>
        <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-semibold ${
          detail.paymentStatus === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
          detail.paymentStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-700' :
          'bg-red-100 text-red-700'
        }`}>
          {detail.paymentStatus === 'PAID' ? 'Lunas' :
           detail.paymentStatus === 'PARTIAL' ? 'Sebagian' : 'Belum Bayar'}
        </span>
      </div>

      {/* Items table */}
      {detail.items && detail.items.length > 0 && (
        <div>
          <span className="text-ink-muted text-[11px] leading-3 uppercase tracking-wider font-semibold">Item Pekerjaan</span>
          <div className="mt-2 border border-border rounded-lg overflow-hidden">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-surface text-ink-muted">
                  <th className="text-left font-medium px-3 py-2">Deskripsi</th>
                  <th className="text-center font-medium px-1 py-2 w-14">Tipe</th>
                  <th className="text-center font-medium px-2 py-2 w-10">Qty</th>
                  <th className="text-right font-medium px-3 py-2 w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id} className="border-t border-border-light">
                    <td className="px-3 py-2 text-ink font-medium truncate max-w-[160px]">{item.description}</td>
                    <td className="text-center px-1 py-2">
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded ${
                        item.itemType === 'SERVICE' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {item.itemType === 'SERVICE' ? 'JASA' : 'PART'}
                      </span>
                    </td>
                    <td className="text-center px-2 py-2 text-ink font-mono">{item.qty}</td>
                    <td className="text-right px-3 py-2 text-ink font-mono font-medium">{formatRupiah(item.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payments */}
      {detail.payments && detail.payments.length > 0 && (
        <PaymentsList payments={detail.payments} />
      )}

      {/* Totals */}
      <div className="border-t border-border pt-3 flex flex-col gap-1.5">
        <div className="flex justify-between text-[14px] font-semibold">
          <span className="text-ink">Total</span>
          <span className="text-ink font-mono">{formatRupiah(itemsTotal)}</span>
        </div>
        {paidTotal > 0 && (
          <div className="flex justify-between text-[12px]">
            <span className="text-ink-muted">Sudah Dibayar</span>
            <span className="text-[#2D8F5E] font-mono">{formatRupiah(paidTotal)}</span>
          </div>
        )}
        {remaining > 0 && (
          <div className="flex justify-between text-[12px]">
            <span className="text-ink-muted">Sisa</span>
            <span className="text-red-500 font-mono font-medium">{formatRupiah(remaining)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Shared payments list ── */

function PaymentsList({ payments }: { payments: Array<{ id: string; method: string; amount: number; reference?: string | null }> }) {
  return (
    <div>
      <span className="text-ink-muted text-[11px] leading-3 uppercase tracking-wider font-semibold">Pembayaran</span>
      <div className="mt-2 flex flex-col gap-1.5">
        {payments.map((p) => (
          <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-surface rounded-lg">
            <span className="text-ink text-[12px] font-medium">{p.method}</span>
            <span className="text-ink font-mono text-[12px] font-medium">{formatRupiah(p.amount)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
