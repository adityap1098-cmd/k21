'use client'

import { useState, useEffect } from 'react'
import { useShiftStore, type ActiveShift } from '@/lib/store/shift.store'
import { authFetch } from '@/lib/auth-fetch'

interface Props {
  isOpen: boolean
  onClose: () => void
}

interface ReconciliationData {
  openingFloat: number
  salesByCash: number
  salesByTransfer: number
  salesByQris: number
  cashIn: number
  cashOut: number
  expectedCash: number
  actualCash: number
  discrepancy: number
  // legacy compat
  salesByMethod?: { CASH: number; TRANSFER: number; QRIS: number }
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
  const [openingFloatDisplay, setOpeningFloatDisplay] = useState<string>('')
  const [isOpeningShift, setIsOpeningShift] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  // Close shift form state
  const [closingCash, setClosingCash] = useState<number>(0)
  const [closingCashDisplay, setClosingCashDisplay] = useState<string>('')
  const [isClosingShift, setIsClosingShift] = useState(false)
  const [closeError, setCloseError] = useState<string | null>(null)
  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null)

  // Live expected cash (fetched when close form opens)
  const [liveRecon, setLiveRecon] = useState<ReconciliationData | null>(null)
  const [loadingRecon, setLoadingRecon] = useState(false)

  // Fetch live reconciliation when drawer opens and shift is active
  useEffect(() => {
    if (!isOpen || !activeShift || reconciliation) return
    setLoadingRecon(true)
    authFetch(`/api/v1/shifts/${activeShift.id}/reconciliation`)
      .then(r => r.json())
      .then((body: { success: boolean; data?: ReconciliationData }) => {
        if (body.success && body.data) setLiveRecon(body.data)
      })
      .catch(() => {})
      .finally(() => setLoadingRecon(false))
  }, [isOpen, activeShift, reconciliation])

  function handleFloatInput(raw: string, setter: (n: number) => void, displaySetter: (s: string) => void) {
    // Strip semua non-digit
    const digits = raw.replace(/\D/g, '')
    if (digits === '') {
      setter(0)
      displaySetter('')
      return
    }
    const num = parseInt(digits, 10)
    setter(num)
    displaySetter(num.toLocaleString('id-ID'))
  }

  async function handleOpenShift() {
    setIsOpeningShift(true)
    setOpenError(null)
    try {
      const res = await authFetch('/api/v1/shifts/open', {
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
      const res = await authFetch('/api/v1/shifts/close', {
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
      const raw = body.data!
      // Normalize: backend may return salesByMethod or salesByCash/Transfer/Qris
      setReconciliation({
        ...raw,
        salesByCash: raw.salesByMethod?.CASH ?? (raw as any).salesByCash ?? 0,
        salesByTransfer: raw.salesByMethod?.TRANSFER ?? (raw as any).salesByTransfer ?? 0,
        salesByQris: raw.salesByMethod?.QRIS ?? (raw as any).salesByQris ?? 0,
        cashIn: (raw as any).cashIn ?? 0,
        cashOut: (raw as any).cashOut ?? 0,
      })
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
      <div className="bg-surface-raised rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md mx-0 sm:mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold text-ink">
            {activeShift ? 'Tutup Shift' : 'Buka Shift'}
          </h2>
          <button
            onClick={onClose}
            className="text-ink-faint hover:text-ink-secondary text-2xl leading-none"
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
                <label className="block text-sm font-medium text-ink-secondary mb-1">
                  Kas Awal (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={openingFloatDisplay}
                  onChange={e => handleFloatInput(e.target.value, setOpeningFloat, setOpeningFloatDisplay)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="mis: 500.000"
                />
              </div>

              {openError && (
                <p className="text-danger text-sm">{openError}</p>
              )}

              <button
                onClick={handleOpenShift}
                disabled={isOpeningShift}
                className="w-full bg-brand text-white rounded-lg py-3 font-semibold hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isOpeningShift ? 'Membuka...' : 'Buka Shift'}
              </button>
            </>
          )}

          {/* ─── Active shift: Close form or Reconciliation ─── */}
          {activeShift && !reconciliation && (
            <>
              {/* Current shift info */}
              <div className="bg-surface rounded-lg p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Shift ID</span>
                  <span className="font-mono text-xs">{activeShift.id.slice(0, 8)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Dibuka pukul</span>
                  <span>{formatTime(activeShift.openedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-muted">Kas awal</span>
                  <span>{formatRp(activeShift.openingFloat)}</span>
                </div>
              </div>

              {/* ─── Live expected cash panel ─── */}
              {loadingRecon && (
                <div className="flex items-center gap-2 text-xs text-ink-muted py-1">
                  <div className="w-3.5 h-3.5 border-2 border-brand border-t-transparent rounded-full animate-spin shrink-0" />
                  Menghitung posisi kas...
                </div>
              )}
              {liveRecon && !loadingRecon && (
                <div className="bg-surface rounded-lg p-3 space-y-2 text-sm border border-border">
                  <p className="text-xs font-semibold text-ink-secondary uppercase tracking-wide">Posisi Kas Saat Ini</p>

                  <div className="space-y-1">
                    <div className="flex justify-between text-ink-muted">
                      <span>Kas awal</span>
                      <span>{formatRp(liveRecon.openingFloat)}</span>
                    </div>
                    <div className="flex justify-between text-ink-muted">
                      <span>+ Penjualan tunai</span>
                      <span className="text-success">+{formatRp(liveRecon.salesByCash)}</span>
                    </div>
                    {liveRecon.cashIn > 0 && (
                      <div className="flex justify-between text-ink-muted">
                        <span>+ Kas masuk</span>
                        <span className="text-success">+{formatRp(liveRecon.cashIn)}</span>
                      </div>
                    )}
                    {liveRecon.cashOut > 0 && (
                      <div className="flex justify-between text-ink-muted">
                        <span>− Kas keluar</span>
                        <span className="text-danger">−{formatRp(liveRecon.cashOut)}</span>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border pt-2 flex justify-between font-semibold text-ink">
                    <span>Kas yang seharusnya ada</span>
                    <span className="text-brand font-mono">{formatRp(liveRecon.expectedCash)}</span>
                  </div>

                  {liveRecon.salesByTransfer > 0 || liveRecon.salesByQris > 0 ? (
                    <div className="pt-1 space-y-1 border-t border-border">
                      <p className="text-[11px] text-ink-muted">Non-tunai (tidak masuk laci):</p>
                      {liveRecon.salesByTransfer > 0 && (
                        <div className="flex justify-between text-ink-muted text-[12px]">
                          <span>Transfer</span>
                          <span>{formatRp(liveRecon.salesByTransfer)}</span>
                        </div>
                      )}
                      {liveRecon.salesByQris > 0 && (
                        <div className="flex justify-between text-ink-muted text-[12px]">
                          <span>QRIS</span>
                          <span>{formatRp(liveRecon.salesByQris)}</span>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-ink-secondary mb-1">
                  Kas Aktual di Laci (Rp)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={closingCashDisplay}
                  onChange={e => handleFloatInput(e.target.value, setClosingCash, setClosingCashDisplay)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="mis: 500.000"
                />
                {/* Selisih preview real-time */}
                {liveRecon && closingCashDisplay !== '' && (() => {
                  const diff = closingCash - liveRecon.expectedCash
                  const isExact = diff === 0
                  const isOver = diff > 0
                  return (
                    <div className={`mt-2 flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold ${
                      isExact ? 'bg-success/10 text-success' : isOver ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'
                    }`}>
                      <span>{isExact ? 'Pas ✓' : isOver ? 'Kelebihan' : 'Kekurangan'}</span>
                      <span className="font-mono">
                        {isExact ? 'Rp 0' : `${isOver ? '+' : ''}${formatRp(diff)}`}
                      </span>
                    </div>
                  )
                })()}
              </div>

              {closeError && (
                <p className="text-danger text-sm">{closeError}</p>
              )}

              <button
                onClick={handleCloseShift}
                disabled={isClosingShift}
                className="w-full bg-danger text-white rounded-lg py-3 font-semibold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isClosingShift ? 'Menutup...' : 'Tutup Shift'}
              </button>
            </>
          )}

          {/* ─── Reconciliation result ─── */}
          {activeShift && reconciliation && (
            <>
              <div className="space-y-2 text-sm">
                <h3 className="font-semibold text-ink">Rekonsiliasi Shift</h3>

                <div className="flex justify-between">
                  <span className="text-ink-muted">Kas Awal</span>
                  <span>{formatRp(reconciliation.openingFloat)}</span>
                </div>

                <div className="border-t pt-2 space-y-1">
                  <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">Penjualan</p>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Tunai</span>
                    <span>{formatRp(reconciliation.salesByCash ?? reconciliation.salesByMethod?.CASH ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Transfer</span>
                    <span>{formatRp(reconciliation.salesByTransfer ?? reconciliation.salesByMethod?.TRANSFER ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">QRIS</span>
                    <span>{formatRp(reconciliation.salesByQris ?? reconciliation.salesByMethod?.QRIS ?? 0)}</span>
                  </div>
                </div>

                {((reconciliation.cashIn ?? 0) > 0 || (reconciliation.cashOut ?? 0) > 0) && (
                  <div className="border-t pt-2 space-y-1">
                    <p className="text-xs font-medium text-ink-muted uppercase tracking-wide">Kas Masuk / Keluar</p>
                    {(reconciliation.cashIn ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-ink-muted">Kas Masuk</span>
                        <span className="text-success">+{formatRp(reconciliation.cashIn)}</span>
                      </div>
                    )}
                    {(reconciliation.cashOut ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-ink-muted">Kas Keluar</span>
                        <span className="text-red-400">-{formatRp(reconciliation.cashOut)}</span>
                      </div>
                    )}
                  </div>
                )}

                <div className="border-t pt-2 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Kas yang Diharapkan</span>
                    <span>{formatRp(reconciliation.expectedCash)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-ink-muted">Kas Aktual</span>
                    <span>{formatRp(reconciliation.actualCash)}</span>
                  </div>
                  <div className="flex justify-between font-semibold">
                    <span className="text-ink-secondary">Selisih</span>
                    <span className={reconciliation.discrepancy === 0 ? 'text-success' : 'text-danger'}>
                      {reconciliation.discrepancy >= 0 ? '+' : ''}{formatRp(reconciliation.discrepancy)}
                    </span>
                  </div>
                </div>

                {/* Warning banner kalau ada selisih */}
                {reconciliation.discrepancy !== 0 && (
                  <div className={`rounded-lg px-3 py-2.5 text-sm flex gap-2 items-start ${
                    reconciliation.discrepancy < 0
                      ? 'bg-danger/10 text-danger'
                      : 'bg-warning/10 text-warning'
                  }`}>
                    <span className="text-base leading-none mt-0.5">⚠️</span>
                    <div>
                      <p className="font-semibold text-[13px]">
                        {reconciliation.discrepancy < 0 ? 'Kas Kurang' : 'Kas Lebih'}
                      </p>
                      <p className="text-[12px] mt-0.5 opacity-90">
                        {reconciliation.discrepancy < 0
                          ? 'Kemungkinan ada pemakaian kas yang tidak tercatat. Selisih ini sudah dicatat otomatis sebagai kas keluar.'
                          : 'Kemungkinan ada pemasukan yang tidak tercatat atau kembalian kurang diberikan. Selisih ini sudah dicatat otomatis sebagai kas masuk.'}
                      </p>
                      <p className="text-[11px] mt-1 font-medium opacity-75">
                        Cek detail di Riwayat Shift → Kas Masuk/Keluar
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={handleDone}
                className="w-full bg-brand text-white rounded-lg py-3 font-semibold hover:bg-brand-hover"
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
