'use client'

import { useState, useEffect } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { useAuth } from '@/lib/auth'
import type { ReceiptData } from '@/lib/receipt/encoder'

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
  onSuccess: (receiptData: ReceiptData) => void
  onClose: () => void
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

const METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'CASH', label: 'Tunai' },
  { id: 'TRANSFER', label: 'Transfer' },
  { id: 'QRIS', label: 'QRIS' },
]

// ─── Store constants (same as retail) ───────────────────────────────────────
const STORE_NAME    = 'Teladan27 Motor'
const STORE_ADDRESS = 'Jl. Budi No.2, Pasirkaliki, Kec. Cimahi Utara, Kota Bandung, Jawa Barat'
const STORE_PHONE   = '+62 858-4622-2290'

export function ServicePaymentModal({ isOpen, orderId, orderTotal, existingPaymentsTotal, onSuccess, onClose }: Props) {
  const { user } = useAuth()
  const cashierDisplayName = user?.name || user?.email || 'Kasir'
  const remaining = orderTotal - existingPaymentsTotal

  const [amountStr, setAmountStr] = useState<string>('')
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [reference, setReference] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setAmountStr(remaining > 0 ? formatCurrencyInput(String(remaining)) : '')
      setMethod('CASH')
      setReference('')
      setError(null)
      setSuccessMsg(null)
    }
  }, [isOpen, remaining])

  const amount = parseCurrencyInput(amountStr)
  const overpayment = amount > remaining

  const handleConfirm = async () => {
    if (overpayment || amount <= 0 || isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    setSuccessMsg(null)

    try {
      const idempotencyKey = crypto.randomUUID()

      const res = await authFetch(`/api/v1/service-orders/${orderId}/payments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          method,
          reference: reference.trim() || undefined,
          idempotencyKey,
        }),
      })
      const body: ApiResponse<unknown> = await res.json()

      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
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

      // ─── Build receipt data ─────────────────────────────────────────────
      // Fetch order detail + items to build receipt
      try {
        const [orderRes, itemsRes] = await Promise.all([
          authFetch(`/api/v1/service-orders/${orderId}`),
          authFetch(`/api/v1/service-orders/${orderId}/items`),
        ])

        type OrderData = {
          orderNumber?: string
          mechanicId?: string | null
          complaint?: string | null
          createdAt?: string
          vehicle?: { plateNumber?: string; brand?: string; model?: string; customer?: { name?: string } } | null
        }
        type ItemData = { description: string; qty: number; unitPrice: number; lineTotal: number }[]

        const orderData: ApiResponse<OrderData> = await orderRes.json()
        const itemsData: ApiResponse<ItemData> = await itemsRes.json()

        const order = orderData.data
        const items = itemsData.data ?? []

        const dateTime = new Date().toLocaleString('id-ID', {
          day: '2-digit', month: '2-digit', year: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })

        const totalPaid = existingPaymentsTotal + amount
        const isPaidFull = totalPaid >= orderTotal

        // All payments including this one
        const allPaymentsRes = await authFetch(`/api/v1/service-orders/${orderId}`)
        const allPaymentsBody: ApiResponse<{ payments?: Array<{method: string; amount: number; reference?: string}> }> = await allPaymentsRes.json()

        // Build receipt data using same structure as retail
        const receiptData: ReceiptData = {
          storeName: STORE_NAME,
          storeAddress: STORE_ADDRESS,
          storePhone: STORE_PHONE,
          transactionId: order?.orderNumber ?? orderId,
          dateTime,
          cashierName: cashierDisplayName,
          shiftId: '',
          customerName: order?.vehicle?.customer?.name
            ?? (order?.vehicle?.plateNumber
              ? `${order.vehicle.plateNumber}${order.vehicle.brand ? ` — ${order.vehicle.brand}` : ''}`
              : undefined),
          items: items.map(i => ({
            name: i.description,
            qty: i.qty,
            unitPrice: i.unitPrice,
            discountAmount: 0,
            lineTotal: i.lineTotal,
          })),
          subtotal: orderTotal,
          transactionDiscount: 0,
          total: orderTotal,
          payments: [{
            method: method as 'CASH' | 'TRANSFER' | 'QRIS',
            amount,
            reference: reference.trim() || undefined,
          }],
          changeDue: isPaidFull && method === 'CASH' ? Math.max(0, amount - remaining) : 0,
        }

        setTimeout(() => {
          onSuccess(receiptData)
        }, 600)

      } catch {
        // If receipt build fails, still call onSuccess with minimal data
        const receiptData: ReceiptData = {
          storeName: STORE_NAME,
          storeAddress: STORE_ADDRESS,
          storePhone: STORE_PHONE,
          transactionId: orderId,
          dateTime: new Date().toLocaleString('id-ID'),
          cashierName: cashierDisplayName,
          shiftId: '',
          items: [],
          subtotal: orderTotal,
          transactionDiscount: 0,
          total: orderTotal,
          payments: [{ method, amount }],
          changeDue: 0,
        }
        setTimeout(() => onSuccess(receiptData), 600)
      }

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
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
            {existingPaymentsTotal > 0 && (
              <div className="flex justify-between text-[13px]">
                <span className="text-ink-muted">Sudah Dibayar</span>
                <span className="font-medium text-success font-mono">{formatRp(existingPaymentsTotal)}</span>
              </div>
            )}
            <div className="w-full h-px bg-border shrink-0" />
            <div className="flex justify-between items-center">
              <span className="font-medium text-ink text-[13px]">Sisa Tagihan</span>
              <span className="text-xl font-bold text-ink font-mono tracking-[-0.02em]">{formatRp(remaining)}</span>
            </div>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Jumlah Pembayaran</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[15px] font-mono font-semibold text-ink-muted">Rp</span>
              <input
                type="text"
                inputMode="numeric"
                value={amountStr}
                onChange={e => setAmountStr(formatCurrencyInput(e.target.value))}
                onFocus={e => e.target.select()}
                placeholder="0"
                className={`w-full bg-surface-raised border rounded-xl py-3 pl-12 pr-4 text-[15px] font-mono font-semibold text-ink text-center outline-none transition-colors ${
                  overpayment ? 'border-danger bg-danger-muted' : 'border-border'
                }`}
              />
            </div>
            {overpayment && (
              <p className="text-[12px] text-danger mt-1">Jumlah melebihi sisa tagihan ({formatRp(remaining)})</p>
            )}
          </div>

          {/* Method selector */}
          <div>
            <label className="block text-[13px] font-medium text-ink mb-1.5">Metode Pembayaran</label>
            <div className="flex items-center gap-1.5">
              {METHODS.map(m => (
                <button
                  key={m.id}
                  onClick={() => setMethod(m.id)}
                  className={`flex-1 flex items-center justify-center rounded-[20px] py-[7px] px-4 transition-colors ${
                    method === m.id
                      ? 'bg-brand text-white'
                      : 'bg-surface-subtle border border-border text-ink-secondary hover:bg-surface-raised hover:text-ink'
                  }`}
                >
                  <span className="font-medium text-[13px] leading-4">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Reference — for TRANSFER */}
          {method === 'TRANSFER' && (
            <div>
              <label className="block text-[13px] font-medium text-ink mb-1.5">Referensi / No. Rekening</label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                placeholder="BCA / 12345"
                className="w-full bg-surface-raised border border-border rounded-xl py-3 px-4 text-[13px] text-ink placeholder:text-ink-faint outline-none transition-colors"
              />
            </div>
          )}

          {/* QRIS note */}
          {method === 'QRIS' && (
            <p className="text-[13px] text-info">
              Minta pelanggan scan QR merchant, lalu klik Konfirmasi Pembayaran
            </p>
          )}

          {/* Error */}
          {error && (
            <div className="bg-danger-muted rounded-xl p-3 text-[13px] text-danger text-center">
              {error}
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div className="bg-success-muted rounded-xl p-3 text-[13px] text-success text-center">
              {successMsg}
            </div>
          )}

          {/* Confirm button */}
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
