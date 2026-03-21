'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Card, Badge, MetricCard } from '@/components/ui'
import { DateRangePicker } from '@/components/ui/DateRangePicker'
import { apiGet } from '@/lib/api'
import {
  Download,
  TrendingUp,
  TrendingDown,
  Loader2,
} from 'lucide-react'

/* ─── Types ─── */

type ReportTab = 'pnl' | 'balance' | 'cashflow'

interface PnlLineItem { code: string; name: string; amount: number }
interface PnlReport { revenue: PnlLineItem[]; expenses: PnlLineItem[]; netIncome: number }
interface BalanceItem { code: string; name: string; balance: number }
interface BalanceReport {
  assets: BalanceItem[]; liabilities: BalanceItem[]; equity: BalanceItem[]
  totalAssets: number; totalLiabilitiesAndEquity: number; isBalanced: boolean
}
interface CashFlowItem { sourceType: string; netFlow: number }
interface CashFlowReport { operating: CashFlowItem[]; totalNetFlow: number }

function formatRp(amount: number): string {
  return `Rp ${Math.abs(amount).toLocaleString('id-ID')}`
}

const SOURCE_LABELS: Record<string, string> = {
  'POS_SALE': 'Penjualan POS',
  'MARKETPLACE_SALE': 'Penjualan Marketplace',
  'PURCHASE': 'Pembelian Barang',
  'SUPPLIER_PAYMENT': 'Pembayaran Supplier',
  'PAYROLL': 'Gaji Karyawan',
  'VOID': 'Void / Pembatalan',
}

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'pnl', label: 'Laba Rugi' },
  { id: 'balance', label: 'Neraca' },
  { id: 'cashflow', label: 'Arus Kas' },
]

/* ─── Page ─── */

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>('pnl')
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0,0,0,0); return d
  })
  const [endDate, setEndDate] = useState(() => new Date())

  return (
    <DashboardLayout>
      <PageHeader
        title="Laporan Keuangan"
        subtitle="Profit & Loss, Balance Sheet, Cash Flow"
        actions={<Button variant="secondary" icon={<Download size={15} />}>Export</Button>}
      />

      <div className="flex items-center gap-1 bg-surface-raised border border-border rounded-lg p-1 w-fit animate-in stagger-2">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ${
              activeTab === tab.id
                ? 'bg-brand text-white shadow-sm'
                : 'text-ink-secondary hover:bg-surface-subtle'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date range picker */}
      <div className="flex items-center gap-3 animate-in stagger-3">
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e) }}
        />
      </div>

      {activeTab === 'pnl' && <PnlView startDate={startDate} endDate={endDate} />}
      {activeTab === 'balance' && <BalanceView endDate={endDate} />}
      {activeTab === 'cashflow' && <CashFlowView startDate={startDate} endDate={endDate} />}
    </DashboardLayout>
  )
}

/* ─── P&L ─── */

function PnlView({ startDate, endDate }: { startDate: Date; endDate: Date }) {
  const [data, setData] = useState<PnlReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const start = startDate.toISOString()
    const end = endDate.toISOString()
    const res = await apiGet<PnlReport>(`/api/v1/accounting/reports/pnl?startDate=${start}&endDate=${end}`)
    if (res.success && res.data) setData(res.data)
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingState />
  if (!data) return <ErrorState />

  const totalRevenue = data.revenue.reduce((s, r) => s + r.amount, 0)
  const totalExpenses = data.expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="flex flex-col gap-4 animate-in stagger-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard label="Total Revenue" value={formatRp(totalRevenue)} trend="up" valueColor="text-success" />
        <MetricCard label="Total Expenses" value={formatRp(totalExpenses)} trend="down" valueColor="text-danger" />
        <MetricCard label="Net Income" value={formatRp(data.netIncome)} trend={data.netIncome >= 0 ? 'up' : 'down'} valueColor={data.netIncome >= 0 ? 'text-success' : 'text-danger'} />
      </div>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <TrendingUp size={16} className="text-success" /> Pendapatan
          </h3>
          <span className="text-sm font-bold text-success tabular-nums">{formatRp(totalRevenue)}</span>
        </div>
        {data.revenue.map(item => (
          <div key={item.code} className="flex items-center py-2.5 border-b border-border-light last:border-0">
            <span className="font-mono text-xs text-ink-muted w-[60px]">{item.code}</span>
            <span className="text-[13px] text-ink flex-1">{item.name}</span>
            <span className="text-[13px] font-medium text-ink tabular-nums">{formatRp(item.amount)}</span>
          </div>
        ))}
      </Card>

      <Card>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
            <TrendingDown size={16} className="text-danger" /> Beban
          </h3>
          <span className="text-sm font-bold text-danger tabular-nums">{formatRp(totalExpenses)}</span>
        </div>
        {data.expenses.map(item => (
          <div key={item.code} className="flex items-center py-2.5 border-b border-border-light last:border-0">
            <span className="font-mono text-xs text-ink-muted w-[60px]">{item.code}</span>
            <span className="text-[13px] text-ink flex-1">{item.name}</span>
            <span className="text-[13px] font-medium text-ink tabular-nums">{formatRp(item.amount)}</span>
          </div>
        ))}
      </Card>
    </div>
  )
}

