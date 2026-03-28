import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

export interface CartItem {
  variantId: string
  name: string
  qty: number
  unitPrice: number
  discountType: 'percent' | 'flat'
  discountValue: number
}

interface CartState {
  items: CartItem[]
  transactionDiscount: number
  addItem: (item: Pick<CartItem, 'variantId' | 'name' | 'unitPrice'>) => void
  updateQty: (variantId: string, qty: number) => void
  setItemDiscount: (variantId: string, type: 'percent' | 'flat', value: number) => void
  setTransactionDiscount: (amount: number) => void
  removeItem: (variantId: string) => void
  clearCart: () => void
}

// H-23: Persist cart to sessionStorage so it survives page refreshes
// Uses sessionStorage (not localStorage) — cart is per-tab and clears on browser close
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      transactionDiscount: 0,
      addItem: (item) => set((state) => {
        const existing = state.items.find(i => i.variantId === item.variantId)
        if (existing) {
          return { items: state.items.map(i => i.variantId === item.variantId ? { ...i, qty: i.qty + 1 } : i) }
        }
        return { items: [...state.items, { ...item, qty: 1, discountType: 'flat', discountValue: 0 }] }
      }),
      updateQty: (variantId, qty) => set((state) => ({
        items: qty <= 0
          ? state.items.filter(i => i.variantId !== variantId)
          : state.items.map(i => i.variantId === variantId ? { ...i, qty } : i),
      })),
      setItemDiscount: (variantId, type, value) => set((state) => ({
        items: state.items.map(i => i.variantId === variantId ? { ...i, discountType: type, discountValue: value } : i),
      })),
      setTransactionDiscount: (amount) => set({ transactionDiscount: amount }),
      removeItem: (variantId) => set((state) => ({ items: state.items.filter(i => i.variantId !== variantId) })),
      clearCart: () => set({ items: [], transactionDiscount: 0 }),
    }),
    {
      name: 'k21-cart',
      storage: createJSONStorage(() =>
        typeof window !== 'undefined' ? sessionStorage : {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        }
      ),
    }
  )
)

export function computeCartTotals(items: CartItem[], txDiscount: number) {
  const subtotal = items.reduce((sum, item) => {
    const lineBase = item.unitPrice * item.qty
    const itemDisc = item.discountType === 'percent' ? Math.round(lineBase * (item.discountValue / 100)) : item.discountValue
    return sum + lineBase - itemDisc
  }, 0)
  const total = Math.max(0, Math.round(subtotal - txDiscount))
  return { subtotal: Math.round(subtotal), total }
}
