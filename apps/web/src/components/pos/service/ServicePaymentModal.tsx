'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/auth-fetch'

type PaymentMethod = 'CASH' | 'TRANSFER' | 'QRIS'

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

interface Props {
  isOpen: boolean
  orderId: string
  orderTotal: number
  existingPaymentsTotal: number
  onSuccess: () => void
  onClose: () => void
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
}

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'CASH', label: 'Tunai' },
  { id: 'TRANSFER', label: 'Transfer' },
  { id: 'QRIS', label: 'QRIS' },
]

export function ServicePaymentModal({ isOpen, orderId, orderTotal, existingPaymentsTotal, onSuccess, onClose }: Props) {
  const remaining = orderTotal - existingPaymentsTotal

  const [amount, setAmount] = useState<number>(remaining)
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [reference, setReference] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  const overpayment = amount > remaining

  const handleConfirm = async () => {
    if (overpayment || amount <= 0 || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const res = await authFetch(`/api/v1/service-orders/${orderId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          method,
          reference: reference.trim() || undefined,
        }),
      })
      const body: ApiResponse<unknown> = await res.json()
      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        console.error('[ServicePaymentModal] Payment failed:', { orderId, status: res.status, error: msg })

        // Map known backend errors to user-friendly messages
        if (msg.includes('OVERPAYMENT') || msg.toLowerCase().includes('overpayment')) {
          setError('Jumlah melebihi sisa tagihan')
        } else if (msg.includes('ORDER_NOT_COMPLETED') || msg.toLowerCase().includes('not completed')) {
          setError('Order belum selesai — tidak bisa menerima pembayaran')
        } else {
          setError(msg)
        }
        return
      }
      setSuccessMsg('Pembayaran berhasil dicatat')
      // Brief delay to show success, then close
      setTimeout(() => {
        onSuccess()
      }, 800)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[ServicePaymentModal] Payment error:', { orderId, error: msg })
      setError(msg)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" data-testid="service-payment-modal">
      <div className="bg-surface-raised rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-[17px] font-semibold text-ink tracking-[-0.02em]">Pembayaran Service</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center size-8 rounded-lg text-ink-muted hover:text-ink hover:bg-surface-subtle transition-colors"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Summary */}
          <div className="bg-surface-subtle rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-[13px]">
              <span className="text-ink-muted">Total Tagihan</span>
              <span className="font-medium text-ink font-mono">{formatRp(orderTotal)}</span>
            </div>
            {existingPaymentsTotal > 0 ? (
              <div className="flex justify-between text-[13px]">
                <span className="text-ink-muted">Sudah Dibayar</span>
                <span className="font-medium text-success font-mono">{formatRp(existingPaymentsTotal)}</span>
              </div>
            ) : null}
            <div className="w-full h-px bg-border shrink-0" />
            <div className="flex justify-between items-center">
              <span className="font-medium text-ink text-[13px]">Sisa Tagihan</span>
              <span className="text-xl font-bold text-ink font-mono tracking-[-0.02em]">{formatRp(remaining)}</span>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Jumlah Pembayaran</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className={`w-full bg-surface-raised border rounded-xl py-3 px-4 text-[15px] font-mono font-semibold text-ink text-center outline-none focus:ring-2 focus:ring-brand-subtle transition-colors ${
                overpayment ? 'border-danger bg-danger-muted' : 'border-border focus:border-brand'
              }`}
              min={0}
              max={remaining}
            />
            {overpayment ? (
              <p className="text-[12px] text-danger mt-1">Jumlah melebihi sisa tagihan ({formatRp(remaining)})</p>
            ) : null}
          </div>

          {/* Method selector — pill buttons */}
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Metode Pembayaran</label>
            <div className="flex items-center gap-1.5">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex-1 flex items-center justify-center rounded-[20px] py-[7px] px-4 transition-colors ${
                    method === m.id
                      ? 'bg-ink text-white'
                      : 'bg-surface-raised border border-border text-ink hover:bg-surface-subtle'
                  }`}
                >
                  <span className="font-medium text-[13px] leading-4">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reference — for TRANSFER */}
          {method === 'TRANSFER' ? (
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1.5">Referensi / No. Rekening</label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="BCA / 12345"
                className="w-full bg-surface-raised border border-border rounded-xl py-3 px-4 text-[13px] text-ink placeholder:text-ink-faint outline-none focus:border-brand focus:ring-2 focus:ring-brand-subtle transition-colors"
              />
            </div>
          ) : null}

          {/* QRIS note */}
          {method === 'QRIS' ? (
            <p className="text-[13px] text-info">
              Minta pelanggan scan QR merchant, lalu klik Konfirmasi Pembayaran
            </p>
          ) : null}

          {/* Error */}
          {error ? (
            <div className="bg-danger-muted rounded-xl p-3 text-[13px] text-danger text-center">
              {error}
            </div>
          ) : null}

          {/* Success */}
          {successMsg ? (
            <div className="bg-success-muted rounded-xl p-3 text-[13px] text-success text-center">
              {successMsg}
            </div>
          ) : null}

          {/* Confirm button — full-width brand, matching CartPanel pay button */}
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || overpayment || amount <= 0}
            className="flex items-center justify-center w-full rounded-xl py-3.5 bg-brand text-white font-semibold text-[15px] leading-[18px] hover:bg-brand-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all press-scale"
          >
            {isSubmitting ? 'Memproses...' : `Konfirmasi Pembayaran ${formatRp(amount)}`}
          </button>
        </div>
      </div>
    </div>
  )
}
