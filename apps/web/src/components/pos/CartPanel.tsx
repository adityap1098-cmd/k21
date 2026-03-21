'use client'

import { useCartStore, computeCartTotals, type CartItem } from '@/lib/store/cart.store'

function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID')
}

/* ── SVG Icons ── */

function CartProductIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="4" y="5" width="12" height="11" rx="1.5" stroke="#7A8490" strokeWidth="1.2" />
      <path d="M7 5V4C7 2.9 7.9 2 9 2H11C12.1 2 13 2.9 13 4V5" stroke="#7A8490" strokeWidth="1.2" />
    </svg>
  )
}

function CreditCardIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <rect x="2" y="4" width="14" height="10" rx="2" stroke="#FFFFFF" strokeWidth="1.5" />
      <path d="M2 8H16" stroke="#FFFFFF" strokeWidth="1.5" />
    </svg>
  )
}

/* ── Cart Item Row ── */

function CartItemRow({
  item,
  onUpdateQty,
  onRemove,
}: {
  item: CartItem
  onUpdateQty: (variantId: string, qty: number) => void
  onRemove: (variantId: string) => void
}) {
  const lineBase = item.unitPrice * item.qty
  const itemDisc = item.discountType === 'percent'
    ? lineBase * (item.discountValue / 100)
    : item.discountValue
  const lineTotal = lineBase - itemDisc

  return (
    <div className="flex items-center py-3.5 gap-3 border-b border-border-light">
      {/* Product icon */}
      <div className="flex items-center justify-center shrink-0 rounded-[10px] bg-surface size-11">
        <CartProductIcon />
      </div>

      {/* Name + unit price */}
      <div className="flex flex-col grow shrink basis-0 gap-0.5 min-w-0">
        <span className="text-ink font-medium text-[13px] leading-4 truncate">{item.name}</span>
        <span className="text-ink-muted font-mono text-xs leading-4">{formatRupiah(item.unitPrice)}</span>
      </div>

      {/* Qty controls */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => {
            if (item.qty <= 1) {
              onRemove(item.variantId)
            } else {
              onUpdateQty(item.variantId, item.qty - 1)
            }
          }}
          className="flex items-center justify-center size-7 rounded-[7px] bg-surface border border-border text-ink font-medium text-sm leading-[18px] hover:bg-border-light active:scale-95 transition-all"
          aria-label={`Kurangi ${item.name}`}
        >
          −
        </button>
        <span className="w-[18px] text-center text-ink font-mono font-medium text-[13px] leading-4">
          {item.qty}
        </span>
        <button
          onClick={() => onUpdateQty(item.variantId, item.qty + 1)}
          className="flex items-center justify-center size-7 rounded-[7px] bg-surface border border-border text-ink font-medium text-sm leading-[18px] hover:bg-border-light active:scale-95 transition-all"
          aria-label={`Tambah ${item.name}`}
        >
          +
        </button>
      </div>

      {/* Line total */}
      <span className="w-16 text-right text-ink font-mono font-semibold shrink-0 text-[13px] leading-4">
        {formatRupiah(lineTotal)}
      </span>
    </div>
  )
}

/* ── Main CartPanel ── */

interface CartPanelProps {
  onPay: () => void
}

export function CartPanel({ onPay }: CartPanelProps) {
  const {
    items,
    transactionDiscount,
    updateQty,
    removeItem,
    clearCart,
  } = useCartStore()

  const { subtotal, total } = computeCartTotals(items, transactionDiscount)

  // Compute total item discounts for display
  const itemDiscountTotal = items.reduce((sum: number, item: CartItem) => {
    const lineBase = item.unitPrice * item.qty
    const d = item.discountType === 'percent'
      ? lineBase * (item.discountValue / 100)
      : item.discountValue
    return sum + d
  }, 0)

  const discountDisplay = transactionDiscount + itemDiscountTotal
  const isEmpty = items.length === 0

  return (
    <div className="flex flex-col h-full bg-surface-raised border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between pt-5 pb-4 px-6 shrink-0">
        <div className="flex items-center gap-2">
          <span className="tracking-[-0.02em] text-ink font-bold text-[17px] leading-[22px]">Keranjang</span>
          {!isEmpty && (
            <span className="flex items-center justify-center min-w-[22px] h-[22px] rounded-full px-1.5 bg-brand">
              <span className="text-white font-semibold text-[11px] leading-[14px]">{items.length}</span>
            </span>
          )}
        </div>
        {!isEmpty && (
          <button
            onClick={clearCart}
            className="text-brand font-medium text-[13px] leading-4 hover:text-brand-hover transition-colors"
          >
            Hapus
          </button>
        )}
      </div>

      {/* Cart items */}
      <div className="flex-1 overflow-y-auto px-6">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-ink-faint gap-3">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect x="10" y="14" width="28" height="24" rx="3" stroke="currentColor" strokeWidth="1.5" />
              <path d="M16 14V11C16 7.13 19.13 4 23 4H25C28.87 4 32 7.13 32 11V14" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span className="text-sm">Keranjang kosong</span>
          </div>
        ) : (
          items.map((item: CartItem) => (
            <CartItemRow
              key={item.variantId}
              item={item}
              onUpdateQty={updateQty}
              onRemove={removeItem}
            />
          ))
        )}
      </div>

      {/* Footer totals */}
      <div className="flex flex-col pt-4 pb-3 gap-3 border-t border-border px-6 shrink-0">
        <div className="flex items-center justify-between">
          <span className="text-ink-muted text-[13px] leading-4">Subtotal</span>
          <span className="text-ink font-mono font-medium text-[13px] leading-4">
            {formatRupiah(subtotal + itemDiscountTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-ink-muted text-[13px] leading-4">Diskon</span>
          <span className="text-[#2D8F5E] font-mono font-medium text-[13px] leading-4">
            - {formatRupiah(discountDisplay)}
          </span>
        </div>
        {/* Divider */}
        <div className="w-full h-px bg-border shrink-0" />
        <div className="flex items-center justify-between">
          <span className="text-ink font-semibold text-[15px] leading-[18px]">Total</span>
          <span className="tracking-[-0.02em] text-ink font-mono font-bold text-xl leading-6">
            {formatRupiah(total)}
          </span>
        </div>
      </div>

      {/* Pay button */}
      <div className="px-6 pb-6 shrink-0">
        <button
          disabled={isEmpty}
          onClick={onPay}
          className="flex items-center justify-center w-full rounded-xl py-3.5 gap-2 bg-brand text-white font-semibold text-[15px] leading-[18px] hover:bg-brand-hover active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all press-scale"
        >
          <CreditCardIcon />
          <span className="tracking-[-0.01em]">Bayar {formatRupiah(total)}</span>
        </button>
      </div>
    </div>
  )
}
