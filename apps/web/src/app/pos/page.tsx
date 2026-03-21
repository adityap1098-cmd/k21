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
import { AppShell } from '@/components/layout/AppShell'
import { useAutoSyncCatalog } from '@/lib/catalog'
import { computeCartTotals, useCartStore } from '@/lib/store/cart.store'
import type { ReceiptData } from '@/lib/receipt/encoder'
import { TransactionTypeSelector } from '@/components/pos/service/TransactionTypeSelector'
import { ServiceFlow } from '@/components/pos/service/ServiceFlow'

export default function PosPage() {
  const { activeShift, setActiveShift } = useShiftStore()
  const { items, transactionDiscount } = useCartStore()
  const { total } = computeCartTotals(items, transactionDiscount)

  const [showShiftDrawer, setShowShiftDrawer] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [checkingShift, setCheckingShift] = useState(true)
  const [transactionType, setTransactionType] = useState<'RETAIL' | 'SERVICE'>('RETAIL')

  // Auto-sync product catalog from API to IndexedDB
  useAutoSyncCatalog()

  // Check for active shift on mount
  useEffect(() => {
    async function checkShift() {
      try {
        const { authFetch } = await import('@/lib/auth-fetch')
        const res = await authFetch('/api/v1/shifts/active')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) {
            setActiveShift(data.data)
          }
        }
      } catch { /* no active shift */ }
      setCheckingShift(false)
    }
    if (!activeShift) checkShift()
    else setCheckingShift(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cleanup = startSyncListener((_results) => {
      setIsSyncing(false)
    })
    return cleanup
  }, [])

  // Gate: loading shift check
  if (checkingShift) {
    return (
      <AppShell>
        <div className="flex h-screen items-center justify-center bg-surface">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  // Gate: show shift drawer if no active shift
  if (!activeShift) {
    return (
      <AppShell>
        <div className="flex h-screen items-center justify-center bg-surface">
          <div className="text-center animate-in">
            {/* Logo */}
            <div className="w-16 h-16 rounded-2xl bg-brand flex items-center justify-center mx-auto mb-6 shadow-[0_4px_20px_rgba(232,93,58,0.3)]">
              <span className="text-white font-bold text-2xl">K</span>
            </div>
            <h1 className="text-2xl font-bold mb-2 text-ink">Buka Shift untuk Mulai</h1>
            <p className="text-ink-muted mb-8 text-sm max-w-xs mx-auto">
              Kasir harus membuka shift sebelum melakukan transaksi POS
            </p>
            <button
              onClick={() => setShowShiftDrawer(true)}
              className="px-8 py-3.5 bg-brand text-white rounded-xl text-base font-semibold hover:bg-brand-hover transition-colors press-scale shadow-[0_2px_12px_rgba(232,93,58,0.3)]"
            >
              Buka Shift
            </button>
            <ShiftDrawer isOpen={showShiftDrawer} onClose={() => setShowShiftDrawer(false)} />
          </div>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell>
      <div className="flex flex-col h-screen bg-surface">
        <SyncStatusBar isSyncing={isSyncing} />
        <SyncIssuesPanel />

        <h1 className="sr-only">Point of Sale</h1>

        {/* Transaction type selector */}
        <div className="px-3 lg:px-4 pt-2 pb-1 shrink-0">
          <TransactionTypeSelector activeType={transactionType} onTypeChange={setTransactionType} />
        </div>

        {/* Conditional: Retail split-screen or Service flow */}
        {transactionType === 'RETAIL' ? (
          <div className="flex flex-1 overflow-hidden relative">
            {/* Product panel — left */}
            <div className="flex-1 overflow-hidden p-3 lg:p-4">
              <ProductPanel />
            </div>

            {/* Cart panel — right */}
            <div className="w-80 lg:w-96 border-l border-border bg-surface-raised flex flex-col flex-shrink-0">
              <CartPanel onPay={() => setShowPayment(true)} />
            </div>
          </div>
        ) : (
          <ServiceFlow />
        )}

        {/* Shift info — top-right overlay */}
        <div className="absolute top-2 right-2 z-20">
          <button
            onClick={() => setShowShiftDrawer(true)}
            className="flex items-center gap-2 text-xs font-medium text-ink-secondary bg-surface-raised/90 backdrop-blur-sm border border-border px-3 py-1.5 rounded-lg hover:bg-surface-subtle transition-colors shadow-sm"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            Shift: {activeShift.id.slice(0, 8)}
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
    </AppShell>
  )
}
