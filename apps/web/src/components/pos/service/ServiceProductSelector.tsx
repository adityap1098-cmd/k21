'use client'

import { useState, useEffect, useCallback } from 'react'

interface ServiceCatalogItem {
  id: string
  name: string
  defaultPrice: number
  isActive: boolean
}

interface ProductVariant {
  variantId: string
  name: string
  sku: string
  price: number
  stockQty: number
}

interface Product {
  id: string
  name: string
  variants: ProductVariant[]
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

interface Props {
  serviceOrderId: string
  onItemAdded: () => void
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
}

type Tab = 'jasa' | 'parts'

export function ServiceProductSelector({ serviceOrderId, onItemAdded }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('jasa')
  const [services, setServices] = useState<ServiceCatalogItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loadingServices, setLoadingServices] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [quantities, setQuantities] = useState<Record<string, number>>({})

  const fetchServices = useCallback(async () => {
    setLoadingServices(true)
    try {
      const res = await fetch('/api/v1/service-catalog')
      const body: ApiResponse<ServiceCatalogItem[]> = await res.json()
      if (!res.ok || !body.success) {
        console.error('[ServiceProductSelector] Failed to fetch service catalog:', { status: res.status, error: body.error })
        setError(body.error || `HTTP ${res.status}`)
        return
      }
      setServices((body.data ?? []).filter(s => s.isActive))
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[ServiceProductSelector] Fetch error (services):', { error: msg })
      setError(msg)
    } finally {
      setLoadingServices(false)
    }
  }, [])

  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true)
    try {
      const res = await fetch('/api/v1/products?variants=true&active=true')
      const body: ApiResponse<Product[]> = await res.json()
      if (!res.ok || !body.success) {
        console.error('[ServiceProductSelector] Failed to fetch products:', { status: res.status, error: body.error })
        setError(body.error || `HTTP ${res.status}`)
        return
      }
      setProducts(body.data ?? [])
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[ServiceProductSelector] Fetch error (products):', { error: msg })
      setError(msg)
    } finally {
      setLoadingProducts(false)
    }
  }, [])

  useEffect(() => {
    fetchServices()
    fetchProducts()
  }, [fetchServices, fetchProducts])

  const getQty = (itemId: string): number => quantities[itemId] ?? 1

  const setQty = (itemId: string, qty: number) => {
    setQuantities(prev => ({ ...prev, [itemId]: Math.max(1, qty) }))
  }

  const addServiceItem = async (service: ServiceCatalogItem) => {
    setAddingId(service.id)
    setError(null)
    try {
      const res = await fetch(`/api/v1/service-orders/${serviceOrderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: 'SERVICE',
          catalogItemId: service.id,
          qty: getQty(service.id),
        }),
      })
      const body: ApiResponse<unknown> = await res.json()
      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        console.error('[ServiceProductSelector] Failed to add service item:', { serviceId: service.id, status: res.status, error: msg })
        setError(msg)
        return
      }
      setQuantities(prev => ({ ...prev, [service.id]: 1 }))
      onItemAdded()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[ServiceProductSelector] Add service item error:', { error: msg })
      setError(msg)
    } finally {
      setAddingId(null)
    }
  }

  const addPartItem = async (variant: ProductVariant) => {
    setAddingId(variant.variantId)
    setError(null)
    try {
      const res = await fetch(`/api/v1/service-orders/${serviceOrderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: 'PART',
          variantId: variant.variantId,
          description: variant.name,
          qty: getQty(variant.variantId),
          unitPrice: variant.price,
        }),
      })
      const body: ApiResponse<unknown> = await res.json()
      if (!res.ok || !body.success) {
        const msg = body.error || `HTTP ${res.status}`
        console.error('[ServiceProductSelector] Failed to add part item:', { variantId: variant.variantId, status: res.status, error: msg })
        setError(msg)
        return
      }
      setQuantities(prev => ({ ...prev, [variant.variantId]: 1 }))
      onItemAdded()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error'
      console.error('[ServiceProductSelector] Add part item error:', { error: msg })
      setError(msg)
    } finally {
      setAddingId(null)
    }
  }

  const isLoading = activeTab === 'jasa' ? loadingServices : loadingProducts

  return (
    <div data-testid="service-product-selector" className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setActiveTab('jasa')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'jasa'
              ? 'text-blue-600 bg-white border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Jasa
        </button>
        <button
          onClick={() => setActiveTab('parts')}
          className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'parts'
              ? 'text-blue-600 bg-white border-b-2 border-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Spare Parts
        </button>
      </div>

      {/* Error banner */}
      {error ? (
        <div className="mx-3 mt-3 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
          {error}
        </div>
      ) : null}

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : activeTab === 'jasa' ? (
          services.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">Tidak ada jasa tersedia</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {services.map(service => (
                <div key={service.id} className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{service.name}</p>
                    <p className="text-xs text-gray-500">{formatRp(service.defaultPrice)}</p>
                  </div>
                  <input
                    type="number"
                    min={1}
                    value={getQty(service.id)}
                    onChange={e => setQty(service.id, parseInt(e.target.value, 10) || 1)}
                    className="w-14 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                    aria-label={`Quantity for ${service.name}`}
                  />
                  <button
                    onClick={() => addServiceItem(service)}
                    disabled={addingId === service.id}
                    className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {addingId === service.id ? '...' : '+ Add'}
                  </button>
                </div>
              ))}
            </div>
          )
        ) : (
          products.length === 0 ? (
            <div className="p-4 text-center text-sm text-gray-400">Tidak ada produk tersedia</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {products.flatMap(product =>
                (product.variants ?? []).map(variant => (
                  <div key={variant.variantId} className="flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{variant.name || product.name}</p>
                      <p className="text-xs text-gray-500">
                        {variant.sku} · {formatRp(variant.price)} · Stok: {variant.stockQty}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={getQty(variant.variantId)}
                      onChange={e => setQty(variant.variantId, parseInt(e.target.value, 10) || 1)}
                      className="w-14 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                      aria-label={`Quantity for ${variant.name || product.name}`}
                    />
                    <button
                      onClick={() => addPartItem(variant)}
                      disabled={addingId === variant.variantId}
                      className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {addingId === variant.variantId ? '...' : '+ Add'}
                    </button>
                  </div>
                ))
              )}
            </div>
          )
        )}
      </div>
    </div>
  )
}
