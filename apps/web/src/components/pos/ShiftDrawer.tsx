'use client'

import { useState } from 'react'
import { useShiftStore, type ActiveShift } from '@/lib/store/shift.store'

interface Props {
  isOpen: boolean
  onClose: () => void
}

interface ReconciliationData {
  openingFloat: number
  salesByMethod: { CASH: number; TRANSFER: number; QRIS: number }
  expectedCash: number
  actualCash: number
  discrepancy: number
}

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function ShiftDrawer({ isOpen, onClose }: Props) {
  const { activeShift, setActiveShift } = useShiftStore()

  // Open shift form state
  const [openingFloat, setOpeningFloat] = useState<number>(0)
  const [isOpeningShift, setIsOpeningShift] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  // Close shift form state
  const [closingCash, setClosingCash] = useState<number>(0)
  const [isClosingShift, setIsClosingShift] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null)

  async function handleOpenShift() {
    setIsOpeningShift(true)
    setOpenError(null)
    try {
      const res = await fetch('/api/v1/shifts/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ openingFloat }),
      })
      const body = await res.json() as {
        success: boolean
        data?: { id: string; cashierId: string; openingFloat: number; openedAt: string }
        error?: string
      }
      if (!res.ok || !body.success) {
        const msg = body.error ?? `HTTP ${res.status}`
        if (msg.includes('SHIFT_ALREADY_OPEN')) {
          setOpenError('Shift sudah aktif')
        } else {
          setOpenError(msg)
        }
        return
      }
      const shift = body.data!
      const newShift: ActiveShift = {
        id: shift.id,
        cashierId: shift.cashierId,
        openingFloat: shift.openingFloat,
        openedAt: shift.openedAt,
      }
      setActiveShift(newShift)
      onClose()
    } catch {
      setOpenError('Gagal menghubungi server')
    } finally {
      setIsOpeningShift(false)
    }
  }

  async function handleCloseShift() {
    if (!activeShift) return
    setIsClosingShift(true)
    setCloseError(null)
    try {
      const res = await fetch('/api/v1/shifts/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId: activeShift.id, closingCash }),
      })
      const body = await res.json() as {
        success: boolean
        data?: {
          openingFloat: number
          salesByMethod: { CASH: number; TRANSFER: number; QRIS: number }
          expectedCash: number
          actualCash: number
          discrepancy: number
        }
        error?: string
      }
      if (!res.ok || !body.success) {
        setCloseError(body.error ?? `HTTP ${res.status}`)
        return
      }
      setReconciliation(body.data!)
    } catch {
      setCloseError('Gagal menghubungi server')
    } finally {
      setIsClosingShift(false)
    }
  }

  function handleDone() {
    setActiveShift(null)
    setReconciliation(null)
    setClosingCash(0)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">
            {activeShift ? 'Tutup Shift' : 'Buka Shift'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* ─── No active shift: Open form ─── */}
          {!activeShift && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kas Awal (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={openingFloat}
                  onChange={e => setOpeningFloat(parseInt(e.target.value, 10) || 0)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="mis: 500000"
                />
              </div>

              {openError && (
                <p className="text-red-600 text-sm">{openError}</p>
              )}

              <button
                onClick={handleOpenShift}
                disabled={isOpeningShift}
                className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isOpeningShift ? 'Membuka...' : 'Buka Shift'}
              </button>
            </>
          )}

          {/* ─── Active shift: Close form or Reconciliation ─── */}
          {activeShift && !reconciliation && (
            <>
              {/* Current shift info */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Shift ID</span>
                  <span className="font-mono text-xs">{activeShift.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Dibuka pukul</span>
                  <span>{formatTime(activeShift.openedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Kas awal</span>
                  <span>{formatRp(activeShift.openingFloat)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kas Aktual (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={closingCash}
                  onChange={e => setClosingCash(parseInt(e.target.value, 10) || 0)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Jumlah kas di laci"
                />
              </div>

              {closeError && (
                <p className="text-red-600 text-sm">{closeError}</p>
              )}

              <button
                onClick={handleCloseShift}
                disabled={isClosingShift}
                className="w-full bg-red-600 text-white rounded-lg py-3 font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClosingShift ? 'Menutup...' : 'Tutup Shift'}
              </button>
            </>
          )}

          {/* ─── Reconciliation result ─── */}
          {activeShift && reconciliation && (
            <>
              <div className="space-y-2 text-sm">
                <h3 className="font-semibold text-gray-900">Rekonsiliasi Shift</h3>

                <div className="flex justify-between">
                  <span className="text-gray-500">Kas Awal</span>
                  <span>{formatRp(reconciliation.openingFloat)}</span>
                </div>

                <div className="border-t pt-2 space-y-1">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Penjualan</p>
                  <div className="flex justify-between">
                    <span className="text-gray-500">TUNAI</span>
                    <span>{formatRp(reconciliation.salesByMethod.CASH)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">TRANSFER</span>
                    <span>{formatRp(reconciliation.salesByMethod.TRANSFER)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">QRIS</span>
                    <span>{formatRp(reconciliation.salesByMethod.QRIS)}</span>
                  </div>
                </div>

                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Kas yang Diharapkan</span>
                    <span>{formatRp(reconciliation.expectedCash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Kas Aktual</span>
                    <span>{formatRp(reconciliation.actualCash)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-gray-700">Selisih</span>
                    <span className={reconciliation.discrepancy === 0 ? 'text-green-600' : 'text-red-600'}>
                      {reconciliation.discrepancy >= 0 ? '+' : ''}{formatRp(reconciliation.discrepancy)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleDone}
                className="w-full bg-blue-600 text-white rounded-lg py-3 font-semibold hover:bg-blue-700"
              >
                Selesai
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
