'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { Card, Badge } from '@/components/ui'
import { apiGet } from '@/lib/api'
import {
  Clock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Receipt,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  TrendingUp,
  Wallet,
  User,
  FileText,
} from 'lucide-react'

/* ─── Types ─── */

interface ShiftListItem {
  id: string
  cashierId: string
  cashierName: string
  status: string
  openingFloat: number
  closingCash: number | null
  openedAt: string
  closedAt: string | null
  totalSales: number
  transactionCount: number
  discrepancy: number | null
}

interface ShiftReconciliation {
  shiftId: string
  cashierId: string
  openedAt: string
  closedAt: string | null
  openingFloat: number
  totalSales: number
  salesByCash: number
  salesByTransfer: number
  salesByQris: number
  cashIn: number
  cashOut: number
  expectedCash: number
  actualCash: number
  discrepancy: number
}

interface DailyCashReport {
  date: string
  shifts: Array<{
    id: string
    cashierName: string
    openedAt: string
    closedAt: string | null
    openingFloat: number
    salesByCash: number
    salesByTransfer: number
    salesByQris: number
    cashIn: number
    cashOut: number
    closingCash: number | null
    expectedCash: number
    discrepancy: number
    transactionCount: number
  }>
  summary: {
    totalOpeningFloat: number
    totalSalesByCash: number
    totalSalesByTransfer: number
    totalSalesByQris: number
    totalSales: number
    totalCashIn: number
    totalCashOut: number
    totalExpectedCash: number
    totalActualCash: number
    totalDiscrepancy: number
    totalTransactions: number
  }
}

/* ─── Helpers ─── */

function formatRp(n: number): string {
  return `Rp ${n.toLocaleString('id-ID')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('id-ID', {
    hour: '2-digit', minute: '2-digit',
  })
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return 'Masih aktif'
  const ms = new Date(end).getTime() - new Date(start).getTime()
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  return h > 0 ? `${h}j ${m}m` : `${m} menit`
}

/* ─── Tabs ─── */
type Tab = 'history' | 'daily'

export default function ShiftHistoryPage() {
  const [tab, setTab] = useState<Tab>('daily')

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Riwayat Shift</h1>
          <p className="text-xs text-ink-muted mt-0.5">Laporan shift & rekap kas harian</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-surface-subtle p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('daily')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'daily'
              ? 'bg-white dark:bg-surface-raised text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <CalendarDays size={14} className="inline mr-1.5 -mt-0.5" />
          Laporan Kas Harian
        </button>
        <button
          onClick={() => setTab('history')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === 'history'
              ? 'bg-white dark:bg-surface-raised text-ink shadow-sm'
              : 'text-ink-muted hover:text-ink'
          }`}
        >
          <Clock size={14} className="inline mr-1.5 -mt-0.5" />
          Semua Shift
        </button>
      </div>

      {tab === 'daily' ? <DailyReportTab /> : <ShiftHistoryTab />}
    </DashboardLayout>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Daily Cash Report Tab                                                     */
/* ═══════════════════════════════════════════════════════════════════════════ */

