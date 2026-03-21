'use client'

import { useState } from 'react'

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
      const res = await fetch(`/api/v1/service-orders/${orderId}/payments`, {
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Pembayaran Service</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-3 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Tagihan</span>
              <span className="font-medium text-gray-800">{formatRp(orderTotal)}</span>
            </div>
            {existingPaymentsTotal > 0 ? (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Sudah Dibayar</span>
                <span className="font-medium text-green-700">{formatRp(existingPaymentsTotal)}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-sm pt-1 border-t border-gray-200">
              <span className="font-medium text-gray-700">Sisa Tagihan</span>
              <span className="text-lg font-bold text-gray-900">{formatRp(remaining)}</span>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Jumlah Pembayaran</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className={`w-full border rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                overpayment ? 'border-red-400 bg-red-50' : 'border-gray-300'
              }`}
              min={0}
              max={remaining}
            />
            {overpayment ? (
              <p className="text-xs text-red-600 mt-1">Jumlah melebihi sisa tagihan ({formatRp(remaining)})</p>
            ) : null}
          </div>

          {/* Method selector */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Metode Pembayaran</label>
            <select
              value={method}
              onChange={e => setMethod(e.target.value as PaymentMethod)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="CASH">TUNAI</option>
              <option value="TRANSFER">TRANSFER</option>
              <option value="QRIS">QRIS</option>
            </select>
          </div>

          {/* Reference — for TRANSFER */}
          {method === 'TRANSFER' ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Referensi / No. Rekening</label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="BCA / 12345"
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : null}

          {/* QRIS note */}
          {method === 'QRIS' ? (
            <p className="text-xs text-blue-600">
              Minta pelanggan scan QR merchant, lalu klik Konfirmasi Pembayaran
            </p>
          ) : null}

          {/* Error */}
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-sm text-red-700 text-center">
              {error}
            </div>
          ) : null}

          {/* Success */}
          {successMsg ? (
            <div className="bg-green-50 border border-green-200 rounded p-2 text-sm text-green-700 text-center">
              {successMsg}
            </div>
          ) : null}

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || overpayment || amount <= 0}
            className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700 transition-colors"
          >
            {isSubmitting ? 'Memproses...' : 'Konfirmasi Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  )
}
