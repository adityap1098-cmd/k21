'use client'

import { useState, useEffect, useRef } from 'react'
import { useCatalogSearch, getQuickAddProducts, type CatalogProduct } from '@/lib/catalog'
import { useCartStore } from '@/lib/store/cart.store'

function formatRupiah(amount: number): string {
  return 'Rp ' + amount.toLocaleString('id-ID')
}

interface ProductTileProps {
  product: CatalogProduct
  onAdd: (product: CatalogProduct) => void
}

function ProductTile({ product, onAdd }: ProductTileProps) {
  return (
    <button
      onClick={() => onAdd(product)}
      className="flex flex-col items-start bg-white border border-gray-200 rounded-lg p-3 hover:bg-blue-50 hover:border-blue-300 active:bg-blue-100 transition-colors text-left w-full"
    >
      <span className="text-sm font-medium text-gray-800 line-clamp-2 leading-tight mb-1">{product.name}</span>
      <span className="text-xs text-gray-500 mb-1">{product.sku}</span>
      <span className="text-sm font-semibold text-blue-600">{formatRupiah(product.price)}</span>
    </button>
  )
}

interface SearchResultRowProps {
  product: CatalogProduct
  onAdd: (product: CatalogProduct) => void
}

function SearchResultRow({ product, onAdd }: SearchResultRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-gray-800 truncate">{product.name}</div>
        <div className="text-xs text-gray-500">{product.sku}</div>
      </div>
      <div className="flex items-center gap-3 ml-4 shrink-0">
        <span className="text-sm font-semibold text-gray-700">{formatRupiah(product.price)}</span>
        <button
          onClick={() => onAdd(product)}
          className="w-8 h-8 flex items-center justify-center bg-blue-600 text-white rounded-full hover:bg-blue-700 active:bg-blue-800 text-lg font-bold leading-none"
          aria-label={`Add ${product.name} to cart`}
        >
          +
        </button>
      </div>
    </div>
  )
}

export function ProductPanel() {
  const [query, setQuery] = useState('')
  const [quickAddProducts, setQuickAddProducts] = useState<CatalogProduct[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const { addItem } = useCartStore()

  const searchResults = useCatalogSearch(query)

  useEffect(() => {
    getQuickAddProducts().then(setQuickAddProducts).catch(() => setQuickAddProducts([]))
  }, [])

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

  function handleAdd(product: CatalogProduct) {
    addItem({ variantId: product.variantId, name: product.name, unitPrice: product.price })
  }

  const showSearch = query.trim().length > 0

  return (
    <div className="flex flex-col h-full">
      {/* Search / Scan bar */}
      <div className="p-4 bg-white border-b border-gray-200 shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Scan barcode or search product..."
          className="w-full px-4 py-3 border border-gray-300 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoFocus
        />
      </div>

      {/* Content area */}
      <div className="flex-1 overflow-y-auto">
        {showSearch ? (
          /* Search results list */
          <div>
            {searchResults.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <span>No products found for &ldquo;{query}&rdquo;</span>
              </div>
            ) : (
              searchResults.map(product => (
                <SearchResultRow key={product.variantId} product={product} onAdd={handleAdd} />
              ))
            )}
          </div>
        ) : (
          /* Quick-add grid */
          <div className="p-4">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Add</div>
            {quickAddProducts.length === 0 ? (
              <div className="flex items-center justify-center py-12 text-gray-400">
                <span>No products in catalog. Sync to load products.</span>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {quickAddProducts.map(product => (
                  <ProductTile key={product.variantId} product={product} onAdd={handleAdd} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
