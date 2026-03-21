'use client'

import { useState, useCallback } from 'react'

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
      const res = await fetch(`/api/v1/vehicles/search?plateNumber=${encodeURIComponent(q)}`)
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
        const res = await fetch(`/api/v1/customers/${vehicle.customerId}`)
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
      const res = await fetch(`/api/v1/customers/search?q=${encodeURIComponent(q)}`)
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
      const res = await fetch(`/api/v1/vehicles?customerId=${customer.id}`)
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
      const res = await fetch('/api/v1/customers', {
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
      const res = await fetch('/api/v1/vehicles', {
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
      const res = await fetch('/api/v1/service-orders', {
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
    <div data-testid="customer-vehicle-form" className="flex flex-col gap-4 p-4 max-w-2xl">
      <h2 className="text-lg font-semibold text-gray-900">Order Service Baru</h2>

      {/* Error banner */}
      {error !== null ? (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline text-red-600 hover:text-red-800">Tutup</button>
        </div>
      ) : null}

      {/* ===== SECTION: Plate Number Search ===== */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">Cari Plat Nomor</label>
        <input
          data-testid="plate-search-input"
          type="text"
          value={plateQuery}
          onChange={(e) => searchByPlate(e.target.value)}
          placeholder="Contoh: B 1234 XYZ"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {plateSearching ? (
          <div className="text-xs text-gray-400">Mencari...</div>
        ) : null}
        {plateResults.length > 0 ? (
          <div className="border border-gray-200 rounded-lg bg-white shadow-sm max-h-40 overflow-y-auto">
            {plateResults.map((v) => (
              <button
                key={v.id}
                onClick={() => selectVehicleFromPlate(v)}
                className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-b-0"
              >
                <span className="font-medium">{v.plateNumber}</span>
                <span className="text-gray-500 ml-2">
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
          <label className="block text-sm font-medium text-gray-700">Cari Customer</label>
          <input
            data-testid="customer-search-input"
            type="text"
            value={customerQuery}
            onChange={(e) => searchCustomers(e.target.value)}
            placeholder="Nama atau nomor telepon"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {customerSearching ? (
            <div className="text-xs text-gray-400">Mencari...</div>
          ) : null}
          {customerResults.length > 0 ? (
            <div className="border border-gray-200 rounded-lg bg-white shadow-sm max-h-40 overflow-y-auto">
              {customerResults.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCustomer(c)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-b-0"
                >
                  <span className="font-medium">{c.name}</span>
                  {c.phone ? <span className="text-gray-500 ml-2">{c.phone}</span> : null}
                </button>
              ))}
            </div>
          ) : null}

          {/* New Customer toggle */}
          <button
            onClick={() => setShowNewCustomer(!showNewCustomer)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {showNewCustomer ? 'Batal' : '+ Customer Baru'}
          </button>

          {/* Inline new customer form */}
          {showNewCustomer ? (
            <div className="bg-gray-50 p-3 rounded-lg space-y-2 border border-gray-200">
              <input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Nama customer *"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Nomor telepon"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={createCustomer}
                disabled={!newCustomerName.trim() || isCreatingCustomer}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingCustomer ? 'Menyimpan...' : 'Simpan Customer'}
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-blue-900">{selectedCustomer.name}</div>
              {selectedCustomer.phone ? (
                <div className="text-xs text-blue-700">{selectedCustomer.phone}</div>
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
              className="text-xs text-blue-600 hover:text-blue-800 underline"
            >
              Ganti
            </button>
          </div>
        </div>
      )}

      {/* ===== SECTION: Vehicle Selection ===== */}
      {selectedCustomer !== null && selectedVehicle === null ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">Pilih Kendaraan</label>
          {customerVehicles.length > 0 ? (
            <div className="space-y-1">
              {customerVehicles.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVehicle(v)}
                  className="w-full text-left px-3 py-2 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 text-sm"
                >
                  {formatPlate(v)}
                </button>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-500">Belum ada kendaraan terdaftar.</div>
          )}

          {/* New Vehicle toggle */}
          <button
            onClick={() => setShowNewVehicle(!showNewVehicle)}
            className="text-sm text-blue-600 hover:text-blue-800 underline"
          >
            {showNewVehicle ? 'Batal' : '+ Kendaraan Baru'}
          </button>

          {/* Inline new vehicle form */}
          {showNewVehicle ? (
            <div className="bg-gray-50 p-3 rounded-lg space-y-2 border border-gray-200">
              <input
                type="text"
                value={newVehiclePlate}
                onChange={(e) => setNewVehiclePlate(e.target.value)}
                placeholder="Plat nomor *"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => setNewVehicleType('MOTOR')}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium border ${
                    newVehicleType === 'MOTOR'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Motor
                </button>
                <button
                  onClick={() => setNewVehicleType('MOBIL')}
                  className={`flex-1 px-3 py-2 rounded text-sm font-medium border ${
                    newVehicleType === 'MOBIL'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
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
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                value={newVehicleModel}
                onChange={(e) => setNewVehicleModel(e.target.value)}
                placeholder="Model (Vario 150, Avanza, ...)"
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={createVehicle}
                disabled={!newVehiclePlate.trim() || isCreatingVehicle}
                className="px-4 py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingVehicle ? 'Menyimpan...' : 'Simpan Kendaraan'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Selected vehicle info */}
      {selectedVehicle !== null ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-green-900">{selectedVehicle.plateNumber}</div>
              <div className="text-xs text-green-700">
                {selectedVehicle.vehicleType} {selectedVehicle.brand ? `— ${selectedVehicle.brand}` : ''} {selectedVehicle.model || ''}
              </div>
            </div>
            <button
              onClick={() => {
                setSelectedVehicle(null)
                setPlateQuery('')
              }}
              className="text-xs text-green-600 hover:text-green-800 underline"
            >
              Ganti
            </button>
          </div>
        </div>
      ) : null}

      {/* ===== SECTION: Complaint + Create Order ===== */}
      {canCreateOrder ? (
        <div className="space-y-3 border-t border-gray-200 pt-4">
          <div className="space-y-1">
            <label className="block text-sm font-medium text-gray-700">Keluhan / Catatan</label>
            <textarea
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
              placeholder="Deskripsi keluhan kendaraan..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <button
            data-testid="create-order-btn"
            onClick={createServiceOrder}
            disabled={isCreatingOrder}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreatingOrder ? 'Membuat Order...' : 'Buat Service Order'}
          </button>
        </div>
      ) : null}
    </div>
  )
}
