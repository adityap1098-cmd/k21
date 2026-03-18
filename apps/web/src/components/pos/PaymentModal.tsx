'use client'
import { useState, useMemo } from 'react'
import { useCartStore, computeCartTotals } from '@/lib/store/cart.store'
import { useShiftStore } from '@/lib/store/shift.store'
import { offlineDB } from '@/lib/db/offline-db'
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

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
}

export function PaymentModal({ isOpen, total, onSuccess, onClose }: Props) {
  const { items, transactionDiscount, clearCart } = useCartStore()
  const { activeShift } = useShiftStore()

  const [legs, setLegs] = useState<PaymentLeg[]>([
    { method: 'CASH', amount: total, reference: '' },
  ])
  const [cashTendered, setCashTendered] = useState<number>(total)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const legsTotal = useMemo(() => legs.reduce((sum, l) => sum + l.amount, 0), [legs])

  const cashLegIndex = legs.findIndex(l => l.method === 'CASH')
  const otherLegsTotal = legs.reduce((sum, l, i) => (i === cashLegIndex ? sum : sum + l.amount), 0)
  const cashOwed = Math.max(0, total - otherLegsTotal)
  const changeDue = cashLegIndex >= 0 ? Math.max(0, cashTendered - cashOwed) : 0

  const sumMismatch = Math.abs(legsTotal - total) > 0

  function updateLeg(index: number, patch: Partial<PaymentLeg>) {
    setLegs(prev => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))
  }

  function removeLeg(index: number) {
    setLegs(prev => prev.filter((_, i) => i !== index))
  }

  function addLeg() {
    if (legs.length >= 3) return
    const remaining = Math.max(0, total - legsTotal)
    setLegs(prev => [...prev, { method: 'CASH', amount: remaining, reference: '' }])
  }

  function handleQuickAmount(amount: number) {
    setCashTendered(amount)
    if (cashLegIndex >= 0) {
      const newCashAmount = Math.min(amount, cashOwed)
      updateLeg(cashLegIndex, { amount: newCashAmount })
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
          qty: item.qty,
          unitPrice: item.unitPrice,
          discountAmount,
          lineTotal,
        }
      })

      const payments = legs.map(l => ({
        method: l.method,
        amount: l.amount,
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
        storeName: 'K21 Store',
        transactionId: clientUuid,
        dateTime,
        cashierName: activeShift.cashierId,
        shiftId: activeShift.id,
        items: saleItems.map((si, i) => ({
          name: items[i].name,
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
        const res = await fetch('/api/v1/pos/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error((body as { message?: string }).message ?? `HTTP ${res.status}`)
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">Pembayaran</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-xl leading-none"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Total */}
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <p className="text-sm text-gray-500">Total Pembayaran</p>
            <p className="text-2xl font-bold text-gray-900">{formatRp(total)}</p>
          </div>

          {/* Payment legs */}
          {legs.map((leg, index) => (
            <div key={index} className="border rounded-lg p-3 space-y-2">
              {/* Method selector */}
              <div className="flex items-center gap-2">
                <select
                  value={leg.method}
                  onChange={e => updateLeg(index, { method: e.target.value as PaymentMethod })}
                  className="flex-1 border rounded px-2 py-1 text-sm"
                >
                  <option value="CASH">TUNAI</option>
                  <option value="TRANSFER">TRANSFER</option>
                  <option value="QRIS">QRIS</option>
                </select>
                {legs.length > 1 && (
                  <button
                    onClick={() => removeLeg(index)}
                    className="text-red-500 hover:text-red-700 text-sm"
                    aria-label="Hapus metode"
                  >
                    Hapus
                  </button>
                )}
              </div>

              {/* Amount */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Jumlah</label>
                <input
                  type="number"
                  value={leg.amount}
                  onChange={e => updateLeg(index, { amount: Number(e.target.value) })}
                  className="w-full border rounded px-2 py-1 text-sm"
                  min={0}
                />
              </div>

              {/* Reference — only for TRANSFER */}
              {leg.method === 'TRANSFER' && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nama Bank / No. Referensi</label>
                  <input
                    type="text"
                    value={leg.reference}
                    onChange={e => updateLeg(index, { reference: e.target.value })}
                    placeholder="misal: BCA / 12345"
                    className="w-full border rounded px-2 py-1 text-sm"
                  />
                  <p className="text-xs text-blue-600 mt-1">
                    Masukkan nama bank dan nomor referensi, lalu klik Konfirmasi
                  </p>
                </div>
              )}

              {/* QRIS note */}
              {leg.method === 'QRIS' && (
                <p className="text-xs text-blue-600">
                  Minta pelanggan scan QR merchant, lalu klik Konfirmasi Pembayaran
                </p>
              )}

              {/* Cash tendered + quick select (first CASH leg only) */}
              {leg.method === 'CASH' && index === cashLegIndex && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Uang Diterima</label>
                    <input
                      type="number"
                      value={cashTendered}
                      onChange={e => setCashTendered(Number(e.target.value))}
                      className="w-full border rounded px-2 py-1 text-sm"
                      min={0}
                    />
                  </div>
                  <div className="flex gap-2">
                    {QUICK_AMOUNTS.map(amount => (
                      <button
                        key={amount}
                        onClick={() => handleQuickAmount(amount)}
                        className="flex-1 border rounded py-1 text-xs font-medium hover:bg-gray-50"
                      >
                        Rp{(amount / 1000).toFixed(0)}rb
                      </button>
                    ))}
                  </div>
                  {changeDue > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded p-2 text-center">
                      <p className="text-xs text-green-700">Kembalian</p>
                      <p className="text-lg font-bold text-green-700">{formatRp(changeDue)}</p>
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
              className="w-full border-2 border-dashed border-gray-300 rounded-lg py-2 text-sm text-gray-500 hover:border-gray-400"
            >
              + Tambah Metode Pembayaran
            </button>
          )}

          {/* Validation error */}
          {sumMismatch && (
            <p className="text-red-600 text-sm text-center">
              Total pembayaran ({formatRp(legsTotal)}) tidak sesuai dengan tagihan ({formatRp(total)})
            </p>
          )}

          {error && (
            <p className="text-red-600 text-sm text-center">{error}</p>
          )}

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={isSubmitting || sumMismatch || !activeShift}
            className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-blue-700"
          >
            {isSubmitting ? 'Memproses...' : 'Konfirmasi Pembayaran'}
          </button>
        </div>
      </div>
    </div>
  )
}
