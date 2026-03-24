'use client'

import { useEffect, useState } from 'react'
import { useShiftStore } from '@/lib/store/shift.store'
import { startSyncListener } from '@/lib/sync-manager'
import { ProductPanel } from '@/components/pos/ProductPanel'
import { PaymentModal } from '@/components/pos/PaymentModal'
import { ReceiptModal } from '@/components/pos/ReceiptModal'
import { ShiftDrawer } from '@/components/pos/ShiftDrawer'
import { SyncStatusBar } from '@/components/pos/SyncStatusBar'
import { SyncIssuesPanel } from '@/components/pos/SyncIssuesPanel'
import { TransactionTable } from '@/components/pos/TransactionTable'
import { OrderDetailModal } from '@/components/pos/OrderDetailModal'
import { CashTransactionModal } from '@/components/pos/CashTransactionModal'
import { AppShell } from '@/components/layout/AppShell'
import { Sidebar } from '@/components/layout/Sidebar'
import { useAutoSyncCatalog } from '@/lib/catalog'
import { useCartStore, computeCartTotals, type CartItem } from '@/lib/store/cart.store'
import type { ReceiptData } from '@/lib/receipt/encoder'
import { T27Logo } from '@/components/ui/Logo'
import dynamic from 'next/dynamic'

const ServiceFlow = dynamic(
  () => import('@/components/pos/service/ServiceFlow').then(m => ({ default: m.ServiceFlow })),
  { ssr: false, loading: () => <div className="flex-1 flex items-center justify-center"><div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" /></div> }
)

import {
  Timer,
  Banknote,
  Hash,
  ShoppingCart,
  Wrench,
  Clock,
  CreditCard,
  Wallet,
} from 'lucide-react'

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
}

/* ══════════════════════════════════════════
   CompactCart — stacked below ProductPanel
   ══════════════════════════════════════════ */
