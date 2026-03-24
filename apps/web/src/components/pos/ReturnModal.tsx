'use client'

import { useState, useEffect, useCallback } from 'react'
import { apiGet, apiPost } from '@/lib/api'

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
}

interface TransactionItem {
  id: string
  variant_id: string
  qty: number
  unit_price: number
  discount_amount: number
  line_total: number
  product_name: string
  sku: string
}

interface ExistingReturn {
  id: string
  variantId: string
  qty: number
  refundAmount: number
  reason: string
  createdAt: string
  productName?: string
  variantName?: string
}

interface ReturnLineItem {
  variantId: string
  productName: string
  sku: string
  originalQty: number
  returnedQty: number // already returned
  maxReturnable: number
  unitPrice: number
  returnQty: number // user input
  selected: boolean
}

interface Props {
  isOpen: boolean
  transactionId: string | null
  items: TransactionItem[]
  onClose: () => void
  onSuccess: () => void
}

export function ReturnModal({ isOpen, transactionId, items, onClose, onSuccess }: Props) {
  const [lines, setLines] = useState<ReturnLineItem[]>([])
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existingReturns, setExistingReturns] = useState<ExistingReturn[]>([])
  const [loadingReturns, setLoadingReturns] = useState(false)

  const fetchExistingReturns = useCallback(async () => {
    if (!transactionId) return
    setLoadingReturns(true)
    try {
      const res = await apiGet<ExistingReturn[]>(`/api/v1/pos/transactions/${transactionId}/returns`)
      if (res.success && res.data) {
        setExistingReturns(res.data)
      }
    } catch {
      // silent
    }
    setLoadingReturns(false)
  }, [transactionId])

  useEffect(() => {
    if (isOpen && transactionId && items.length > 0) {
      fetchExistingReturns()
    }
  }, [isOpen, transactionId, items, fetchExistingReturns])

  // Build lines after existing returns are loaded
  useEffect(() => {
    if (!isOpen || items.length === 0) return

    const returnedMap: Record<string, number> = {}
    existingReturns.forEach(r => {
      returnedMap[r.variantId] = (returnedMap[r.variantId] || 0) + r.qty
    })

    const newLines: ReturnLineItem[] = items.map(item => {
      const alreadyReturned = returnedMap[item.variant_id] || 0
      const maxReturnable = item.qty - alreadyReturned
      return {
        variantId: item.variant_id,
        productName: item.product_name,
        sku: item.sku,
        originalQty: item.qty,
        returnedQty: alreadyReturned,
        maxReturnable,
        unitPrice: item.unit_price,
        returnQty: maxReturnable > 0 ? 1 : 0,
        selected: false,
      }
    })

    setLines(newLines)
    setReason('')
    setError(null)
  }, [isOpen, items, existingReturns])

  if (!isOpen || !transactionId) return null

  const selectedLines = lines.filter(l => l.selected && l.returnQty > 0)
  const totalRefund = selectedLines.reduce((sum, l) => {
    const effectivePrice = l.unitPrice
    return sum + effectivePrice * l.returnQty
  }, 0)

  const toggleLine = (variantId: string) => {
    setLines(prev => prev.map(l =>
      l.variantId === variantId ? { ...l, selected: !l.selected } : l
    ))
  }

  const updateReturnQty = (variantId: string, qty: number) => {
    setLines(prev => prev.map(l =>
      l.variantId === variantId
        ? { ...l, returnQty: Math.max(1, Math.min(qty, l.maxReturnable)) }
        : l
    ))
  }

  const handleSubmit = async () => {
    if (selectedLines.length === 0) {
      setError('Pilih minimal 1 item untuk diretur')
      return
    }
    if (!reason.trim()) {
      setError('Alasan retur harus diisi')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const payload = {
        items: selectedLines.map(l => ({
          variantId: l.variantId,
          qty: l.returnQty,
          refundAmount: l.unitPrice * l.returnQty,
        })),
        reason: reason.trim(),
      }

      const res = await apiPost(`/api/v1/pos/transactions/${transactionId}/return`, payload)
      if (!res.success) {
        setError(res.error || 'Gagal memproses retur')
        return
      }

      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setSubmitting(false)
    }
  }

  const hasReturnableItems = lines.some(l => l.maxReturnable > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-surface-raised rounded-xl border border-border shadow-xl w-[520px] max-h-[85vh] overflow-hidden flex flex-col animate-in">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
          <div>
            <h2 className="text-ink font-bold text-[15px]">Retur Barang</h2>
            <p className="text-ink-muted text-[11px] font-mono mt-0.5">
              #{transactionId.slice(0, 8).toUpperCase()}
            </p>
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
          {loadingReturns ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !hasReturnableItems ? (
            <div className="text-center py-8">
              <p className="text-ink-muted text-sm">Semua item sudah diretur sepenuhnya</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Existing returns info */}
              {existingReturns.length > 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  <p className="text-amber-700 dark:text-amber-400 text-[11px] font-medium">
                    {existingReturns.length} item sudah pernah diretur sebelumnya
                  </p>
                </div>
              )}

              {/* Item selection */}
              <div>
                <span className="text-ink-muted text-[11px] uppercase tracking-wider font-semibold">Pilih Item Retur</span>
                <div className="mt-2 border border-border rounded-lg overflow-hidden divide-y divide-border-light">
                  {lines.map(line => {
                    const isDisabled = line.maxReturnable <= 0
                    return (
                      <div
                        key={line.variantId}
                        className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                          isDisabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-surface-subtle cursor-pointer'
                        } ${line.selected ? 'bg-brand/5' : ''}`}
                        onClick={() => !isDisabled && toggleLine(line.variantId)}
                      >
                        {/* Checkbox */}
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                          line.selected ? 'bg-brand border-brand' : 'border-border'
                        }`}>
                          {line.selected && (
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        {/* Item info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-medium text-ink truncate">{line.productName}</p>
                          <p className="text-[10px] text-ink-muted font-mono">
                            {line.sku} · {formatRp(line.unitPrice)} · Beli: {line.originalQty}
                            {line.returnedQty > 0 && (
                              <span className="text-amber-600"> · Sudah retur: {line.returnedQty}</span>
                            )}
                          </p>
                        </div>

                        {/* Qty input */}
                        {!isDisabled && line.selected && (
                          <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                            <button
                              onClick={() => updateReturnQty(line.variantId, line.returnQty - 1)}
                              className="size-6 rounded bg-surface border border-border text-[11px] text-ink flex items-center justify-center hover:bg-surface-subtle"
                            >−</button>
                            <span className="text-[12px] font-mono font-medium text-ink w-6 text-center">{line.returnQty}</span>
                            <button
                              onClick={() => updateReturnQty(line.variantId, line.returnQty + 1)}
                              className="size-6 rounded bg-surface border border-border text-[11px] text-ink flex items-center justify-center hover:bg-surface-subtle"
                            >+</button>
                            <span className="text-[10px] text-ink-muted ml-1">/ {line.maxReturnable}</span>
                          </div>
                        )}

                        {/* Refund amount */}
                        {!isDisabled && line.selected && (
                          <span className="text-[12px] font-mono font-medium text-red-500 shrink-0">
                            {formatRp(line.unitPrice * line.returnQty)}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-ink-muted text-[11px] uppercase tracking-wider font-semibold">
                  Alasan Retur
                </label>
                <textarea
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Contoh: Barang cacat, salah ambil ukuran, dll..."
                  rows={2}
                  maxLength={500}
                  className="w-full mt-2 px-3 py-2 text-[12px] border border-border rounded-lg bg-surface text-ink placeholder:text-ink-faint resize-none focus:outline-none focus:ring-1 focus:ring-brand"
                />
              </div>

              {/* Error */}
              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                  <p className="text-red-600 dark:text-red-400 text-[12px]">{error}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {hasReturnableItems && !loadingReturns && (
          <div className="border-t border-border px-5 py-3 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[12px] text-ink-muted">Total Refund</span>
              <span className="text-[15px] font-bold font-mono text-red-500">{formatRp(totalRefund)}</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="flex-1 py-2 text-[12px] font-medium text-ink-muted border border-border rounded-lg hover:bg-surface-subtle transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting || selectedLines.length === 0}
                className="flex-1 py-2 text-[12px] font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Memproses...' : `Proses Retur (${selectedLines.length} item)`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
