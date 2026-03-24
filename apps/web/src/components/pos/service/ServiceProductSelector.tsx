'use client'

import { useState, useEffect, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'

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
  const [searchParts, setSearchParts] = useState('')
  const [searchJasa, setSearchJasa] = useState('')

  // Tambah jasa baru state
  const [showAddJasa, setShowAddJasa] = useState(false)
  const [newJasaName, setNewJasaName] = useState('')
  const [newJasaPrice, setNewJasaPrice] = useState('')
  const [addingJasa, setAddingJasa] = useState(false)

  const fetchServices = useCallback(async () => {
    setLoadingServices(true)
    try {
      const res = await authFetch('/api/v1/service-catalog')
      const body: ApiResponse<ServiceCatalogItem[]> = await res.json()
      if (!res.ok || !body.success) {
        console.error('[ServiceProductSelector] Failed to fetch service catalog:', { status: res.status, error: body.error })
        setError(body.error || `HTTP ${res.status}`)
        return
      }
      setServices((body.data ?? []).filter(s => s.isActive).map(s => ({ ...s, defaultPrice: Number(s.defaultPrice) })))
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
      const res = await authFetch('/api/v1/products?variants=true&active=true')
      const body: ApiResponse<Product[]> = await res.json()
      if (!res.ok || !body.success) {
        console.error('[ServiceProductSelector] Failed to fetch products:', { status: res.status, error: body.error })
        setError(body.error || `HTTP ${res.status}`)
        return
      }
      // Normalize: API returns variant.id, frontend uses variantId; price/stockQty may be strings
      const normalized = (body.data ?? []).map(p => ({
        ...p,
        variants: (p.variants ?? []).map((v: any) => ({
          variantId: v.variantId || v.id,
          name: v.name || p.name,
          sku: v.sku,
          price: Number(v.price),
          stockQty: Number(v.stockQty),
        })),
      }))
      setProducts(normalized)
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
      const res = await authFetch(`/api/v1/service-orders/${serviceOrderId}/items`, {
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
      const res = await authFetch(`/api/v1/service-orders/${serviceOrderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: 'PART',
          variantId: variant.variantId,
          description: variant.name,
          qty: getQty(variant.variantId),
          unitPrice: Number(variant.price),
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

  // Tambah jasa baru ke catalog + langsung tambah ke order
  const addNewJasa = async () => {
    if (!newJasaName.trim() || !newJasaPrice.trim()) return
    const price = parseInt(newJasaPrice.replace(/\D/g, ''), 10)
    if (!price || price <= 0) { setError('Harga harus lebih dari 0'); return }

    setAddingJasa(true)
    setError(null)
    try {
      // 1. Create jasa di catalog
      const createRes = await authFetch('/api/v1/service-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newJasaName.trim(), defaultPrice: price }),
      })
      const createBody: ApiResponse<ServiceCatalogItem> = await createRes.json()
      if (!createRes.ok || !createBody.success || !createBody.data) {
        setError(createBody.error || 'Gagal membuat jasa baru')
        return
      }

      // 2. Langsung tambahkan ke order
      const addRes = await authFetch(`/api/v1/service-orders/${serviceOrderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          itemType: 'SERVICE',
          catalogItemId: createBody.data.id,
          qty: 1,
        }),
      })
      const addBody: ApiResponse<unknown> = await addRes.json()
      if (!addRes.ok || !addBody.success) {
        setError(addBody.error || 'Gagal menambahkan ke order')
        return
      }

      // 3. Reset form + refresh
      setNewJasaName('')
      setNewJasaPrice('')
      setShowAddJasa(false)
      fetchServices() // refresh catalog list
      onItemAdded()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setAddingJasa(false)
    }
  }

  // Filter jasa by search
  const filteredServices = searchJasa.trim()
    ? services.filter(s => s.name.toLowerCase().includes(searchJasa.toLowerCase()))
    : services

  // Filter parts by search
  const filteredProducts = searchParts.trim()
    ? products.filter(p =>
        p.name.toLowerCase().includes(searchParts.toLowerCase()) ||
        p.variants.some(v =>
          v.sku.toLowerCase().includes(searchParts.toLowerCase()) ||
          v.name.toLowerCase().includes(searchParts.toLowerCase())
        )
      )
    : products

  const isLoading = activeTab === 'jasa' ? loadingServices : loadingProducts

  return (
    <div data-testid="service-product-selector" className="border border-border rounded-xl overflow-hidden">
      {/* Tab bar — pill style */}
      <div className="flex items-center gap-1.5 p-2 bg-surface-subtle">
        <button
          onClick={() => setActiveTab('jasa')}
          className={`flex-1 flex items-center justify-center rounded-[20px] py-[7px] px-4 transition-colors ${
            activeTab === 'jasa'
              ? 'bg-brand text-white'
              : 'bg-surface-subtle border border-border text-ink-secondary hover:bg-surface-raised hover:text-ink'
          }`}
        >
          <span className="font-medium text-[13px] leading-4">Jasa</span>
        </button>
        <button
          onClick={() => setActiveTab('parts')}
          className={`flex-1 flex items-center justify-center rounded-[20px] py-[7px] px-4 transition-colors ${
            activeTab === 'parts'
              ? 'bg-brand text-white'
              : 'bg-surface-subtle border border-border text-ink-secondary hover:bg-surface-raised hover:text-ink'
          }`}
        >
          <span className="font-medium text-[13px] leading-4">Spare Parts</span>
        </button>
      </div>

      {/* Error banner */}
      {error ? (
        <div className="mx-3 mt-3 bg-danger-muted rounded-xl p-2 text-[12px] text-danger">
          {error}
        </div>
      ) : null}

      {/* Search bar */}
      <div className="px-3 pt-2.5 pb-1">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder={activeTab === 'jasa' ? 'Cari jasa...' : 'Cari spare part (nama/SKU)...'}
            value={activeTab === 'jasa' ? searchJasa : searchParts}
            onChange={e => activeTab === 'jasa' ? setSearchJasa(e.target.value) : setSearchParts(e.target.value)}
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-3 py-2 text-[12px] text-ink placeholder:text-ink-faint outline-none focus:ring-1 focus:ring-brand"
          />
          {(activeTab === 'jasa' ? searchJasa : searchParts) && (
            <button
              onClick={() => activeTab === 'jasa' ? setSearchJasa('') : setSearchParts('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-h-64 overflow-y-auto">
        {isLoading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-12 bg-surface-subtle rounded-xl animate-pulse" />
            ))}
          </div>
        ) : activeTab === 'jasa' ? (
          <div>
            {/* Tombol Tambah Jasa Baru */}
            <div className="px-3 pt-2 pb-2">
              {!showAddJasa ? (
                <button
                  onClick={() => setShowAddJasa(true)}
                  className="w-full py-2 text-[12px] font-medium text-brand border border-dashed border-brand/40 rounded-lg hover:bg-brand/5 transition-colors"
                >
                  + Tambah Jasa Baru
                </button>
              ) : (
                <div className="border border-border rounded-xl p-3 bg-surface-subtle space-y-2">
                  <p className="text-[12px] font-semibold text-ink">Jasa Baru</p>
                  <input
                    type="text"
                    placeholder="Nama jasa (misal: Tune Up, Ganti Ban)"
                    value={newJasaName}
                    onChange={e => setNewJasaName(e.target.value)}
                    className="w-full bg-white dark:bg-surface-raised border border-border rounded-lg px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint outline-none focus:ring-1 focus:ring-brand"
                    autoFocus
                  />
                  <div className="flex items-center gap-2">
                    <div className="flex-1 relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-muted">Rp</span>
                      <input
                        type="text"
                        placeholder="Harga"
                        value={newJasaPrice}
                        onChange={e => {
                          const raw = e.target.value.replace(/\D/g, '')
                          setNewJasaPrice(raw ? Number(raw).toLocaleString('id-ID') : '')
                        }}
                        className="w-full bg-white dark:bg-surface-raised border border-border rounded-lg pl-8 pr-3 py-2 text-[13px] text-ink font-mono placeholder:text-ink-faint outline-none focus:ring-1 focus:ring-brand"
                        onKeyDown={e => { if (e.key === 'Enter') addNewJasa() }}
                      />
                    </div>
                    <button
                      onClick={addNewJasa}
                      disabled={addingJasa || !newJasaName.trim() || !newJasaPrice.trim()}
                      className="px-4 py-2 text-[12px] font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      {addingJasa ? '...' : 'Simpan & Tambah'}
                    </button>
                    <button
                      onClick={() => { setShowAddJasa(false); setNewJasaName(''); setNewJasaPrice('') }}
                      className="px-2 py-2 text-[12px] text-ink-muted hover:text-ink transition-colors"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* List jasa dari catalog */}
            {filteredServices.length === 0 ? (
              <div className="p-4 text-center text-[13px] text-ink-faint">
                {searchJasa.trim() ? 'Jasa tidak ditemukan' : 'Tidak ada jasa tersedia'}
              </div>
            ) : (
              <div className="divide-y divide-border-light">
                {filteredServices.map(service => (
                  <div key={service.id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">{service.name}</p>
                      <p className="text-[12px] text-brand font-mono">{formatRp(service.defaultPrice)}</p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={getQty(service.id)}
                      onChange={e => setQty(service.id, parseInt(e.target.value, 10) || 1)}
                      className="w-14 bg-surface-raised border border-border rounded-lg px-2 py-1.5 text-[13px] text-ink text-center outline-none"
                      aria-label={`Quantity for ${service.name}`}
                    />
                    <button
                      onClick={() => addServiceItem(service)}
                      disabled={addingId === service.id}
                      className="px-3 py-1.5 text-[12px] font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors press-scale"
                    >
                      {addingId === service.id ? '...' : '+ Add'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          filteredProducts.length === 0 ? (
            <div className="p-4 text-center text-[13px] text-ink-faint">
              {searchParts.trim() ? 'Produk tidak ditemukan' : 'Tidak ada produk tersedia'}
            </div>
          ) : (
            <div className="divide-y divide-border-light">
              {filteredProducts.flatMap(product =>
                (product.variants ?? []).map(variant => (
                  <div key={variant.variantId} className="flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate">{variant.name || product.name}</p>
                      <p className="text-[12px] text-ink-muted font-mono">
                        {variant.sku} · {formatRp(variant.price)} · Stok: {variant.stockQty}
                      </p>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={getQty(variant.variantId)}
                      onChange={e => setQty(variant.variantId, parseInt(e.target.value, 10) || 1)}
                      className="w-14 bg-surface-raised border border-border rounded-lg px-2 py-1.5 text-[13px] text-ink text-center outline-none"
                      aria-label={`Quantity for ${variant.name || product.name}`}
                    />
                    <button
                      onClick={() => addPartItem(variant)}
                      disabled={addingId === variant.variantId}
                      className="px-3 py-1.5 text-[12px] font-medium bg-brand text-white rounded-lg hover:bg-brand-hover disabled:opacity-50 transition-colors press-scale"
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
