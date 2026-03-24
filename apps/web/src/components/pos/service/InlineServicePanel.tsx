'use client'

import { useState, useCallback, useEffect } from 'react'
import { authFetch } from '@/lib/auth-fetch'
import { ServicePaymentModal } from './ServicePaymentModal'
import { ReceiptModal } from '@/components/pos/ReceiptModal'
import type { ReceiptData } from '@/lib/receipt/encoder'

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

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

interface LineItem {
  id: string
  itemType: 'SERVICE' | 'PART'
  description: string | null
  qty: number
  unitPrice: number
  lineTotal: number
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
}

const inputClass = 'w-full bg-surface border border-border rounded-lg py-2 px-3 text-[12px] text-ink placeholder:text-ink-faint outline-none'

type Step = 'form' | 'manage'

interface Props {
  onTransactionComplete?: () => void
}

export function InlineServicePanel({ onTransactionComplete }: Props) {
  // Step state
  const [step, setStep] = useState<Step>('form')

  // Form fields
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [plateNumber, setPlateNumber] = useState('')
  const [vehicleType, setVehicleType] = useState<'MOTOR' | 'MOBIL'>('MOTOR')
  const [complaint, setComplaint] = useState('')

  // Order state
  const [orderId, setOrderId] = useState<string | null>(null)
  const [items, setItems] = useState<LineItem[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Item adding
  const [services, setServices] = useState<ServiceCatalogItem[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [addingId, setAddingId] = useState<string | null>(null)

  // Payment
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean; orderId: string; orderTotal: number; existingPaymentsTotal: number
  }>({ isOpen: false, orderId: '', orderTotal: 0, existingPaymentsTotal: 0 })
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null)

  // Fetch catalogs on mount
  useEffect(() => {
    authFetch('/api/v1/service-catalog')
      .then(r => r.json())
      .then((body: ApiResponse<ServiceCatalogItem[]>) => {
        if (body.success && body.data) setServices(body.data.filter(s => s.isActive).map(s => ({ ...s, defaultPrice: Number(s.defaultPrice) })))
      })
      .catch(() => {})

    authFetch('/api/v1/products?variants=true&active=true')
      .then(r => r.json())
      .then((body: ApiResponse<Product[]>) => {
        if (body.success && body.data) {
          setProducts(body.data.map(p => ({
            ...p,
            variants: (p.variants ?? []).map((v: any) => ({
              variantId: v.variantId || v.id,
              name: v.name || p.name,
              sku: v.sku,
              price: Number(v.price),
              stockQty: Number(v.stockQty),
            })),
          })))
        }
      })
      .catch(() => {})
  }, [])

  // Create service order: customer + vehicle + order in one flow
  const handleCreateOrder = useCallback(async () => {
    if (!plateNumber.trim()) {
      setError('No. plat kendaraan wajib diisi')
      return
    }
    setIsCreating(true)
    setError(null)
    try {
      // 1. Create or find customer
      let customerId: string
      const custRes = await authFetch('/api/v1/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: customerName.trim() || 'Walk-in', phone: customerPhone.trim() || null }),
      })
      const custBody: ApiResponse<{ id: string }> = await custRes.json()
      if (custBody.success && custBody.data) {
        customerId = custBody.data.id
      } else {
        // Try search existing
        const searchRes = await authFetch(`/api/v1/customers/search?q=${encodeURIComponent(customerName.trim() || customerPhone.trim())}`)
        const searchBody: ApiResponse<{ id: string }[]> = await searchRes.json()
        if (searchBody.success && searchBody.data && searchBody.data.length > 0) {
          customerId = searchBody.data[0].id
        } else {
          setError(custBody.error || 'Gagal membuat customer')
          return
        }
      }

      // 2. Create vehicle
      let vehicleId: string
      const vehRes = await authFetch('/api/v1/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          plateNumber: plateNumber.trim().toUpperCase(),
          vehicleType,
        }),
      })
      const vehBody: ApiResponse<{ id: string }> = await vehRes.json()
      if (vehBody.success && vehBody.data) {
        vehicleId = vehBody.data.id
      } else {
        // Try find existing vehicle by plate
        const vSearchRes = await authFetch(`/api/v1/vehicles/search?plateNumber=${encodeURIComponent(plateNumber.trim())}`)
        const vSearchBody: ApiResponse<{ id: string }[]> = await vSearchRes.json()
        if (vSearchBody.success && vSearchBody.data && vSearchBody.data.length > 0) {
          vehicleId = vSearchBody.data[0].id
        } else {
          setError(vehBody.error || 'Gagal membuat kendaraan')
          return
        }
      }

      // 3. Create service order
      const orderRes = await authFetch('/api/v1/service-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId,
          complaint: complaint.trim() || null,
        }),
      })
      const orderBody: ApiResponse<{ id: string }> = await orderRes.json()
      if (orderBody.success && orderBody.data) {
        setOrderId(orderBody.data.id)
        setStep('manage')
      } else {
        setError(orderBody.error || 'Gagal membuat service order')
      }
    } catch (err) {
      setError('Gagal menghubungi server')
    } finally {
      setIsCreating(false)
    }
  }, [customerName, customerPhone, plateNumber, vehicleType, complaint])

  // Fetch items for order
  const fetchItems = useCallback(async () => {
    if (!orderId) return
    try {
      const res = await authFetch(`/api/v1/service-orders/${orderId}/items`)
      const body: ApiResponse<LineItem[]> = await res.json()
      if (body.success && body.data) setItems(body.data)
    } catch {}
  }, [orderId])

  useEffect(() => {
    if (orderId) fetchItems()
  }, [orderId, fetchItems])

  // Add service item
  const addServiceItem = async (service: ServiceCatalogItem) => {
    if (!orderId) return
    setAddingId(service.id)
    try {
      const res = await authFetch(`/api/v1/service-orders/${orderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: 'SERVICE', catalogItemId: service.id, qty: 1 }),
      })
      const body: ApiResponse<unknown> = await res.json()
      if (body.success) {
        await fetchItems()
        setSearchQuery('')
        setShowResults(false)
      } else {
        setError(body.error || 'Gagal menambah item')
      }
    } catch { setError('Gagal menambah item') }
    finally { setAddingId(null) }
  }

  // Add part item
  const addPartItem = async (variant: ProductVariant) => {
    if (!orderId) return
    setAddingId(variant.variantId)
    try {
      const res = await authFetch(`/api/v1/service-orders/${orderId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemType: 'PART', variantId: variant.variantId, description: variant.name, qty: 1, unitPrice: variant.price }),
      })
      const body: ApiResponse<unknown> = await res.json()
      if (body.success) {
        await fetchItems()
        setSearchQuery('')
        setShowResults(false)
      } else {
        setError(body.error || 'Gagal menambah item')
      }
    } catch { setError('Gagal menambah item') }
    finally { setAddingId(null) }
  }

  // Remove item
  const removeItem = async (itemId: string) => {
    if (!orderId) return
    try {
      await authFetch(`/api/v1/service-orders/${orderId}/items/${itemId}`, { method: 'DELETE' })
      await fetchItems()
    } catch {}
  }

  // Filtered search results
  const q = searchQuery.toLowerCase()
  const filteredServices = q ? services.filter(s => s.name.toLowerCase().includes(q)) : []
  const filteredParts = q ? products.flatMap(p => p.variants.filter(v => v.name.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q))) : []

  // Totals
  const lineItemsTotal = items.reduce((sum, i) => sum + i.lineTotal, 0)

  // Complete & Pay
  const handleProcessPay = async () => {
    if (!orderId) return
    setError(null)
    try {
      // Complete order first
      await authFetch(`/api/v1/service-orders/${orderId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
    } catch {
      // Might already be completed, continue to payment
    }
    setPaymentModal({ isOpen: true, orderId, orderTotal: lineItemsTotal, existingPaymentsTotal: 0 })
  }

  // Reset for new order
  const resetForm = () => {
    setStep('form')
    setOrderId(null)
    setItems([])
    setCustomerName('')
    setCustomerPhone('')
    setPlateNumber('')
    setVehicleType('MOTOR')
    setComplaint('')
    setSearchQuery('')
    setError(null)
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {error && (
        <div className="mx-3 mt-2 bg-danger-muted text-danger px-3 py-1.5 rounded-lg text-[11px]">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Tutup</button>
        </div>
      )}

      {step === 'form' ? (
        /* ── Customer/Vehicle Form ── */
        <div className="flex flex-col gap-2.5 p-3">
          <input
            type="text"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            placeholder="Nama Pelanggan"
            className={inputClass}
          />
          <input
            type="text"
            value={customerPhone}
            onChange={e => setCustomerPhone(e.target.value)}
            placeholder="No. HP"
            className={inputClass}
          />
          <input
            type="text"
            value={plateNumber}
            onChange={e => setPlateNumber(e.target.value)}
            placeholder="No. Plat Kendaraan *"
            className={inputClass}
          />
          <select
            value={vehicleType}
            onChange={e => setVehicleType(e.target.value as 'MOTOR' | 'MOBIL')}
            className={inputClass}
          >
            <option value="MOTOR">Motor</option>
            <option value="MOBIL">Mobil</option>
          </select>
          <textarea
            value={complaint}
            onChange={e => setComplaint(e.target.value)}
            placeholder="Keluhan"
            rows={2}
            className={inputClass + ' resize-none'}
          />
          <button
            onClick={handleCreateOrder}
            disabled={isCreating || !plateNumber.trim()}
            className="w-full py-2 bg-success text-white rounded-lg font-semibold text-[12px] hover:bg-success/90 disabled:opacity-50 transition-all mt-1"
          >
            {isCreating ? 'Membuat Order...' : 'Buat Order Service'}
          </button>
        </div>
      ) : (
        /* ── Manage Order: Add Items + Pay ── */
        <div className="flex flex-col gap-2 p-3 flex-1">
          {/* Back / new order */}
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-ink-muted">Order dibuat — tambahkan item:</span>
            <button onClick={resetForm} className="text-[11px] text-brand font-medium hover:text-brand-hover">
              + Order Baru
            </button>
          </div>

          {/* Search sparepart/jasa */}
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); setShowResults(true) }}
              onFocus={() => setShowResults(true)}
              placeholder="🔍 Tambah sparepart/jasa..."
              className={inputClass}
            />
            {showResults && q && (filteredServices.length > 0 || filteredParts.length > 0) && (
              <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-surface-raised border border-border rounded-lg shadow-lg max-h-[150px] overflow-y-auto">
                {filteredServices.map(s => (
                  <button
                    key={s.id}
                    onClick={() => addServiceItem(s)}
                    disabled={addingId === s.id}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-subtle text-left text-[11px] border-b border-border-light last:border-b-0"
                  >
                    <span className="text-ink font-medium">{s.name}</span>
                    <span className="text-brand font-mono">{formatRp(s.defaultPrice)}</span>
                  </button>
                ))}
                {filteredParts.map(v => (
                  <button
                    key={v.variantId}
                    onClick={() => addPartItem(v)}
                    disabled={addingId === v.variantId}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-surface-subtle text-left text-[11px] border-b border-border-light last:border-b-0"
                  >
                    <span className="text-ink font-medium">{v.name}</span>
                    <span className="text-brand font-mono">{formatRp(v.price)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Item list */}
          <div className="flex-1 overflow-y-auto">
            <div className="text-[11px] font-semibold text-ink-muted uppercase tracking-wide mb-1">Item Service:</div>
            {items.length === 0 ? (
              <div className="text-[11px] text-ink-faint text-center py-3">Belum ada item</div>
            ) : (
              items.map(item => (
                <div key={item.id} className="flex items-center justify-between py-1.5 border-b border-border-light last:border-b-0">
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] text-ink font-medium truncate block">
                      {item.description || (item.itemType === 'SERVICE' ? 'Jasa' : 'Part')}
                    </span>
                    <span className="text-[10px] text-ink-muted font-mono">{item.qty}x {formatRp(item.unitPrice)}</span>
                  </div>
                  <span className="text-[11px] font-mono font-medium text-ink shrink-0 mr-2">{formatRp(item.lineTotal)}</span>
                  <button onClick={() => removeItem(item.id)} className="text-danger text-[12px] shrink-0">×</button>
                </div>
              ))
            )}
          </div>

          {/* Total + Pay */}
          <div className="border-t border-border pt-2 mt-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[13px] font-bold text-ink">Total</span>
              <span className="text-[15px] font-bold font-mono text-ink">{formatRp(lineItemsTotal)}</span>
            </div>
            <button
              onClick={handleProcessPay}
              disabled={items.length === 0}
              className="w-full py-2 bg-success text-white rounded-lg font-semibold text-[12px] hover:bg-success/90 disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
            >
              💳 Proses & Bayar
            </button>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <ServicePaymentModal
        isOpen={paymentModal.isOpen}
        orderId={paymentModal.orderId}
        orderTotal={paymentModal.orderTotal}
        existingPaymentsTotal={paymentModal.existingPaymentsTotal}
        onSuccess={(data) => {
          setPaymentModal(prev => ({ ...prev, isOpen: false }))
          setReceiptData(data)
          resetForm()
          onTransactionComplete?.()
        }}
        onClose={() => setPaymentModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Receipt Modal */}
      <ReceiptModal
        isOpen={receiptData !== null}
        receiptData={receiptData}
        onClose={() => setReceiptData(null)}
      />
    </div>
  )
}
