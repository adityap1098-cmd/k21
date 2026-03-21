'use client'

import { useState, useCallback } from 'react'
import { authFetch } from '@/lib/auth-fetch'

// --- Types ---
interface Customer {
  id: string
  name: string
  phone: string | null
}

interface Vehicle {
  id: string
  plateNumber: string
  vehicleType: 'MOTOR' | 'MOBIL'
  brand: string | null
  model: string | null
  customerId: string
  customer?: Customer
}

interface ServiceOrder {
  id: string
  orderNumber: string
  vehicleId: string
  complaint: string | null
  workStatus: string
}

interface ApiResponse<T> {
  success: boolean
  data: T | null
  error: string | null
}

interface Props {
  onOrderCreated: (order: ServiceOrder) => void
}

function formatPlate(v: Vehicle): string {
  const parts = [v.plateNumber]
  if (v.brand) parts.push(v.brand)
  if (v.model) parts.push(v.model)
  return parts.join(' — ')
}

/* ── Shared input class ── */
const inputClass = 'w-full bg-surface-raised border border-border rounded-xl py-3 px-4 text-[13px] text-ink placeholder:text-ink-faint outline-none focus:border-brand focus:ring-2 focus:ring-brand-subtle transition-colors'

export function CustomerVehicleForm({ onOrderCreated }: Props) {
  // --- Search state ---
  const [plateQuery, setPlateQuery] = useState('')
  const [plateResults, setPlateResults] = useState<Vehicle[]>([])
  const [plateSearching, setPlateSearching] = useState(false)

  const [customerQuery, setCustomerQuery] = useState('')
  const [customerResults, setCustomerResults] = useState<Customer[]>([])
  const [customerSearching, setCustomerSearching] = useState(false)

  // --- Selection state ---
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null)
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null)
  const [customerVehicles, setCustomerVehicles] = useState<Vehicle[]>([])

  // --- Inline create forms ---
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')

  const [showNewVehicle, setShowNewVehicle] = useState(false)
  const [newVehiclePlate, setNewVehiclePlate] = useState('')
  const [newVehicleType, setNewVehicleType] = useState<'MOTOR' | 'MOBIL'>('MOTOR')
  const [newVehicleBrand, setNewVehicleBrand] = useState('')
  const [newVehicleModel, setNewVehicleModel] = useState('')

  // --- Order creation ---
  const [complaint, setComplaint] = useState('')
  const [isCreatingOrder, setIsCreatingOrder] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false)
  const [isCreatingVehicle, setIsCreatingVehicle] = useState(false)

  // --- Vehicle search by plate ---
  const searchByPlate = useCallback(async (q: string) => {
    setPlateQuery(q)
    if (q.length < 2) {
      setPlateResults([])
      return
    }
    setPlateSearching(true)
    try {
      const res = await authFetch(`/api/v1/vehicles/search?plateNumber=${encodeURIComponent(q)}`)
      const body = (await res.json()) as ApiResponse<Vehicle[]>
      if (body.success && body.data) {
        setPlateResults(body.data)
      } else {
        setPlateResults([])
      }
    } catch (err) {
      console.error('[CustomerVehicleForm] Vehicle search failed:', err)
      setPlateResults([])
    } finally {
      setPlateSearching(false)
    }
  }, [])

  // --- Select vehicle from plate search ---
  const selectVehicleFromPlate = useCallback(async (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle)
    setPlateResults([])
    setPlateQuery(vehicle.plateNumber)

    // Fetch customer info for this vehicle
    if (vehicle.customer) {
      setSelectedCustomer(vehicle.customer)
    } else {
      try {
        const res = await authFetch(`/api/v1/customers/${vehicle.customerId}`)
        const body = (await res.json()) as ApiResponse<Customer>
        if (body.success && body.data) {
          setSelectedCustomer(body.data)
        }
      } catch (err) {
        console.error('[CustomerVehicleForm] Customer fetch failed:', err)
      }
    }
  }, [])

  // --- Customer search ---
  const searchCustomers = useCallback(async (q: string) => {
    setCustomerQuery(q)
    if (q.length < 2) {
      setCustomerResults([])
      return
    }
    setCustomerSearching(true)
    try {
      const res = await authFetch(`/api/v1/customers/search?q=${encodeURIComponent(q)}`)
      const body = (await res.json()) as ApiResponse<Customer[]>
      if (body.success && body.data) {
        setCustomerResults(body.data)
      } else {
        setCustomerResults([])
      }
    } catch (err) {
      console.error('[CustomerVehicleForm] Customer search failed:', err)
      setCustomerResults([])
    } finally {
      setCustomerSearching(false)
    }
  }, [])

  // --- Select customer → fetch their vehicles ---
  const selectCustomer = useCallback(async (customer: Customer) => {
    setSelectedCustomer(customer)
    setCustomerResults([])
    setCustomerQuery(customer.name)

    try {
      const res = await authFetch(`/api/v1/vehicles?customerId=${customer.id}`)
      const body = (await res.json()) as ApiResponse<Vehicle[]>
      if (body.success && body.data) {
        setCustomerVehicles(body.data)
        // Auto-select if only one vehicle
        if (body.data.length === 1) {
          setSelectedVehicle(body.data[0])
        }
      }
    } catch (err) {
      console.error('[CustomerVehicleForm] Vehicle list fetch failed:', err)
    }
  }, [])

  // --- Create new customer ---
  const createCustomer = useCallback(async () => {
    if (!newCustomerName.trim()) return
    setIsCreatingCustomer(true)
    setError(null)
    try {
      const res = await authFetch('/api/v1/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCustomerName.trim(), phone: newCustomerPhone.trim() || null }),
      })
      const body = (await res.json()) as ApiResponse<Customer>
      if (body.success && body.data) {
        setSelectedCustomer(body.data)
        setShowNewCustomer(false)
        setNewCustomerName('')
        setNewCustomerPhone('')
        setCustomerQuery(body.data.name)
      } else {
        setError(body.error || 'Gagal membuat customer')
      }
    } catch (err) {
      console.error('[CustomerVehicleForm] Customer create failed:', err)
      setError('Gagal membuat customer — periksa koneksi')
    } finally {
      setIsCreatingCustomer(false)
    }
  }, [newCustomerName, newCustomerPhone])

  // --- Create new vehicle ---
  const createVehicle = useCallback(async () => {
    if (!selectedCustomer || !newVehiclePlate.trim()) return
    setIsCreatingVehicle(true)
    setError(null)
    try {
      const res = await authFetch('/api/v1/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: selectedCustomer.id,
          plateNumber: newVehiclePlate.trim().toUpperCase(),
          vehicleType: newVehicleType,
          brand: newVehicleBrand.trim() || null,
          model: newVehicleModel.trim() || null,
        }),
      })
      const body = (await res.json()) as ApiResponse<Vehicle>
      if (body.success && body.data) {
        setSelectedVehicle(body.data)
        setShowNewVehicle(false)
        setNewVehiclePlate('')
        setNewVehicleBrand('')
        setNewVehicleModel('')
      } else {
        setError(body.error || 'Gagal membuat kendaraan')
      }
    } catch (err) {
      console.error('[CustomerVehicleForm] Vehicle create failed:', err)
      setError('Gagal membuat kendaraan — periksa koneksi')
    } finally {
      setIsCreatingVehicle(false)
    }
  }, [selectedCustomer, newVehiclePlate, newVehicleType, newVehicleBrand, newVehicleModel])

  // --- Create service order ---
  const createServiceOrder = useCallback(async () => {
    if (!selectedVehicle) return
    setIsCreatingOrder(true)
    setError(null)
    try {
      const res = await authFetch('/api/v1/service-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vehicleId: selectedVehicle.id,
          complaint: complaint.trim() || null,
        }),
      })
      const body = (await res.json()) as ApiResponse<ServiceOrder>
      if (body.success && body.data) {
        onOrderCreated(body.data)
      } else {
        setError(body.error || 'Gagal membuat service order')
      }
    } catch (err) {
      console.error('[CustomerVehicleForm] Service order create failed:', err)
      setError('Gagal membuat service order — periksa koneksi')
    } finally {
      setIsCreatingOrder(false)
    }
  }, [selectedVehicle, complaint, onOrderCreated])

  // --- Derived state ---
  const canCreateOrder = selectedVehicle !== null

  return (
    <div data-testid="customer-vehicle-form" className="flex flex-col gap-5 p-5 max-w-2xl">
      <h2 className="text-[15px] font-semibold text-ink">Order Service Baru</h2>

      {/* Error banner */}
      {error !== null ? (
        <div className="bg-danger-muted text-danger px-3 py-2 rounded-xl text-[13px] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-danger hover:text-danger font-medium underline ml-2 text-[13px]">Tutup</button>
        </div>
      ) : null}

      {/* ===== SECTION: Plate Number Search ===== */}
      <div className="space-y-2">
        <label className="block text-[13px] font-medium text-ink">Cari Plat Nomor</label>
        <input
          data-testid="plate-search-input"
          type="text"
          value={plateQuery}
          onChange={(e) => searchByPlate(e.target.value)}
          placeholder="Contoh: B 1234 XYZ"
          className={inputClass}
        />
        {plateSearching ? (
          <div className="text-[12px] text-ink-faint">Mencari...</div>
        ) : null}
        {plateResults.length > 0 ? (
          <div className="border border-border rounded-xl bg-surface-raised shadow-sm max-h-40 overflow-y-auto">
            {plateResults.map((v) => (
              <button
                key={v.id}
                onClick={() => selectVehicleFromPlate(v)}
                className="w-full text-left px-4 py-3 hover:bg-surface-subtle text-[13px] border-b border-border-light last:border-b-0 transition-colors"
              >
                <span className="font-medium text-ink">{v.plateNumber}</span>
                <span className="text-ink-muted ml-2">
                  {v.brand} {v.model} ({v.vehicleType})
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* ===== SECTION: Customer Search ===== */}
      {selectedCustomer === null ? (
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-ink">Cari Customer</label>
          <input
            data-testid="customer-search-input"
            type="text"
            value={customerQuery}
            onChange={(e) => searchCustomers(e.target.value)}
            placeholder="Nama atau nomor telepon"
            className={inputClass}
          />
          {customerSearching ? (
            <div className="text-[12px] text-ink-faint">Mencari...</div>
          ) : null}
          {customerResults.length > 0 ? (
            <div className="border border-border rounded-xl bg-surface-raised shadow-sm max-h-40 overflow-y-auto">
              {customerResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCustomer(c)}
                  className="w-full text-left px-4 py-3 hover:bg-surface-subtle text-[13px] border-b border-border-light last:border-b-0 transition-colors"
                >
                  <span className="font-medium text-ink">{c.name}</span>
                  {c.phone ? <span className="text-ink-muted ml-2">{c.phone}</span> : null}
                </button>
              ))}
            </div>
          ) : null}

          {/* New Customer toggle */}
          <button
            onClick={() => setShowNewCustomer(!showNewCustomer)}
            className="text-[13px] text-brand hover:text-brand-hover font-medium"
          >
            {showNewCustomer ? 'Batal' : '+ Customer Baru'}
          </button>

          {/* Inline new customer form */}
          {showNewCustomer ? (
            <div className="bg-surface-subtle p-4 rounded-xl space-y-3 border border-border">
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Nama customer *"
                className={inputClass}
              />
              <input
                type="text"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Nomor telepon"
                className={inputClass}
              />
              <button
                onClick={createCustomer}
                disabled={!newCustomerName.trim() || isCreatingCustomer}
                className="px-4 py-3 bg-brand text-white rounded-xl text-[13px] font-semibold hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors press-scale"
              >
                {isCreatingCustomer ? 'Menyimpan...' : 'Simpan Customer'}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="bg-brand-subtle border border-brand/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-ink">{selectedCustomer.name}</div>
              {selectedCustomer.phone ? (
                <div className="text-[12px] text-ink-secondary">{selectedCustomer.phone}</div>
              ) : null}
            </div>
            <button
              onClick={() => {
                setSelectedCustomer(null)
                setSelectedVehicle(null)
                setCustomerVehicles([])
                setCustomerQuery('')
                setPlateQuery('')
              }}
              className="text-[12px] text-brand hover:text-brand-hover font-medium"
            >
              Ganti
            </button>
          </div>
        </div>
      )}

      {/* ===== SECTION: Vehicle Selection ===== */}
      {selectedCustomer !== null && selectedVehicle === null ? (
        <div className="space-y-2">
          <label className="block text-[13px] font-medium text-ink">Pilih Kendaraan</label>
          {customerVehicles.length > 0 ? (
            <div className="space-y-1.5">
              {customerVehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVehicle(v)}
                  className="w-full text-left px-4 py-3 bg-surface-raised border border-border rounded-xl hover:bg-surface-subtle hover:border-brand/40 text-[13px] text-ink transition-all"
                >
                  {formatPlate(v)}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-[13px] text-ink-muted">Belum ada kendaraan terdaftar.</div>
          )}

          {/* New Vehicle toggle */}
          <button
            onClick={() => setShowNewVehicle(!showNewVehicle)}
            className="text-[13px] text-brand hover:text-brand-hover font-medium"
          >
            {showNewVehicle ? 'Batal' : '+ Kendaraan Baru'}
          </button>

          {/* Inline new vehicle form */}
          {showNewVehicle ? (
            <div className="bg-surface-subtle p-4 rounded-xl space-y-3 border border-border">
              <input
                type="text"
                value={newVehiclePlate}
                onChange={(e) => setNewVehiclePlate(e.target.value)}
                placeholder="Plat nomor *"
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setNewVehicleType('MOTOR')}
                  className={`flex-1 py-[7px] px-4 rounded-[20px] text-[13px] font-medium transition-colors ${
                    newVehicleType === 'MOTOR'
                      ? 'bg-ink text-white'
                      : 'bg-surface-raised border border-border text-ink hover:bg-surface-subtle'
                  }`}
                >
                  Motor
                </button>
                <button
                  onClick={() => setNewVehicleType('MOBIL')}
                  className={`flex-1 py-[7px] px-4 rounded-[20px] text-[13px] font-medium transition-colors ${
                    newVehicleType === 'MOBIL'
                      ? 'bg-ink text-white'
                      : 'bg-surface-raised border border-border text-ink hover:bg-surface-subtle'
                  }`}
                >
                  Mobil
                </button>
              </div>
              <input
                type="text"
                value={newVehicleBrand}
                onChange={(e) => setNewVehicleBrand(e.target.value)}
                placeholder="Merek (Honda, Yamaha, ...)"
                className={inputClass}
              />
              <input
                type="text"
                value={newVehicleModel}
                onChange={(e) => setNewVehicleModel(e.target.value)}
                placeholder="Model (Vario 150, Avanza, ...)"
                className={inputClass}
              />
              <button
                onClick={createVehicle}
                disabled={!newVehiclePlate.trim() || isCreatingVehicle}
                className="px-4 py-3 bg-brand text-white rounded-xl text-[13px] font-semibold hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors press-scale"
              >
                {isCreatingVehicle ? 'Menyimpan...' : 'Simpan Kendaraan'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Selected vehicle info */}
      {selectedVehicle !== null ? (
        <div className="bg-success-muted border border-success/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-ink">{selectedVehicle.plateNumber}</div>
              <div className="text-[12px] text-ink-secondary">
                {selectedVehicle.vehicleType} {selectedVehicle.brand ? `— ${selectedVehicle.brand}` : ''} {selectedVehicle.model || ''}
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedVehicle(null)
                setPlateQuery('')
              }}
              className="text-[12px] text-success hover:text-success font-medium"
            >
              Ganti
            </button>
          </div>
        </div>
      ) : null}

      {/* ===== SECTION: Complaint + Create Order ===== */}
      {canCreateOrder ? (
        <div className="space-y-4 border-t border-border pt-5">
          <div className="space-y-2">
            <label className="block text-[13px] font-medium text-ink">Keluhan / Catatan</label>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Deskripsi keluhan kendaraan..."
              rows={3}
              className="w-full bg-surface-raised border border-border rounded-xl py-3 px-4 text-[13px] text-ink placeholder:text-ink-faint outline-none focus:border-brand focus:ring-2 focus:ring-brand-subtle resize-none transition-colors"
            />
          </div>
          <button
            data-testid="create-order-btn"
            onClick={createServiceOrder}
            disabled={isCreatingOrder}
            className="w-full py-3.5 bg-brand text-white rounded-xl text-[15px] font-semibold hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all press-scale"
          >
            {isCreatingOrder ? 'Membuat Order...' : 'Buat Service Order'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
