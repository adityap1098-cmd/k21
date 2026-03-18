'use client'

import { useEffect, useState } from 'react'
import { useShiftStore } from '@/lib/store/shift.store'
import { startSyncListener } from '@/lib/sync-manager'
import { ProductPanel } from '@/components/pos/ProductPanel'
import { CartPanel } from '@/components/pos/CartPanel'
import { PaymentModal } from '@/components/pos/PaymentModal'
import { ReceiptModal } from '@/components/pos/ReceiptModal'
import { ShiftDrawer } from '@/components/pos/ShiftDrawer'
import { SyncStatusBar } from '@/components/pos/SyncStatusBar'
import { SyncIssuesPanel } from '@/components/pos/SyncIssuesPanel'
import { computeCartTotals, useCartStore } from '@/lib/store/cart.store'
import type { ReceiptData } from '@/lib/receipt/encoder'

export default function PosPage() {
  const { activeShift } = useShiftStore()
  const { items, transactionDiscount } = useCartStore()
  const { total } = computeCartTotals(items, transactionDiscount)

  const [showShiftDrawer, setShowShiftDrawer] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)

  // Register sync listener
  useEffect(() => {
    const cleanup = startSyncListener((_results) => {
      setIsSyncing(false)
    })
    return cleanup
  }, [])

  // Gate: show shift drawer if no active shift
  if (!activeShift) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-gray-900">Buka Shift untuk Mulai</h1>
          <p className="text-gray-500 mb-6 text-sm">Kasir harus membuka shift sebelum melakukan transaksi</p>
          <button
            onClick={() => setShowShiftDrawer(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg text-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Buka Shift
          </button>
          <ShiftDrawer isOpen={showShiftDrawer} onClose={() => setShowShiftDrawer(false)} />
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <SyncStatusBar isSyncing={isSyncing} />

      {/* Conflicts panel — fixed right overlay */}
      <SyncIssuesPanel />

      {/* Split screen */}
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 overflow-hidden p-4">
          <ProductPanel />
        </div>
        <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
          <CartPanel onPay={() => setShowPayment(true)} />
        </div>
      </div>

      {/* Shift info header — top-right overlay */}
      <div className="absolute top-0 right-0 p-2 z-20">
        <button
          onClick={() => setShowShiftDrawer(true)}
          className="text-sm text-gray-600 hover:text-gray-900 underline bg-white/80 px-2 py-1 rounded"
        >
          Shift: {activeShift.id.slice(0, 8)} — Tutup
        </button>
      </div>

      <ShiftDrawer isOpen={showShiftDrawer} onClose={() => setShowShiftDrawer(false)} />

      <PaymentModal
        isOpen={showPayment}
        total={total}
        onSuccess={(txId, receipt) => {
          setShowPayment(false)
          setReceiptData(receipt)
        }}
        onClose={() => setShowPayment(false)}
      />

      <ReceiptModal
        isOpen={receiptData !== null}
        receiptData={receiptData}
        onClose={() => setReceiptData(null)}
      />
    </div>
  )
}
