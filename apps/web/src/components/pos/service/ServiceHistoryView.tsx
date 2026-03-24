'use client'

import { useState, useCallback, useEffect, type FormEvent } from 'react'
import { authFetch } from '@/lib/auth-fetch'

/* ── Types ── */

interface CustomerItem {
  id: string
  name: string
  phone: string
}

interface VehicleInfo {
  id: string
  plateNumber: string
  brand: string | null
  model: string | null
  vehicleType: string | null
  year: number | null
}

interface HistoryOrder {
  id: string
  orderNumber: string
  workStatus: string
  paymentStatus: string
  complaint: string | null
  estimatedCost: number | null
  kilometer: number | null
  mechanicId: string | null
  completedAt: string | null
  createdAt: string
  vehicle?: VehicleInfo | null
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

/* ── Status maps ── */

const WORK_STATUS_COLORS: Record<string, string> = {
  BOOKING: 'bg-[rgba(122,132,144,0.1)] text-ink-muted',
  CHECKED_IN: 'bg-info-muted text-info',
  IN_PROGRESS: 'bg-warning-muted text-warning',
  COMPLETED: 'bg-success-muted text-success',
}

const WORK_STATUS_LABELS: Record<string, string> = {
  BOOKING: 'Booking',
  CHECKED_IN: 'Checked In',
  IN_PROGRESS: 'Dikerjakan',
  COMPLETED: 'Selesai',
}

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  UNPAID: 'bg-danger-muted text-danger',
  PARTIAL: 'bg-warning-muted text-warning',
  PAID: 'bg-success-muted text-success',
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  UNPAID: 'Belum Bayar',
  PARTIAL: 'Sebagian',
  PAID: 'Lunas',
}

/* ── Helpers ── */

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return iso
  }
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
}

/* ── Icons ── */

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="shrink-0">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
      <circle cx="8" cy="5" r="3" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2 14c0-2.5 2.7-4.5 6-4.5s6 2 6 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/* ── Component ── */