/* ─── Balance Sheet ─── */

function BalanceView({ endDate }: { endDate: Date }) {
  const [data, setData] = useState<BalanceReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await apiGet<BalanceReport>(`/api/v1/accounting/reports/balance-sheet?asOfDate=${endDate.toISOString()}`)
    if (res.success && res.data) setData(res.data)
    setLoading(false)
  }, [endDate])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingState />
  if (!data) return <ErrorState />

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in stagger-4">
      <Card>
        <h3 className="text-sm font-semibold text-ink mb-4">Aset</h3>
        {data.assets.map(a => (
          <div key={a.code} className="flex items-center py-2.5 border-b border-border-light last:border-0">
            <span className="font-mono text-xs text-ink-muted w-[50px]">{a.code}</span>
            <span className="text-[13px] text-ink flex-1">{a.name}</span>
            <span className="text-[13px] font-medium text-ink tabular-nums">{formatRp(a.balance)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 mt-2 border-t border-border">
          <span className="text-sm font-semibold text-ink">Total Aset</span>
          <span className="text-sm font-bold text-ink tabular-nums">{formatRp(data.totalAssets)}</span>
        </div>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <h3 className="text-sm font-semibold text-ink mb-4">Kewajiban</h3>
          {data.liabilities.map(l => (
            <div key={l.code} className="flex items-center py-2.5 border-b border-border-light last:border-0">
              <span className="font-mono text-xs text-ink-muted w-[50px]">{l.code}</span>
              <span className="text-[13px] text-ink flex-1">{l.name}</span>
              <span className="text-[13px] font-medium text-ink tabular-nums">{formatRp(l.balance)}</span>
            </div>
          ))}
        </Card>

        <Card>
          <h3 className="text-sm font-semibold text-ink mb-4">Ekuitas</h3>
          {data.equity.map(e => (
            <div key={e.code} className="flex items-center py-2.5 border-b border-border-light last:border-0">
              <span className="font-mono text-xs text-ink-muted w-[50px]">{e.code}</span>
              <span className="text-[13px] text-ink flex-1">{e.name}</span>
              <span className="text-[13px] font-medium text-ink tabular-nums">{formatRp(e.balance)}</span>
            </div>
          ))}
        </Card>

        <div className="flex items-center justify-between px-5 py-3 rounded-xl bg-surface-raised border border-border">
          <span className="text-sm font-semibold text-ink">Kewajiban + Ekuitas</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-ink tabular-nums">{formatRp(data.totalLiabilitiesAndEquity)}</span>
            <Badge color={data.isBalanced ? 'green' : 'red'}>{data.isBalanced ? 'Balanced' : 'Unbalanced'}</Badge>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─── Cash Flow ─── */

function CashFlowView({ startDate, endDate }: { startDate: Date; endDate: Date }) {
  const [data, setData] = useState<CashFlowReport | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const start = startDate.toISOString()
    const end = endDate.toISOString()
    const res = await apiGet<CashFlowReport>(`/api/v1/accounting/reports/cash-flow?startDate=${start}&endDate=${end}`)
    if (res.success && res.data) setData(res.data)
    setLoading(false)
  }, [startDate, endDate])

  useEffect(() => { load() }, [load])

  if (loading) return <LoadingState />
  if (!data) return <ErrorState />

  return (
    <div className="flex flex-col gap-4 animate-in stagger-3">
      <MetricCard
        label="Net Cash Flow"
        value={`${data.totalNetFlow >= 0 ? '+' : '-'}${formatRp(data.totalNetFlow)}`}
        subtitle="Arus kas bersih periode ini"
        trend={data.totalNetFlow >= 0 ? 'up' : 'down'}
        valueColor={data.totalNetFlow >= 0 ? 'text-success' : 'text-danger'}
      />

      <Card>
        <h3 className="text-sm font-semibold text-ink mb-4">Aktivitas Operasional</h3>
        {data.operating.map(f => (
          <div key={f.sourceType} className="flex items-center py-3 border-b border-border-light last:border-0">
            <div className="flex-1">
              <span className="text-[13px] text-ink">{SOURCE_LABELS[f.sourceType] || f.sourceType}</span>
            </div>
            <span className={`text-[13px] font-semibold tabular-nums ${f.netFlow >= 0 ? 'text-success' : 'text-danger'}`}>
              {f.netFlow >= 0 ? '+' : '-'}{formatRp(f.netFlow)}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-3 mt-2 border-t-2 border-border">
          <span className="text-sm font-bold text-ink">Total Arus Kas Bersih</span>
          <span className={`text-sm font-bold tabular-nums ${data.totalNetFlow >= 0 ? 'text-success' : 'text-danger'}`}>
            {data.totalNetFlow >= 0 ? '+' : '-'}{formatRp(data.totalNetFlow)}
          </span>
        </div>
      </Card>
    </div>
  )
}

/* ─── Shared ─── */

function LoadingState() {
  return (
    <div className="flex items-center justify-center py-24">
      <Loader2 size={24} className="text-ink-faint animate-spin" />
    </div>
  )
}

function ErrorState() {
  return (
    <Card className="py-12 text-center">
      <p className="text-sm text-ink-muted">Tidak dapat memuat data laporan</p>
    </Card>
  )
}