function DailyReportTab() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [report, setReport] = useState<DailyCashReport | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    const res = await apiGet<DailyCashReport>(`/api/v1/shifts/daily-report?date=${date}`)
    if (res.success && res.data) setReport(res.data)
    setLoading(false)
  }, [date])

  useEffect(() => { fetchReport() }, [fetchReport])

  function changeDate(delta: number) {
    const d = new Date(date)
    d.setDate(d.getDate() + delta)
    setDate(d.toISOString().slice(0, 10))
  }

  const s = report?.summary

  return (
    <div className="flex flex-col gap-4">
      {/* Date navigator */}
      <Card className="flex items-center justify-between">
        <button onClick={() => changeDate(-1)} className="p-2 rounded-lg hover:bg-surface-subtle transition-colors">
          <ChevronLeft size={18} className="text-ink-muted" />
        </button>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-transparent text-sm font-semibold text-ink border border-border rounded-lg px-3 py-1.5 text-center"
          />
          <span className="text-xs text-ink-muted">
            {new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
        </div>
        <button onClick={() => changeDate(1)} className="p-2 rounded-lg hover:bg-surface-subtle transition-colors">
          <ChevronRight size={18} className="text-ink-muted" />
        </button>
      </Card>

      {loading ? (
        <Card className="py-16 flex items-center justify-center">
          <Loader2 size={24} className="text-ink-faint animate-spin" />
        </Card>
      ) : !report || report.shifts.length === 0 ? (
        <Card className="py-16 text-center">
          <FileText size={32} className="text-ink-faint mx-auto mb-3" />
          <p className="text-sm text-ink-muted">Tidak ada data shift untuk tanggal ini</p>
        </Card>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard
              label="Total Penjualan"
              value={formatRp(s!.totalSales)}
              sub={`${s!.totalTransactions} transaksi`}
              icon={<TrendingUp size={16} />}
              color="brand"
            />
            <SummaryCard
              label="Penjualan Tunai"
              value={formatRp(s!.totalSalesByCash)}
              sub={`Transfer ${formatRp(s!.totalSalesByTransfer)} · QRIS ${formatRp(s!.totalSalesByQris)}`}
              icon={<Banknote size={16} />}
              color="emerald"
            />
            <SummaryCard
              label="Kas Masuk / Keluar"
              value={`+${formatRp(s!.totalCashIn)}`}
              sub={`Keluar: -${formatRp(s!.totalCashOut)}`}
              icon={<Wallet size={16} />}
              color="blue"
            />
            <SummaryCard
              label="Selisih Kas"
              value={formatRp(Math.abs(s!.totalDiscrepancy))}
              sub={s!.totalDiscrepancy === 0 ? 'Pas' : s!.totalDiscrepancy > 0 ? 'Lebih' : 'Kurang'}
              icon={s!.totalDiscrepancy === 0 ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
              color={s!.totalDiscrepancy === 0 ? 'emerald' : s!.totalDiscrepancy > 0 ? 'blue' : 'red'}
            />
          </div>

          {/* Cash flow summary */}
          <Card>
            <h3 className="text-sm font-semibold text-ink mb-3">Rekap Arus Kas</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-2 text-sm">
                <FlowRow label="Modal Awal (Semua Shift)" value={s!.totalOpeningFloat} />
                <FlowRow label="Penjualan Tunai" value={s!.totalSalesByCash} positive />
                <FlowRow label="Kas Masuk" value={s!.totalCashIn} positive />
                <FlowRow label="Kas Keluar" value={s!.totalCashOut} negative />
                <div className="border-t border-border pt-2 font-semibold">
                  <FlowRow label="Kas yang Diharapkan" value={s!.totalExpectedCash} bold />
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <FlowRow label="Kas Aktual (Closing)" value={s!.totalActualCash} bold />
                <FlowRow
                  label="Selisih"
                  value={s!.totalDiscrepancy}
                  bold
                  discrepancy
                />
                <div className="border-t border-border pt-2">
                  <FlowRow label="Penjualan Transfer" value={s!.totalSalesByTransfer} />
                  <FlowRow label="Penjualan QRIS" value={s!.totalSalesByQris} />
                </div>
              </div>
            </div>
          </Card>

          {/* Per-shift breakdown */}
          <Card padding={false}>
            <div className="px-5 py-4">
              <h3 className="text-sm font-semibold text-ink">Detail per Shift ({report.shifts.length} shift)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-subtle border-y border-border-light">
                    <th className="text-left px-4 py-2.5 font-semibold text-ink-muted">Kasir</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-ink-muted">Waktu</th>
                    <th className="text-left px-4 py-2.5 font-semibold text-ink-muted">Durasi</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-ink-muted">Modal</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-ink-muted">Penjualan</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-ink-muted">Kas +/-</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-ink-muted">Closing</th>
                    <th className="text-right px-4 py-2.5 font-semibold text-ink-muted">Selisih</th>
                  </tr>
                </thead>
                <tbody>
                  {report.shifts.map(sh => (
                    <tr key={sh.id} className="border-b border-border-light hover:bg-surface-subtle transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center">
                            <User size={12} className="text-brand" />
                          </div>
                          <div>
                            <p className="font-medium text-ink">{sh.cashierName}</p>
                            <p className="text-[10px] text-ink-faint">{sh.transactionCount} transaksi</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">
                        {formatTime(sh.openedAt)}
                        {sh.closedAt && <span className="text-ink-faint"> → {formatTime(sh.closedAt)}</span>}
                      </td>
                      <td className="px-4 py-3 text-ink-secondary">{formatDuration(sh.openedAt, sh.closedAt)}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-secondary">{formatRp(sh.openingFloat)}</td>
                      <td className="px-4 py-3 text-right font-mono font-medium text-ink">
                        {formatRp(sh.salesByCash + sh.salesByTransfer + sh.salesByQris)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {(sh.cashIn > 0 || sh.cashOut > 0) ? (
                          <span>
                            {sh.cashIn > 0 && <span className="text-emerald-600">+{formatRp(sh.cashIn)}</span>}
                            {sh.cashIn > 0 && sh.cashOut > 0 && ' / '}
                            {sh.cashOut > 0 && <span className="text-red-500">-{formatRp(sh.cashOut)}</span>}
                          </span>
                        ) : (
                          <span className="text-ink-faint">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-ink">
                        {sh.closingCash != null ? formatRp(sh.closingCash) : <span className="text-ink-faint">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium">
                        {sh.closedAt ? (
                          <span className={
                            sh.discrepancy === 0 ? 'text-emerald-600' :
                            sh.discrepancy > 0 ? 'text-blue-600' : 'text-red-500'
                          }>
                            {sh.discrepancy > 0 ? '+' : ''}{formatRp(sh.discrepancy)}
                          </span>
                        ) : (
                          <Badge color="neutral">Aktif</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Shift History Tab                                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

function ShiftHistoryTab() {
  const [items, setItems] = useState<ShiftListItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selectedShift, setSelectedShift] = useState<string | null>(null)
  const [reconciliation, setReconciliation] = useState<ShiftReconciliation | null>(null)
  const [reconLoading, setReconLoading] = useState(false)

  const LIMIT = 20

  const fetchShifts = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (statusFilter) params.set('status', statusFilter)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)

    const res = await apiGet<{ items: ShiftListItem[]; total: number }>(`/api/v1/shifts/history?${params}`)
    if (res.success && res.data) {
      setItems(res.data.items)
      setTotal(res.data.total)
    }
    setLoading(false)
  }, [page, statusFilter, dateFrom, dateTo])

  useEffect(() => { fetchShifts() }, [fetchShifts])

  async function viewReconciliation(shiftId: string) {
    if (selectedShift === shiftId) {
      setSelectedShift(null)
      setReconciliation(null)
      return
    }
    setSelectedShift(shiftId)
    setReconLoading(true)
    const res = await apiGet<ShiftReconciliation>(`/api/v1/shifts/${shiftId}/reconciliation`)
    if (res.success && res.data) setReconciliation(res.data)
    setReconLoading(false)
  }

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-3">
        <Filter size={14} className="text-ink-muted" />
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
          className="text-xs border border-border rounded-lg px-3 py-2 bg-transparent text-ink"
        >
          <option value="">Semua Status</option>
          <option value="OPEN">Aktif</option>
          <option value="CLOSED">Ditutup</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          placeholder="Dari"
          className="text-xs border border-border rounded-lg px-3 py-2 bg-transparent text-ink"
        />
        <span className="text-xs text-ink-muted">s/d</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1) }}
          placeholder="Sampai"
          className="text-xs border border-border rounded-lg px-3 py-2 bg-transparent text-ink"
        />
        {(statusFilter || dateFrom || dateTo) && (
          <button
            onClick={() => { setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1) }}
            className="text-xs text-brand hover:underline"
          >
            Reset
          </button>
        )}
        <span className="ml-auto text-xs text-ink-muted">{total} shift ditemukan</span>
      </Card>

      {/* Table */}
      <Card padding={false}>
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 size={24} className="text-ink-faint animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <Clock size={32} className="text-ink-faint mx-auto mb-3" />
            <p className="text-sm text-ink-muted">Tidak ada data shift</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-subtle border-b border-border-light">
                    <th className="text-left px-4 py-3 font-semibold text-ink-muted">Kasir</th>
                    <th className="text-left px-4 py-3 font-semibold text-ink-muted">Tanggal</th>
                    <th className="text-left px-4 py-3 font-semibold text-ink-muted">Waktu</th>
                    <th className="text-left px-4 py-3 font-semibold text-ink-muted">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-ink-muted">Modal</th>
                    <th className="text-right px-4 py-3 font-semibold text-ink-muted">Penjualan</th>
                    <th className="text-right px-4 py-3 font-semibold text-ink-muted">Transaksi</th>
                    <th className="text-center px-4 py-3 font-semibold text-ink-muted">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(shift => (
                    <>
                      <tr
                        key={shift.id}
                        className={`border-b border-border-light hover:bg-surface-subtle transition-colors cursor-pointer ${
                          selectedShift === shift.id ? 'bg-surface-subtle' : ''
                        }`}
                        onClick={() => shift.status === 'CLOSED' && viewReconciliation(shift.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-brand/10 flex items-center justify-center flex-shrink-0">
                              <User size={12} className="text-brand" />
                            </div>
                            <span className="font-medium text-ink">{shift.cashierName}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-ink-secondary">{formatDate(shift.openedAt)}</td>
                        <td className="px-4 py-3 text-ink-secondary">
                          {formatTime(shift.openedAt)}
                          {shift.closedAt && <span className="text-ink-faint"> → {formatTime(shift.closedAt)}</span>}
                        </td>
                        <td className="px-4 py-3">
                          {shift.status === 'OPEN' ? (
                            <Badge color="green">Aktif</Badge>
                          ) : (
                            <Badge color="neutral">Ditutup</Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-ink-secondary">{formatRp(shift.openingFloat)}</td>
                        <td className="px-4 py-3 text-right font-mono font-medium text-ink">{formatRp(shift.totalSales)}</td>
                        <td className="px-4 py-3 text-right text-ink-secondary">{shift.transactionCount}</td>
                        <td className="px-4 py-3 text-center">
                          {shift.status === 'CLOSED' ? (
                            <button className="text-brand hover:underline text-[11px] font-medium">
                              {selectedShift === shift.id ? 'Tutup' : 'Lihat'}
                            </button>
                          ) : (
                            <span className="text-ink-faint text-[11px]">—</span>
                          )}
                        </td>
                      </tr>
                      {selectedShift === shift.id && (
                        <tr key={`${shift.id}-detail`}>
                          <td colSpan={8} className="px-4 py-4 bg-surface-subtle border-b border-border">
                            {reconLoading ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 size={18} className="text-ink-faint animate-spin" />
                              </div>
                            ) : reconciliation ? (
                              <ReconciliationDetail data={reconciliation} />
                            ) : null}
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border-light">
                <span className="text-xs text-ink-muted">
                  Halaman {page} dari {totalPages}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-surface-subtle disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-surface-subtle disabled:opacity-30 transition-colors"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════ */
/* Shared Components                                                         */
/* ═══════════════════════════════════════════════════════════════════════════ */

function ReconciliationDetail({ data }: { data: ShiftReconciliation }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
      <div>
        <p className="text-ink-muted font-medium mb-1">Penjualan</p>
        <div className="space-y-1">
          <div className="flex justify-between"><span>Tunai</span><span className="font-mono">{formatRp(data.salesByCash)}</span></div>
          <div className="flex justify-between"><span>Transfer</span><span className="font-mono">{formatRp(data.salesByTransfer)}</span></div>
          <div className="flex justify-between"><span>QRIS</span><span className="font-mono">{formatRp(data.salesByQris)}</span></div>
          <div className="flex justify-between font-semibold border-t border-border pt-1">
            <span>Total</span><span className="font-mono">{formatRp(data.totalSales)}</span>
          </div>
        </div>
      </div>
      <div>
        <p className="text-ink-muted font-medium mb-1">Kas Non-Penjualan</p>
        <div className="space-y-1">
          <div className="flex justify-between"><span>Kas Masuk</span><span className="font-mono text-emerald-600">+{formatRp(data.cashIn)}</span></div>
          <div className="flex justify-between"><span>Kas Keluar</span><span className="font-mono text-red-500">-{formatRp(data.cashOut)}</span></div>
        </div>
      </div>
      <div>
        <p className="text-ink-muted font-medium mb-1">Perhitungan Kas</p>
        <div className="space-y-1">
          <div className="flex justify-between"><span>Modal Awal</span><span className="font-mono">{formatRp(data.openingFloat)}</span></div>
          <div className="flex justify-between"><span>+ Tunai</span><span className="font-mono">{formatRp(data.salesByCash)}</span></div>
          <div className="flex justify-between"><span>+ Kas Masuk</span><span className="font-mono">{formatRp(data.cashIn)}</span></div>
          <div className="flex justify-between"><span>- Kas Keluar</span><span className="font-mono">{formatRp(data.cashOut)}</span></div>
          <div className="flex justify-between font-semibold border-t border-border pt-1">
            <span>Diharapkan</span><span className="font-mono">{formatRp(data.expectedCash)}</span>
          </div>
        </div>
      </div>
      <div>
        <p className="text-ink-muted font-medium mb-1">Rekonsiliasi</p>
        <div className="space-y-1">
          <div className="flex justify-between"><span>Kas Aktual</span><span className="font-mono font-semibold">{formatRp(data.actualCash)}</span></div>
          <div className="flex justify-between"><span>Diharapkan</span><span className="font-mono">{formatRp(data.expectedCash)}</span></div>
          <div className={`flex justify-between font-bold border-t border-border pt-1 ${
            data.discrepancy === 0 ? 'text-emerald-600' : data.discrepancy > 0 ? 'text-blue-600' : 'text-red-500'
          }`}>
            <span>Selisih</span>
            <span className="font-mono">
              {data.discrepancy > 0 ? '+' : ''}{formatRp(data.discrepancy)}
              {data.discrepancy === 0 && ' ✓'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, sub, icon, color }: {
  label: string; value: string; sub: string; icon: React.ReactNode; color: string
}) {
  const colorMap: Record<string, string> = {
    brand: 'bg-brand/10 text-brand',
    emerald: 'bg-emerald-500/10 text-emerald-600',
    blue: 'bg-blue-500/10 text-blue-600',
    red: 'bg-red-500/10 text-red-500',
  }
  return (
    <Card>
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">{label}</p>
          <p className="text-base font-bold text-ink mt-1 truncate">{value}</p>
          <p className="text-[11px] text-ink-muted mt-0.5 truncate">{sub}</p>
        </div>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorMap[color] ?? colorMap.brand}`}>
          {icon}
        </div>
      </div>
    </Card>
  )
}

function FlowRow({ label, value, positive, negative, bold, discrepancy }: {
  label: string; value: number; positive?: boolean; negative?: boolean; bold?: boolean; discrepancy?: boolean
}) {
  let valueClass = 'text-ink'
  if (positive && value > 0) valueClass = 'text-emerald-600'
  if (negative && value > 0) valueClass = 'text-red-500'
  if (discrepancy) {
    valueClass = value === 0 ? 'text-emerald-600' : value > 0 ? 'text-blue-600' : 'text-red-500'
  }

  const prefix = positive && value > 0 ? '+' : negative && value > 0 ? '-' : discrepancy && value > 0 ? '+' : ''

  return (
    <div className={`flex justify-between ${bold ? 'font-semibold' : ''}`}>
      <span className="text-ink-secondary">{label}</span>
      <span className={`font-mono ${valueClass}`}>{prefix}{formatRp(Math.abs(value))}</span>
    </div>
  )
}
