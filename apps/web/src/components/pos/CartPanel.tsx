'use client'

import { useState } from 'react'
import { useCartStore, computeCartTotals, type CartItem } from '@/lib/store/cart.store'

function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID')
}

interface CartLineProps {
  item: CartItem
  isExpanded: boolean
  onToggle: () => void
  onUpdateQty: (variantId: string, qty: number) => void
  onSetDiscount: (variantId: string, type: 'percent' | 'flat', value: number) => void
  onRemove: (variantId: string) => void
}

function CartLine({ item, isExpanded, onToggle, onUpdateQty, onSetDiscount, onRemove }: CartLineProps) {
  const lineBase = item.unitPrice * item.qty
  const itemDisc = item.discountType === 'percent'
    ? lineBase * (item.discountValue / 100)
    : item.discountValue
  const lineTotal = lineBase - itemDisc

  return (
    <div className="border-b border-gray-100">
      {/* Normal row */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left"
        aria-expanded={isExpanded}
      >
        <span className="flex-1 text-sm font-medium text-gray-800 truncate">{item.name}</span>
        <span className="text-sm text-gray-500 shrink-0">x{item.qty}</span>
        <span className="text-sm text-gray-500 shrink-0">{formatRupiah(item.unitPrice)}</span>
        <span className="text-sm font-semibold text-gray-800 shrink-0 w-24 text-right">{formatRupiah(lineTotal)}</span>
      </button>

      {/* Inline editor */}
      {isExpanded && (
        <div className="bg-gray-50 px-4 pb-4 pt-2 space-y-3">
          {/* Quantity */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 w-20 shrink-0">Quantity</label>
            <input
              type="number"
              min={1}
              value={item.qty}
              onChange={e => onUpdateQty(item.variantId, parseInt(e.target.value, 10) || 1)}
              className="w-24 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Discount type + value */}
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-500 w-20 shrink-0">Discount</label>
            <div className="flex rounded border border-gray-300 overflow-hidden">
              <button
                onClick={() => onSetDiscount(item.variantId, 'percent', item.discountValue)}
                className={`px-3 py-1.5 text-sm font-medium ${
                  item.discountType === 'percent'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                %
              </button>
              <button
                onClick={() => onSetDiscount(item.variantId, 'flat', item.discountValue)}
                className={`px-3 py-1.5 text-sm font-medium border-l border-gray-300 ${
                  item.discountType === 'flat'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                Rp
              </button>
            </div>
            <input
              type="number"
              min={0}
              value={item.discountValue}
              onChange={e => onSetDiscount(item.variantId, item.discountType, parseFloat(e.target.value) || 0)}
              className="w-24 px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Remove button */}
          <div className="flex justify-end">
            <button
              onClick={() => onRemove(item.variantId)}
              className="text-sm text-red-600 hover:text-red-700 font-medium px-3 py-1.5 rounded hover:bg-red-50"
            >
              Hapus
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function CartPanel() {
  const [expandedVariantId, setExpandedVariantId] = useState<string | null>(null)

  const {
    items,
    transactionDiscount,
    updateQty,
    setItemDiscount,
    setTransactionDiscount,
    removeItem,
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

  function toggleExpand(variantId: string) {
    setExpandedVariantId(prev => prev === variantId ? null : variantId)
  }

  const isEmpty = items.length === 0

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white shrink-0 flex items-center gap-2">
        <span className="text-lg font-semibold text-gray-800">Cart</span>
        {!isEmpty && (
          <span className="inline-flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-xs font-bold rounded-full">
            {items.length}
          </span>
        )}
      </div>

      {/* Cart lines */}
      <div className="flex-1 overflow-y-auto">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
            <span className="text-4xl">&#128722;</span>
            <span className="text-sm">Cart is empty</span>
          </div>
        ) : (
          items.map((item: CartItem) => (
            <CartLine
              key={item.variantId}
              item={item}
              isExpanded={expandedVariantId === item.variantId}
              onToggle={() => toggleExpand(item.variantId)}
              onUpdateQty={updateQty}
              onSetDiscount={setItemDiscount}
              onRemove={removeItem}
            />
          ))
        )}
      </div>

      {/* Totals area */}
      <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-2 shrink-0">
        {/* Subtotal before item discounts */}
        <div className="flex justify-between text-sm text-gray-600">
          <span>Subtotal</span>
          <span>{formatRupiah(subtotal + itemDiscountTotal)}</span>
        </div>

        {/* Item discounts */}
        {itemDiscountTotal > 0 && (
          <div className="flex justify-between text-sm text-green-600">
            <span>Item discounts</span>
            <span>-{formatRupiah(itemDiscountTotal)}</span>
          </div>
        )}

        {/* Transaction discount */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Transaction discount</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500">Rp</span>
            <input
              type="number"
              min={0}
              value={transactionDiscount}
              onChange={e => setTransactionDiscount(parseFloat(e.target.value) || 0)}
              className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Grand total */}
        <div className="flex justify-between items-center pt-2 border-t border-gray-300">
          <span className="text-base font-bold text-gray-900">TOTAL</span>
          <span className="text-xl font-bold text-gray-900">{formatRupiah(total)}</span>
        </div>

        {/* BAYAR button */}
        <button
          disabled={isEmpty}
          className="w-full mt-2 py-4 bg-blue-600 text-white text-lg font-bold rounded-lg hover:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          BAYAR
        </button>
      </div>
    </div>
  )
}