function CompactCart({ onPay }: { onPay: () => void }) {
  const { items, transactionDiscount, updateQty, removeItem, clearCart } = useCartStore()
  const { total } = computeCartTotals(items, transactionDiscount)
  const isEmpty = items.length === 0

  return (
    <div className="flex flex-col shrink-0 bg-surface-raised border-t border-border/40">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs font-bold text-ink tracking-wide">KERANJANG</span>
        {!isEmpty && (
          <button onClick={clearCart} className="text-brand text-[11px] font-medium hover:text-brand-hover transition-colors">
            Hapus semua
          </button>
        )}
      </div>

      {/* Items */}
      <div className="overflow-y-auto max-h-[130px] px-4">
        {isEmpty ? (
          <div className="text-center py-4 text-ink-faint text-xs">Keranjang kosong</div>
        ) : (
          items.map((item: CartItem) => {
            const lineBase = item.unitPrice * item.qty
            const itemDisc = item.discountType === 'percent'
              ? lineBase * (item.discountValue / 100)
              : item.discountValue
            const lineTotal = lineBase - itemDisc
            return (
              <div key={item.variantId} className="flex items-center py-2 gap-2.5 border-b border-border-light last:border-b-0">
                <span className="text-ink font-mono text-xs shrink-0 font-semibold">{item.qty}x</span>
                <span className="text-ink text-xs font-medium flex-1 truncate">{item.name}</span>
                <span className="font-mono text-xs text-ink shrink-0 font-semibold">{formatRp(lineTotal)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => item.qty <= 1 ? removeItem(item.variantId) : updateQty(item.variantId, item.qty - 1)}
                    className="size-5 rounded bg-surface border border-border text-[10px] text-ink flex items-center justify-center hover:bg-surface-subtle transition-colors"
                  >−</button>
                  <button
                    onClick={() => updateQty(item.variantId, item.qty + 1)}
                    className="size-5 rounded bg-surface border border-border text-[10px] text-ink flex items-center justify-center hover:bg-surface-subtle transition-colors"
                  >+</button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Total + Buttons */}
      <div className="px-4 pt-2 pb-2.5 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-ink">Total</span>
          <span className="text-sm font-bold font-mono text-ink">{formatRp(total)}</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={clearCart}
            disabled={isEmpty}
            className="flex items-center justify-center gap-1.5 flex-1 rounded-lg py-2 bg-surface border border-border text-ink-secondary font-medium text-xs hover:bg-surface-subtle disabled:opacity-30 transition-all"
          >
            Kosongkan
          </button>
          <button
            disabled={isEmpty}
            onClick={onPay}
            className="flex items-center justify-center gap-1.5 flex-1 rounded-lg py-2 bg-brand text-white font-semibold text-xs hover:bg-brand-hover disabled:opacity-40 transition-all shadow-sm"
          >
            <CreditCard size={14} />
            Bayar
          </button>
        </div>
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════
   Main POS Page
   ══════════════════════════════════════════ */
export default function PosPage() {
  const { activeShift, setActiveShift } = useShiftStore()
  const { items, transactionDiscount } = useCartStore()
  const { total } = computeCartTotals(items, transactionDiscount)

  const [showShiftDrawer, setShowShiftDrawer] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [checkingShift, setCheckingShift] = useState(true)
  const [orderRefreshKey, setOrderRefreshKey] = useState(0)

  // Order detail modal
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
  const [selectedOrderType, setSelectedOrderType] = useState<'RETAIL' | 'SERVICE'>('RETAIL')
  const [showCashTx, setShowCashTx] = useState(false)

  // Live shift duration
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  useAutoSyncCatalog()

  useEffect(() => {
    async function checkShift() {
      try {
        const { authFetch } = await import('@/lib/auth-fetch')
        const res = await authFetch('/api/v1/shifts/active')
        if (res.ok) {
          const data = await res.json()
          if (data.success && data.data) setActiveShift(data.data)
        }
      } catch {}
      setCheckingShift(false)
    }
    if (!activeShift) checkShift()
    else setCheckingShift(false)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const cleanup = startSyncListener((_results) => { setIsSyncing(false) }, () => { setIsSyncing(true) })
    return cleanup
  }, [])

  const shiftDuration = activeShift
    ? (() => {
        const ms = now.getTime() - new Date(activeShift.openedAt).getTime()
        const h = Math.floor(ms / 3600000)
        const m = Math.floor((ms % 3600000) / 60000)
        return h > 0 ? `${h}j ${m}m` : `${m}m`
      })()
    : null

  // Gates
  if (checkingShift) {
    return (
      <AppShell><div className="flex h-screen overflow-hidden bg-surface"><Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
        </div>
      </div></AppShell>
    )
  }

  if (!activeShift) {
    return (
      <AppShell><div className="flex h-screen overflow-hidden bg-surface"><Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center text-center animate-in">
            <div className="mb-4"><T27Logo size={80} variant="dark" /></div>
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
      </div></AppShell>
    )
  }

  const shortShiftId = activeShift.id.slice(0, 8).toUpperCase()

  return (
    <AppShell>
      <div className="flex h-screen overflow-hidden bg-surface">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          <div className="sr-only"><SyncStatusBar isSyncing={isSyncing} /></div>
          <SyncIssuesPanel />
          <h1 className="sr-only">Point of Sale</h1>

          {/* ═══ SHIFT BAR (compact, 1 baris) ═══ */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-surface-raised shrink-0">
            <div className="flex items-center gap-2.5 overflow-x-auto no-scrollbar">
              <div className="flex items-center gap-1.5 bg-success/10 text-success px-3 py-1.5 rounded-lg shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                <span className="text-xs font-semibold">Shift Aktif</span>
              </div>
              <div className="flex items-center gap-1.5 bg-surface-subtle px-3 py-1.5 rounded-lg text-ink-secondary shrink-0">
                <Timer size={13} />
                <span className="text-xs font-medium">{shiftDuration}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-surface-subtle px-3 py-1.5 rounded-lg text-ink-secondary shrink-0">
                <Banknote size={13} />
                <span className="text-xs font-medium">Modal: {formatRp(activeShift.openingFloat)}</span>
              </div>
              <div className="flex items-center gap-1.5 bg-surface-subtle px-3 py-1.5 rounded-lg text-ink-secondary shrink-0">
                <Hash size={13} />
                <span className="text-xs font-mono font-medium">#{shortShiftId}</span>
              </div>
            </div>
            <div className="flex items-center gap-2.5 shrink-0 ml-3">
              <div className="flex items-center rounded-lg py-1.5 px-2.5 gap-1.5 bg-[#2D8F5E1A]">
                <span className="w-[5px] h-[5px] rounded-sm bg-[#2D8F5E]" />
                <span className="text-[#2D8F5E] font-medium text-[11px]">Online</span>
              </div>
              <button
                onClick={() => setShowCashTx(true)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary bg-surface border border-border px-3 py-1.5 rounded-lg hover:bg-surface-subtle transition-colors"
              >
                <Wallet size={13} />
                Kas
              </button>
              <button
                onClick={() => setShowShiftDrawer(true)}
                className="flex items-center gap-1.5 text-[11px] font-medium text-ink-secondary bg-surface border border-border px-3 py-1.5 rounded-lg hover:bg-surface-subtle transition-colors"
              >
                <Clock size={13} />
                Shift
              </button>
            </div>
          </div>

          {/* ═══ MAIN: Left (POS Retail) | Right (Service Bengkel) ═══ */}
          <div className="flex flex-1 overflow-hidden min-h-0 gap-2 p-2 bg-surface-subtle">

            {/* ── LEFT: POS RETAIL ── */}
            <div className="flex flex-col w-1/2 rounded-xl overflow-hidden bg-surface">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-2.5 shrink-0 bg-surface-raised rounded-t-xl">
                <ShoppingCart size={16} className="text-brand" />
                <span className="text-sm font-bold text-ink tracking-wide">POS RETAIL</span>
              </div>

              {/* Product search + results (scrollable) */}
              <div className="flex-1 overflow-hidden p-3 flex flex-col min-h-0">
                <ProductPanel />
              </div>

              {/* Keranjang (stacked below) */}
              <CompactCart onPay={() => setShowPayment(true)} />
            </div>

            {/* ── RIGHT: SERVICE BENGKEL ── */}
            <div className="flex flex-col w-1/2 rounded-xl overflow-hidden bg-surface">
              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-2.5 shrink-0 bg-surface-raised rounded-t-xl">
                <Wrench size={16} className="text-success" />
                <span className="text-sm font-bold text-ink tracking-wide">SERVICE BENGKEL</span>
              </div>

              {/* ServiceFlow (compact) — full end-to-end: form → order → items → payment → receipt */}
              <div className="flex-1 overflow-hidden">
                <ServiceFlow
                  compact
                  onTransactionComplete={() => setOrderRefreshKey(k => k + 1)}
                />
              </div>
            </div>
          </div>

          {/* ═══ BOTTOM: TRANSAKSI TERAKHIR (table) ═══ */}
          <div className="shrink-0 h-[280px] flex flex-col overflow-hidden mx-2 mb-2 rounded-xl bg-surface">
            <div className="flex items-center gap-2 px-4 py-2.5 shrink-0 bg-surface-raised rounded-t-xl">
              <span className="text-xs font-bold text-ink tracking-wide">TRANSAKSI TERAKHIR</span>
            </div>
            <div className="flex-1 overflow-y-auto">
              <TransactionTable
                shiftId={activeShift?.id}
                onPrintReceipt={(id, type) => { setSelectedOrderId(id); setSelectedOrderType(type) }}
                refreshKey={orderRefreshKey}
              />
            </div>
          </div>

          {/* ═══ MODALS ═══ */}
          <ShiftDrawer isOpen={showShiftDrawer} onClose={() => setShowShiftDrawer(false)} />

          <PaymentModal
            isOpen={showPayment}
            total={total}
            onSuccess={(txId, receipt) => {
              setShowPayment(false)
              setReceiptData(receipt)
              setOrderRefreshKey(k => k + 1)
            }}
            onClose={() => setShowPayment(false)}
          />

          <ReceiptModal
            isOpen={receiptData !== null}
            receiptData={receiptData}
            onClose={() => setReceiptData(null)}
          />

          <CashTransactionModal
            isOpen={showCashTx}
            onClose={() => setShowCashTx(false)}
            shiftId={activeShift?.id}
          />

          <OrderDetailModal
            isOpen={selectedOrderId !== null}
            orderId={selectedOrderId}
            orderType={selectedOrderType}
            onClose={() => setSelectedOrderId(null)}
            onUpdated={() => setOrderRefreshKey(k => k + 1)}
          />
        </div>
      </div>
    </AppShell>
  )
}
