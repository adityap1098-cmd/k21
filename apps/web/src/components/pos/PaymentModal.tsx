'use client'
import { useState, useMemo, useRef, useEffect } from 'react'
import { useCartStore, computeCartTotals } from '@/lib/store/cart.store'
import { useShiftStore } from '@/lib/store/shift.store'
import { useAuth } from '@/lib/auth'
import { ModalOverlay } from '@/components/ui/ModalOverlay'
import { offlineDB } from '@/lib/db/offline-db'
import { authFetch } from '@/lib/auth-fetch'
import type { ReceiptData } from '@/lib/receipt/encoder'

type PaymentMethod = 'CASH' | 'TRANSFER' | 'QRIS'

interface PaymentLeg {
  method: PaymentMethod
  amount: number
  reference: string
}

interface Props {
  isOpen: boolean
  total: number
  onSuccess: (transactionId: string, receiptData: ReceiptData) => void
  onClose: () => void
}

const QUICK_AMOUNTS = [50_000, 100_000, 200_000]

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: 'CASH', label: 'TUNAI' },
  { value: 'TRANSFER', label: 'TRANSFER' },
  { value: 'QRIS', label: 'QRIS' },
]

function MethodDropdown({ value, onChange }: { value: PaymentMethod; onChange: (v: PaymentMethod) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const selected = METHOD_OPTIONS.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative flex-1">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 border border-border rounded-lg bg-surface-raised text-sm text-ink cursor-pointer transition-colors hover:bg-surface-subtle"
      >
        <span className="font-medium">{selected?.label}</span>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-ink-muted flex-shrink-0" aria-hidden="true">
          <path d="M3 5L6 8L9 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-lg border border-border bg-surface-raised shadow-[0_4px_16px_rgba(0,0,0,0.2)] py-1">
          {METHOD_OPTIONS.map(o => (
            <button
              key={o.value}
              type="button"
              onClick={() => { onChange(o.value); setOpen(false) }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors outline-none ${
                o.value === value
                  ? 'bg-brand-muted text-brand font-medium'
                  : 'text-ink hover:bg-surface-subtle'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
}

function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('id-ID')
}

function parseCurrencyInput(formatted: string): number {
  return Number(formatted.replace(/\./g, '')) || 0
}

export function PaymentModal({ isOpen, total, onSuccess, onClose }: Props) {
  const { items, transactionDiscount, clearCart } = useCartStore()
  const { activeShift } = useShiftStore()
  const { user } = useAuth()

  // Store amounts as formatted strings for display, parse to numbers for logic
  const [legs, setLegs] = useState<PaymentLeg[]>([
    { method: 'CASH', amount: total, reference: '' },
  ])
  const [legAmountStrs, setLegAmountStrs] = useState<string[]>([formatCurrencyInput(String(total))])
  const [cashTenderedStr, setCashTenderedStr] = useState<string>(formatCurrencyInput(String(total)))
  const cashTendered = parseCurrencyInput(cashTenderedStr)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setLegs([{ method: 'CASH', amount: total, reference: '' }])
      setLegAmountStrs([formatCurrencyInput(String(total))])
      setCashTenderedStr(formatCurrencyInput(String(total)))
    }
  }, [isOpen, total])

  const legsTotal = useMemo(() => legs.reduce((sum, l) => sum + l.amount, 0), [legs])

  const cashLegIndex = legs.findIndex(l => l.method === 'CASH')
  const otherLegsTotal = legs.reduce((sum, l, i) => (i === cashLegIndex ? sum : sum + l.amount), 0)
  const cashOwed = Math.max(0, total - otherLegsTotal)
  const changeDue = cashLegIndex >= 0 ? Math.max(0, cashTendered - cashOwed) : 0

  const sumMismatch = Math.abs(legsTotal - total) > 0

  function updateLeg(index: number, patch: Partial<PaymentLeg>) {
    setLegs(prev => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  function updateLegAmount(index: number, rawValue: string) {
    const formatted = formatCurrencyInput(rawValue)
    const numeric = parseCurrencyInput(formatted)
    setLegAmountStrs(prev => prev.map((s, i) => (i === index ? formatted : s)))
    updateLeg(index, { amount: numeric })
  }

  function removeLeg(index: number) {
    setLegs(prev => prev.filter((_, i) => i !== index))
    setLegAmountStrs(prev => prev.filter((_, i) => i !== index))
  }

  function addLeg() {
    if (legs.length >= 3) return
    const remaining = Math.max(0, total - legsTotal)
    setLegs(prev => [...prev, { method: 'CASH', amount: remaining, reference: '' }])
    setLegAmountStrs(prev => [...prev, formatCurrencyInput(String(remaining))])
  }

  function handleQuickAmount(amount: number) {
    setCashTenderedStr(formatCurrencyInput(String(amount)))
    if (cashLegIndex >= 0) {
      const newCashAmount = Math.min(amount, cashOwed)
      updateLeg(cashLegIndex, { amount: newCashAmount })
      setLegAmountStrs(prev => prev.map((s, i) => (i === cashLegIndex ? formatCurrencyInput(String(newCashAmount)) : s)))
    }
  }

  async function handleConfirm() {
    if (sumMismatch || !activeShift) return
    setIsSubmitting(true)
    setError(null)

    try {
      const clientUuid = crypto.randomUUID()
      const { subtotal } = computeCartTotals(items, transactionDiscount)

      const saleItems = items.map(item => {
        const lineBase = item.unitPrice * item.qty
        const discountAmount =
          item.discountType === 'percent'
            ? Math.round(lineBase * (item.discountValue / 100))
            : item.discountValue
        const lineTotal = lineBase - discountAmount
        return {
          variantId: item.variantId,
          name: item.name, // carry name for receipt — no index mismatch risk
          qty: item.qty,
          unitPrice: item.unitPrice,
          discountAmount,
          lineTotal,
        }
      })

      const payments = legs.map(l => ({
        method: l.method,
        amount: Math.round(l.amount),
        reference: l.reference || undefined,
      }))

      const payload = {
        clientUuid,
        shiftId: activeShift.id,
        cashierId: activeShift.cashierId,
        subtotal,
        discountAmount: transactionDiscount,
        total,
        items: saleItems,
        payments,
      }

      const now = new Date()
      const dateTime = now.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })

      const receiptData: ReceiptData = {
        storeName: 'Teladan27 Motor',
        storeAddress: 'Jl. Budi No.2, Pasirkaliki, Kec. Cimahi Utara, Kota Bandung, Jawa Barat',
        storePhone: '+62 858-4622-2290',
        transactionId: clientUuid,
        dateTime,
        cashierName: user?.name || user?.email || 'Kasir',
        shiftId: activeShift.id,
        items: saleItems.map(si => ({
          name: si.name,
          qty: si.qty,
          unitPrice: si.unitPrice,
          discountAmount: si.discountAmount,
          lineTotal: si.lineTotal,
        })),
        subtotal,
        transactionDiscount,
        total,
        payments: payments.map(p => ({ method: p.method, amount: p.amount, reference: p.reference })),
        changeDue,
      }

      if (navigator.onLine) {
        const res = await authFetch('/api/v1/pos/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          const msg = (body as { error?: string; message?: string }).error
            ?? (body as { message?: string }).message
            ?? `HTTP ${res.status}`
          throw new Error(msg)
        }

        const body = (await res.json()) as { data: { id: string } }
        const transactionId = body.data.id
        clearCart()
        onSuccess(transactionId, { ...receiptData, transactionId })
      } else {
        await offlineDB.offlineQueue.add({
          clientUuid,
          status: 'pending',
          payload,
          createdAt: Date.now(),
        })
        clearCart()
        onSuccess(clientUuid, receiptData)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <ModalOverlay onClose={onClose} ariaLabel="Pembayaran">
      <div className="bg-surface-raised rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-ink">Pembayaran</h2>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink-secondary text-xl leading-none"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Total */}
          <div className="bg-surface rounded-lg p-3 text-center">
            <p className="text-sm text-ink-muted">Total Pembayaran</p>
            <p className="text-2xl font-bold text-ink">{formatRp(total)}</p>
          </div>

          {/* Payment legs */}
          {legs.map((leg, index) => (
            <div key={index} className="border border-border rounded-lg p-3 space-y-2">
              {/* Method selector */}
              <div className="flex items-center gap-2">
                <MethodDropdown
                  value={leg.method}
                  onChange={method => updateLeg(index, { method })}
                />
                {legs.length > 1 && (
                  <button
                    onClick={() => removeLeg(index)}
                    className="text-danger hover:text-red-700 text-sm"
                    aria-label="Hapus metode"
                  >
                    Hapus
                  </button>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs text-ink-muted mb-1">Jumlah</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">Rp</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={legAmountStrs[index] ?? ''}
                    onChange={e => updateLegAmount(index, e.target.value)}
                    onFocus={e => e.target.select()}
                    className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm bg-surface-raised text-ink outline-none font-mono"
                  />
                </div>
              </div>

              {/* Reference — only for TRANSFER */}
              {leg.method === 'TRANSFER' && (
                <div>
                  <label className="block text-xs text-ink-muted mb-1">Nama Bank / No. Referensi</label>
                  <input
                    type="text"
                    value={leg.reference}
                    onChange={e => updateLeg(index, { reference: e.target.value })}
                    placeholder="misal: BCA / 12345"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-surface-raised text-ink placeholder:text-ink-faint outline-none"
                  />
                  <p className="text-xs text-brand mt-1">
                    Masukkan nama bank dan nomor referensi, lalu klik Konfirmasi
                  </p>
                </div>
              )}

              {/* QRIS note */}
              {leg.method === 'QRIS' && (
                <p className="text-xs text-brand">
                  Minta pelanggan scan QR merchant, lalu klik Konfirmasi Pembayaran
                </p>
              )}

              {/* Cash tendered + quick select (first CASH leg only) */}
              {leg.method === 'CASH' && index === cashLegIndex && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-ink-muted mb-1">Uang Diterima</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-muted">Rp</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={cashTenderedStr}
                        onChange={e => setCashTenderedStr(formatCurrencyInput(e.target.value))}
                        onFocus={e => e.target.select()}
                        className="w-full border border-border rounded-lg pl-9 pr-3 py-2 text-sm bg-surface-raised text-ink outline-none font-mono"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {QUICK_AMOUNTS.map(amount => (
                      <button
                        key={amount}
                        onClick={() => handleQuickAmount(amount)}
                        className="flex-1 border border-border rounded-lg py-1.5 text-xs font-medium text-ink-secondary hover:bg-surface-subtle transition-colors"
                      >
                        Rp{(amount / 1000).toFixed(0)}rb
                      </button>
                    ))}
                  </div>
                  {changeDue > 0 && (
                    <div className="bg-success-muted rounded-lg p-2 text-center">
                      <p className="text-xs text-success">Kembalian</p>
                      <p className="text-lg font-bold text-success">{formatRp(changeDue)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Add payment leg */}
          {legs.length < 3 && (
            <button
              onClick={addLeg}
              className="w-full border-2 border-dashed border-border rounded-lg py-2 text-sm text-ink-muted hover:border-ink-faint"
            >
              + Tambah Metode Pembayaran
            </button>
          )}

          {/* Validation error */}
          {sumMismatch && (
            <p className="text-danger text-sm text-center">
              Total pembayaran ({formatRp(legsTotal)}) tidak sesuai dengan tagihan ({formatRp(total)})
            </p>
          )}

          {error && (
            <p className="text-danger text-sm text-center">{error}</p>
          )}

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || sumMismatch || !activeShift}
            className="w-full bg-brand text-white rounded-lg py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-hover"
          >
            {isSubmitting ? 'Memproses...' : 'Konfirmasi Pembayaran'}
          </button>
        </div>
      </div>
    </ModalOverlay>
  )
}
