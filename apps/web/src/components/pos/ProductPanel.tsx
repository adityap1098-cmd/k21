'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useCatalogSearch, useAllProducts, useCatalogCategories, type CatalogProduct } from '@/lib/catalog'
import { useCartStore } from '@/lib/store/cart.store'

function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID')
}

/* ── SVG Icons ── */

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function ProductPlaceholderIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
      <rect x="8" y="10" width="20" height="18" rx="2" stroke="#B0B5BC" strokeWidth="1.5" />
      <path d="M12 10V8C12 5.79 13.79 4 16 4H20C22.21 4 24 5.79 24 8V10" stroke="#B0B5BC" strokeWidth="1.5" />
    </svg>
  )
}

/* ── Product Card ── */

function ProductCard({ product, onAdd }: { product: CatalogProduct; onAdd: (p: CatalogProduct) => void }) {
  return (
    <button
      onClick={() => onAdd(product)}
      className="flex flex-col w-[164px] rounded-xl overflow-hidden bg-surface-raised border border-border shrink-0 text-left hover:border-brand/40 active:scale-[0.98] transition-all cursor-pointer"
    >
      {/* Image placeholder */}
      <div className="flex items-center justify-center h-[100px] bg-[#EDE9E3] shrink-0">
        <ProductPlaceholderIcon />
      </div>
      {/* Content */}
      <div className="flex flex-col py-2.5 px-3 gap-1">
        <span className="tracking-[-0.01em] text-ink font-medium text-[13px] leading-4 line-clamp-2">
          {product.name}
        </span>
        <span className="text-brand font-mono font-medium text-[13px] leading-4">
          {formatRupiah(product.price)}
        </span>
        <span className="text-ink-muted text-[11px] leading-[14px]">
          Stok: {product.stockQty}
        </span>
      </div>
    </button>
  )
}

/* ── Main ProductPanel ── */

export function ProductPanel() {
  const [query, setQuery] = useState('')
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { addItem } = useCartStore()

  const searchResults = useCatalogSearch(query)
  const allProducts = useAllProducts(activeCategoryId)
  const categories = useCatalogCategories()

  const handleAdd = useCallback((product: CatalogProduct) => {
    addItem({ variantId: product.variantId, name: product.name, unitPrice: product.price })
  }, [addItem])

  // Barcode detection: if 1 result and its barcode exactly matches query, auto-add and clear
  useEffect(() => {
    if (!query) return
    if (searchResults.length === 1 && searchResults[0].barcode === query) {
      const product = searchResults[0]
      addItem({ variantId: product.variantId, name: product.name, unitPrice: product.price })
      setQuery('')
      inputRef.current?.focus()
    }
  }, [searchResults, query, addItem])

  // F2 keyboard shortcut to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'F2') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const isSearching = query.trim().length > 0
  const displayProducts = isSearching ? searchResults : allProducts

  return (
    <div className="flex flex-col gap-5 h-full overflow-hidden">
      {/* Search bar */}
      <div className="flex items-center rounded-xl py-3 px-4 gap-2.5 bg-surface-raised border border-border shrink-0">
        <span className="text-ink-muted">
          <SearchIcon />
        </span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Cari produk atau scan barcode..."
          aria-label="Cari produk atau scan barcode"
          className="flex-1 bg-transparent text-sm leading-[18px] text-ink placeholder:text-[#B0B5BC] focus:outline-none"
          autoFocus
        />
        <div className="ml-auto flex items-center rounded-md py-1 px-2.5 bg-surface border border-border">
          <span className="text-ink-muted font-mono text-[11px] leading-[14px]">F2</span>
        </div>
      </div>

      {/* Category pills */}
      {!isSearching && (
        <div className="flex items-center gap-1.5 shrink-0 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveCategoryId(null)}
            className={`flex items-center rounded-[20px] py-[7px] px-4 shrink-0 transition-colors ${
              activeCategoryId === null
                ? 'bg-ink text-white'
                : 'bg-surface-raised border border-border text-ink hover:bg-surface'
            }`}
          >
            <span className="font-medium text-[13px] leading-4">Semua</span>
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={`flex items-center rounded-[20px] py-[7px] px-4 shrink-0 transition-colors ${
                activeCategoryId === cat.id
                  ? 'bg-ink text-white'
                  : 'bg-surface-raised border border-border text-ink hover:bg-surface'
              }`}
            >
              <span className="font-medium text-[13px] leading-4">{cat.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto">
        {displayProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-ink-faint gap-2">
            {isSearching ? (
              <span className="text-sm">Tidak ada produk untuk &ldquo;{query}&rdquo;</span>
            ) : (
              <>
                <ProductPlaceholderIcon />
                <span className="text-sm mt-2">Belum ada produk. Sinkronisasi untuk memuat katalog.</span>
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            {displayProducts.map(product => (
              <ProductCard key={product.variantId} product={product} onAdd={handleAdd} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