export function ServiceHistoryView() {
  // Search mode: 'plate' or 'customer'
  const [searchMode, setSearchMode] = useState<'plate' | 'customer'>('customer')

  // Plate search state
  const [plateQuery, setPlateQuery] = useState('')

  // Customer search + list state
  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<CustomerItem[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null)

  // Orders result
  const [orders, setOrders] = useState<HistoryOrder[]>([])
  const [vehicleInfo, setVehicleInfo] = useState<VehicleInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searched, setSearched] = useState(false)

  // Load all customers on mount
  useEffect(() => {
    loadCustomers()
  }, [])

  const loadCustomers = async (q?: string) => {
    setLoadingCustomers(true)
    try {
      const url = q && q.trim()
        ? `/api/v1/customers/search?q=${encodeURIComponent(q.trim())}`
        : '/api/v1/customers?isActive=true'
      const res = await authFetch(url)
      const body: ApiResponse<CustomerItem[]> = await res.json()
      if (body.success && body.data) {
        setCustomerResults(body.data)
      }
    } catch (err) {
      console.error('[ServiceHistoryView] Failed to load customers:', err)
    } finally {
      setLoadingCustomers(false)
    }
  }

  // Debounced customer search
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCustomers(customerQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [customerQuery])

  // Search by plate
  const handlePlateSearch = useCallback(async (e?: FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = plateQuery.trim()
    if (!trimmed) return

    setLoading(true)
    setError(null)
    setOrders([])
    setVehicleInfo(null)
    setSearched(true)
    setSelectedCustomer(null)

    try {
      const url = `/api/v1/service-orders/history/${encodeURIComponent(trimmed)}`
      const res = await authFetch(url)
      const body: ApiResponse<HistoryOrder[]> = await res.json()

      if (!res.ok || !body.success) {
        setError(body.error || `HTTP ${res.status}`)
        return
      }

      const data = body.data ?? []
      setOrders(data)
      if (data.length > 0 && data[0].vehicle) {
        setVehicleInfo(data[0].vehicle)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [plateQuery])

  // Search by customer ID
  const handleSelectCustomer = useCallback(async (customer: CustomerItem) => {
    setSelectedCustomer(customer)
    setLoading(true)
    setError(null)
    setOrders([])
    setVehicleInfo(null)
    setSearched(true)

    try {
      const url = `/api/v1/service-orders/history-by-customer/${encodeURIComponent(customer.id)}`
      const res = await authFetch(url)
      const body: ApiResponse<HistoryOrder[]> = await res.json()

      if (!res.ok || !body.success) {
        setError(body.error || `HTTP ${res.status}`)
        return
      }

      setOrders(body.data ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div data-testid="service-history-view" className="flex h-full">
      {/* ── Left: Search panel ── */}
      <div className="w-80 shrink-0 border-r border-border flex flex-col">
        {/* Mode toggle */}
        <div className="p-3 border-b border-border">
          <div className="flex bg-surface-subtle rounded-lg p-0.5">
            <button
              onClick={() => setSearchMode('customer')}
              className={`flex-1 text-[12px] font-medium py-1.5 rounded-md transition-colors ${
                searchMode === 'customer'
                  ? 'bg-surface-raised text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Customer
            </button>
            <button
              onClick={() => setSearchMode('plate')}
              className={`flex-1 text-[12px] font-medium py-1.5 rounded-md transition-colors ${
                searchMode === 'plate'
                  ? 'bg-surface-raised text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink'
              }`}
            >
              Plat Nomor
            </button>
          </div>
        </div>

        {searchMode === 'customer' ? (
          <>
            {/* Customer search input */}
            <div className="p-3 border-b border-border">
              <div className="flex items-center rounded-lg py-2 px-3 gap-2 bg-surface-raised border border-border">
                <span className="text-ink-muted"><SearchIcon /></span>
                <input
                  type="text"
                  value={customerQuery}
                  onChange={e => setCustomerQuery(e.target.value)}
                  placeholder="Cari nama / no. HP..."
                  className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
                />
              </div>
            </div>

            {/* Customer list */}
            <div className="flex-1 overflow-y-auto">
              {loadingCustomers && customerResults.length === 0 ? (
                <div className="p-4 space-y-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-surface-subtle rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : customerResults.length === 0 ? (
                <div className="p-4 text-center text-[13px] text-ink-faint">
                  {customerQuery.trim() ? 'Tidak ada customer ditemukan' : 'Belum ada customer'}
                </div>
              ) : (
                <div className="py-1">
                  {customerResults.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleSelectCustomer(c)}
                      className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-surface-subtle transition-colors ${
                        selectedCustomer?.id === c.id ? 'bg-brand-subtle border-l-2 border-brand' : ''
                      }`}
                    >
                      <span className={`flex items-center justify-center size-8 rounded-full ${
                        selectedCustomer?.id === c.id
                          ? 'bg-brand text-white'
                          : 'bg-surface-subtle text-ink-muted'
                      }`}>
                        <PersonIcon />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[13px] font-medium text-ink truncate">{c.name}</div>
                        <div className="text-[11px] text-ink-muted">{c.phone}</div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Plate search */
          <div className="p-3">
            <form onSubmit={handlePlateSearch} className="flex gap-2">
              <div className="flex items-center flex-1 rounded-lg py-2 px-3 gap-2 bg-surface-raised border border-border">
                <span className="text-ink-muted"><SearchIcon /></span>
                <input
                  type="text"
                  value={plateQuery}
                  onChange={e => setPlateQuery(e.target.value)}
                  placeholder="Cari plat... (B1234CD)"
                  className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-faint focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={!plateQuery.trim() || loading}
                className="px-4 py-2 bg-brand text-white text-[12px] font-semibold rounded-lg hover:bg-brand-hover disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Cari
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ── Right: Results panel ── */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* Selected customer header */}
        {selectedCustomer && searchMode === 'customer' ? (
          <div className="bg-brand-subtle border border-brand/20 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center size-10 rounded-full bg-brand text-white">
                <PersonIcon />
              </span>
              <div>
                <div className="text-[15px] font-semibold text-ink">{selectedCustomer.name}</div>
                <div className="text-[12px] text-ink-muted">{selectedCustomer.phone}</div>
              </div>
              <div className="ml-auto text-[12px] text-ink-muted">
                {orders.length} order
              </div>
            </div>
          </div>
        ) : null}

        {/* Vehicle info header (plate search) */}
        {!selectedCustomer && vehicleInfo ? (
          <div className="bg-brand-subtle border border-brand/20 rounded-xl p-4">
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-lg">🚗</span>
              <span className="font-semibold text-ink">{vehicleInfo.plateNumber}</span>
              {vehicleInfo.brand ? (
                <span className="text-ink-secondary">
                  {vehicleInfo.brand}{vehicleInfo.model ? ` ${vehicleInfo.model}` : ''}
                </span>
              ) : null}
              {vehicleInfo.vehicleType ? (
                <span className="text-[11px] text-ink-muted bg-[rgba(122,132,144,0.1)] px-2 py-0.5 rounded-full font-medium">
                  {vehicleInfo.vehicleType}
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Error */}
        {error ? (
          <div className="bg-danger-muted rounded-xl p-3 text-[13px] text-danger">
            Gagal memuat riwayat: {error}
          </div>
        ) : null}

        {/* Loading */}
        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-14 bg-surface-subtle rounded-xl" />
            ))}
          </div>
        ) : null}

        {/* Order cards */}
        {!loading && searched && !error && orders.length > 0 ? (
          <div className="space-y-2">
            {orders.map(order => (
              <div key={order.id} className="bg-surface-raised border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div>
                    <span className="text-[13px] font-semibold text-ink">{order.orderNumber}</span>
                    <span className="text-[12px] text-ink-muted ml-2">{formatDate(order.createdAt)}</span>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${WORK_STATUS_COLORS[order.workStatus] ?? 'bg-[rgba(122,132,144,0.1)] text-ink-muted'}`}>
                      {WORK_STATUS_LABELS[order.workStatus] ?? order.workStatus}
                    </span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${PAYMENT_STATUS_COLORS[order.paymentStatus] ?? 'bg-[rgba(122,132,144,0.1)] text-ink-muted'}`}>
                      {PAYMENT_STATUS_LABELS[order.paymentStatus] ?? order.paymentStatus}
                    </span>
                  </div>
                </div>

                {/* Vehicle info on customer mode (show which vehicle) */}
                {order.vehicle && searchMode === 'customer' ? (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[11px]">🚗</span>
                    <span className="text-[12px] font-medium text-ink-secondary">
                      {order.vehicle.plateNumber}
                    </span>
                    {order.vehicle.brand ? (
                      <span className="text-[11px] text-ink-muted">
                        {order.vehicle.brand}{order.vehicle.model ? ` ${order.vehicle.model}` : ''}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {/* KM + Mekanik row */}
                <div className="flex items-center gap-3 flex-wrap mb-1">
                  {order.kilometer != null && (
                    <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                        <path d="M6 3.5V6L7.5 7.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      {order.kilometer.toLocaleString('id-ID')} km
                    </span>
                  )}
                  {order.mechanicId && (
                    <span className="flex items-center gap-1 text-[11px] text-ink-muted">
                      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="4" r="2" stroke="currentColor" strokeWidth="1.2"/>
                        <path d="M2 10c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      {order.mechanicId}
                    </span>
                  )}
                </div>

                {order.complaint ? (
                  <p className="text-[12px] text-ink-muted truncate">{order.complaint}</p>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {/* Empty — searched but no results */}
        {!loading && searched && !error && orders.length === 0 ? (
          <div className="bg-surface-raised border border-border rounded-xl p-8 text-center">
            <p className="text-ink-faint text-[13px]">
              {selectedCustomer
                ? `Belum ada riwayat service untuk ${selectedCustomer.name}`
                : 'Belum ada riwayat service untuk plat ini'}
            </p>
          </div>
        ) : null}

        {/* Initial — nothing searched yet */}
        {!loading && !searched ? (
          <div className="bg-surface-raised border border-border rounded-xl p-12 text-center">
            <div className="text-3xl mb-3 opacity-40">📋</div>
            <p className="text-ink-faint text-[13px]">
              {searchMode === 'customer'
                ? 'Pilih customer dari daftar untuk melihat riwayat service'
                : 'Masukkan plat nomor untuk melihat riwayat service'}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
