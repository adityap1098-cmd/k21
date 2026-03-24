'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardLayout } from '@/components/layout'
import { MetricCard, Card, Badge } from '@/components/ui'
import dynamic from 'next/dynamic'
import { apiGet } from '@/lib/api'

const RevenueChart = dynamic(() => import('@/components/charts/RevenueChart').then(m => ({ default: m.RevenueChart })), { ssr: false })
import { useAuth } from '@/lib/auth'
import {
  TrendingUp,
  AlertTriangle,
  ArrowUpRight,
  ArrowRight,
  Loader2,
  Package,
  Wrench,
  ShoppingCart,
  Clock,
  User,
  Timer,
  Banknote,
  Hash,
  Boxes,
  BarChart3,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight as ArrowUpRightIcon,
} from 'lucide-react'

/* ─── Types ─── */

interface DashboardKpi {
  revenueToday: number
  revenueThisWeek: number
  revenueThisMonth: number
  serviceRevenueToday: number
  serviceRevenueThisWeek: number
  serviceRevenueThisMonth: number
  cashInToday: number
  cashOutToday: number
  cashInThisMonth: number
  cashOutThisMonth: number
  margin: number
  criticalStockItems: Array<{ variantId: string; name?: string; sku?: string; stockQty: number; lowStockThreshold: number }>
}

interface RecentTransaction {
  id: string
  clientUuid: string
  total: number
  itemCount: number
  primaryMethod: string
  createdAt: string
  source: 'pos' | 'service'
}

interface TopProduct {
  variantId: string
  name: string
  sku: string
  totalQty: number
  totalRevenue: number
}

interface ChartDataPoint {
  date: string
  pos: number
  service: number
  cashOut?: number
}

const METHOD_BADGE: Record<string, 'green' | 'blue' | 'purple'> = {
  'CASH': 'green',
  'TRANSFER': 'blue',
  'QRIS': 'purple',
}

const METHOD_LABELS: Record<string, string> = {
  'CASH': 'Tunai',
  'TRANSFER': 'Transfer',
  'QRIS': 'QRIS',
}

function formatRp(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function shortId(uuid: string): string {
  return uuid.slice(0, 8).toUpperCase()
}

/* ─── Roles that can see full analytics ─── */
const ANALYTICS_ROLES = ['Owner', 'Admin', 'Finance', 'Cashier']

/* ─── Page ─── */

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [kpi, setKpi] = useState<DashboardKpi | null>(null)
  const [recentTx, setRecentTx] = useState<RecentTransaction[]>([])
  const [topProducts, setTopProducts] = useState<TopProduct[]>([])
  const [chartData, setChartData] = useState<ChartDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [showNotifMsg, setShowNotifMsg] = useState(false)

  // Shift info for non-analytics roles
  const [shiftData, setShiftData] = useState<{
    id: string; openedAt: string; openingFloat: number; status: string
  } | null>(null)
  const [shiftLoading, setShiftLoading] = useState(false)
  const [showShiftDetail, setShowShiftDetail] = useState(false)

  const role = user?.role || ''
  const canSeeAnalytics = ANALYTICS_ROLES.includes(role)

  // Fetch shift data for Cashier (kept for non-cashier shift roles if any)
  useEffect(() => {
    if (role !== 'Cashier') return
    async function fetchShift() {
      setShiftLoading(true)
      try {
        const res = await apiGet<{ id: string; openedAt: string; openingFloat: number; status: string }>('/api/v1/shifts/active')
        if (res.success && res.data) {
          setShiftData(res.data)
        }
      } catch { /* no active shift */ }
      setShiftLoading(false)
    }
    fetchShift()
  }, [role])

  useEffect(() => {
    async function load() {
      if (!canSeeAnalytics) {
        // Non-analytics roles don't fetch financial data
        setLoading(false)
        return
      }

      // Fetch all analytics data in parallel
      const [kpiRes, txRes, prodRes, chartRes] = await Promise.all([
        apiGet<DashboardKpi>('/api/v1/analytics/dashboard'),
        apiGet<RecentTransaction[]>('/api/v1/analytics/recent-transactions?limit=10'),
        apiGet<TopProduct[]>('/api/v1/analytics/top-products?days=30&limit=8'),
        apiGet<ChartDataPoint[]>('/api/v1/analytics/revenue-chart?days=7'),
      ])

      if (kpiRes.success && kpiRes.data) setKpi(kpiRes.data)
      if (txRes.success && txRes.data) setRecentTx(txRes.data)
      if (prodRes.success && prodRes.data) setTopProducts(prodRes.data)
      if (chartRes.success && chartRes.data) setChartData(chartRes.data)

      setLoading(false)
    }
    load()
  }, [canSeeAnalytics])

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Selamat pagi' : now.getHours() < 18 ? 'Selamat siang' : 'Selamat malam'
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const userName = user?.name
    || (user?.email ? user.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : 'User')

  // Compute shift duration
  const shiftDuration = shiftData
    ? (() => {
        const ms = now.getTime() - new Date(shiftData.openedAt).getTime()
        const h = Math.floor(ms / 3600000)
        const m = Math.floor((ms % 3600000) / 60000)
        return h > 0 ? `${h} jam ${m} menit` : `${m} menit`
      })()
    : null

  // Combined totals
  const totalToday = (kpi?.revenueToday ?? 0) + (kpi?.serviceRevenueToday ?? 0)
  const totalWeek = (kpi?.revenueThisWeek ?? 0) + (kpi?.serviceRevenueThisWeek ?? 0)
  const totalMonth = (kpi?.revenueThisMonth ?? 0) + (kpi?.serviceRevenueThisMonth ?? 0)

  return (
    <DashboardLayout>
      {/* Top bar */}
      <div className="flex items-center justify-between animate-in stagger-1">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold text-ink">{greeting}, {userName}</h1>
          <p className="text-[13px] text-ink-muted">{dateStr}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-ink-muted bg-surface-subtle px-3 py-1.5 rounded-lg">
            <User size={14} />
            <span className="font-medium">{role}</span>
          </div>
        </div>
      </div>

      {/* ═══════ Role-specific dashboard content ═══════ */}

      {!canSeeAnalytics ? (
        /* ── Cashier / Warehouse Staff Dashboard ── */
        <>
          {role === 'Cashier' && (
            <>
              {/* Shift status cards */}
              {shiftLoading ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in stagger-2">
                  {[1,2,3,4].map(i => (
                    <Card key={i} className="h-[100px] flex items-center justify-center">
                      <Loader2 size={18} className="text-ink-faint animate-spin" />
                    </Card>
                  ))}
                </div>
              ) : shiftData ? (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in stagger-2">
                  <Card className="relative overflow-hidden">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">Status Shift</p>
                        <p className="text-lg font-bold text-success mt-1">Aktif</p>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          Sejak {new Date(shiftData.openedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                        <Clock size={18} className="text-success" />
                      </div>
                    </div>
                    <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-success animate-pulse" />
                  </Card>

                  <Card>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">Durasi</p>
                        <p className="text-lg font-bold text-ink mt-1">{shiftDuration}</p>
                        <p className="text-[11px] text-ink-muted mt-0.5">
                          {new Date(shiftData.openedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <Timer size={18} className="text-purple-500" />
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">Modal Awal</p>
                        <p className="text-lg font-bold text-ink mt-1">{formatRp(shiftData.openingFloat)}</p>
                        <p className="text-[11px] text-ink-muted mt-0.5">Opening float</p>
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-brand/10 flex items-center justify-center">
                        <Banknote size={18} className="text-brand" />
                      </div>
                    </div>
                  </Card>

                  <Card>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-[11px] font-medium text-ink-muted uppercase tracking-wider">Shift ID</p>
                        <p className="text-lg font-bold text-ink font-mono mt-1">{shiftData.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-[11px] text-ink-muted mt-0.5">Referensi shift</p>
                      </div>
                      <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <Hash size={18} className="text-blue-500" />
                      </div>
                    </div>
                  </Card>
                </div>
              ) : (
                <Card className="animate-in stagger-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <Clock size={24} className="text-amber-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-ink">Belum ada shift aktif</p>
                        <p className="text-xs text-ink-muted mt-0.5">Buka shift terlebih dahulu untuk mulai transaksi</p>
                      </div>
                    </div>
                    <button
                      onClick={() => router.push('/pos')}
                      className="flex items-center gap-2 text-sm font-semibold text-white bg-brand hover:bg-brand-hover px-5 py-2.5 rounded-xl transition-colors shadow-sm"
                    >
                      Buka Shift
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </Card>
              )}

              {/* Action buttons */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in stagger-3">
                <button
                  onClick={() => router.push('/pos')}
                  className="flex items-center gap-4 p-5 bg-surface-raised border border-border rounded-2xl hover:border-brand hover:shadow-md transition-all group text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center group-hover:bg-brand/20 transition-colors flex-shrink-0">
                    <ShoppingCart size={22} className="text-brand" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Kasir — POS Retail</p>
                    <p className="text-xs text-ink-muted mt-0.5">Penjualan sparepart & aksesoris</p>
                  </div>
                  <ArrowRight size={18} className="text-ink-faint group-hover:text-brand transition-colors flex-shrink-0" />
                </button>

                <button
                  onClick={() => router.push('/pos?type=SERVICE')}
                  className="flex items-center gap-4 p-5 bg-surface-raised border border-border rounded-2xl hover:border-success hover:shadow-md transition-all group text-left"
                >
                  <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center group-hover:bg-success/20 transition-colors flex-shrink-0">
                    <Wrench size={22} className="text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink">Service Bengkel</p>
                    <p className="text-xs text-ink-muted mt-0.5">Order servis & perbaikan motor</p>
                  </div>
                  <ArrowRight size={18} className="text-ink-faint group-hover:text-success transition-colors flex-shrink-0" />
                </button>
              </div>
            </>
          )}

          {role === 'Warehouse Staff' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 animate-in stagger-2">
              <button
                onClick={() => router.push('/products')}
                className="flex items-center gap-4 p-5 bg-surface-raised border border-border rounded-2xl hover:border-brand hover:shadow-md transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-brand/10 flex items-center justify-center group-hover:bg-brand/20 transition-colors flex-shrink-0">
                  <Package size={22} className="text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Produk</p>
                  <p className="text-xs text-ink-muted mt-0.5">Kelola data produk & varian</p>
                </div>
                <ArrowRight size={18} className="text-ink-faint group-hover:text-brand transition-colors flex-shrink-0" />
              </button>

              <button
                onClick={() => router.push('/inventory')}
                className="flex items-center gap-4 p-5 bg-surface-raised border border-border rounded-2xl hover:border-amber-500 hover:shadow-md transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center group-hover:bg-amber-500/20 transition-colors flex-shrink-0">
                  <Boxes size={22} className="text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Inventori</p>
                  <p className="text-xs text-ink-muted mt-0.5">Cek stok & penyesuaian</p>
                </div>
                <ArrowRight size={18} className="text-ink-faint group-hover:text-amber-500 transition-colors flex-shrink-0" />
              </button>

              <button
                onClick={() => router.push('/warehouse')}
                className="flex items-center gap-4 p-5 bg-surface-raised border border-border rounded-2xl hover:border-blue-500 hover:shadow-md transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors flex-shrink-0">
                  <BarChart3 size={22} className="text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Gudang</p>
                  <p className="text-xs text-ink-muted mt-0.5">Manajemen gudang & transfer</p>
                </div>
                <ArrowRight size={18} className="text-ink-faint group-hover:text-blue-500 transition-colors flex-shrink-0" />
              </button>

              <button
                onClick={() => router.push('/procurement')}
                className="flex items-center gap-4 p-5 bg-surface-raised border border-border rounded-2xl hover:border-purple-500 hover:shadow-md transition-all group text-left"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors flex-shrink-0">
                  <ShoppingCart size={22} className="text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-ink">Procurement</p>
                  <p className="text-xs text-ink-muted mt-0.5">Purchase order & penerimaan barang</p>
                </div>
                <ArrowRight size={18} className="text-ink-faint group-hover:text-purple-500 transition-colors flex-shrink-0" />
              </button>
            </div>
          )}
        </>
      ) : (
        /* ── Full Analytics Dashboard (Owner / Admin / Finance) ── */
        <>
          {/* Metrics */}
          {loading ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <Card key={i} className="h-[136px] flex items-center justify-center">
                  <Loader2 size={20} className="text-ink-faint animate-spin" />
                </Card>
              ))}
            </div>
          ) : kpi ? (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in stagger-2">
              {/* Total Hari Ini (POS + Service) */}
              <div className="relative">
                <MetricCard
                  label="Penjualan Hari Ini"
                  value={formatRp(totalToday)}
                  subtitle={`Minggu ini ${formatRp(totalWeek)}`}
                  trend="up"
                />
                <div className="absolute top-5 right-5">
                  <Badge color="green"><TrendingUp size={10} className="mr-1" />Live</Badge>
                </div>
              </div>

              {/* Revenue Bulan Ini */}
              <MetricCard
                label="Revenue Bulan Ini"
                value={formatRp(totalMonth)}
                subtitle={
                  kpi.serviceRevenueThisMonth > 0
                    ? `Retail ${formatRp(kpi.revenueThisMonth)} · Service ${formatRp(kpi.serviceRevenueThisMonth)}`
                    : 'Akumulasi bulan berjalan'
                }
              />

              {/* Margin */}
              <MetricCard
                label="Margin"
                value={`${(kpi.margin * 100).toFixed(1)}%`}
                subtitle="Gross margin (retail)"
                trend={kpi.margin > 0.2 ? 'up' : 'down'}
              />

              {/* Stok Menipis */}
              <div className="relative">
                <MetricCard
                  label="Stok Menipis"
                  value={String(kpi.criticalStockItems.length)}
                  subtitle="produk di bawah minimum"
                  labelColor="text-danger"
                  valueColor="text-danger"
                />
                {kpi.criticalStockItems.length > 0 && (
                  <div className="absolute top-5 right-5">
                    <Badge color="red"><AlertTriangle size={10} className="mr-1" />Perlu restock</Badge>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <Card className="py-12 text-center">
              <p className="text-sm text-ink-muted">Tidak dapat memuat data dashboard</p>
            </Card>
          )}

          {/* Cash In/Out Summary */}
          {kpi && (kpi.cashInToday > 0 || kpi.cashOutToday > 0 || kpi.cashInThisMonth > 0 || kpi.cashOutThisMonth > 0) && (
            <Card className="animate-in stagger-3">
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={16} className="text-ink-secondary" />
                <h2 className="text-sm font-semibold text-ink">Arus Kas (Non-Penjualan)</h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <ArrowDownLeft size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-muted">Kas Masuk Hari Ini</p>
                    <p className="text-sm font-bold text-emerald-600">{formatRp(kpi.cashInToday)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-500/10">
                  <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                    <ArrowUpRightIcon size={16} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-muted">Kas Keluar Hari Ini</p>
                    <p className="text-sm font-bold text-red-500">{formatRp(kpi.cashOutToday)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <ArrowDownLeft size={16} className="text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-muted">Kas Masuk Bulan Ini</p>
                    <p className="text-sm font-bold text-emerald-600">{formatRp(kpi.cashInThisMonth)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-500/10">
                  <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
                    <ArrowUpRightIcon size={16} className="text-red-500" />
                  </div>
                  <div>
                    <p className="text-[11px] text-ink-muted">Kas Keluar Bulan Ini</p>
                    <p className="text-sm font-bold text-red-500">{formatRp(kpi.cashOutThisMonth)}</p>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {/* Revenue chart */}
          <Card className="animate-in stagger-3">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-ink">Trend Penjualan</h2>
                <p className="text-xs text-ink-muted mt-0.5">7 hari terakhir — POS Retail vs Service</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                  <span className="text-[11px] text-ink-muted">POS Retail</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-success" />
                  <span className="text-[11px] text-ink-muted">Service</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-[11px] text-ink-muted">Pengeluaran</span>
                </div>
              </div>
            </div>
            {loading ? (
              <div className="h-[280px] flex items-center justify-center">
                <Loader2 size={24} className="text-ink-faint animate-spin" />
              </div>
            ) : chartData.length > 0 ? (
              <RevenueChart data={chartData} />
            ) : (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-xs text-ink-muted">Belum ada data penjualan</p>
              </div>
            )}
          </Card>

          {/* Bottom panels */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 flex-1 min-h-0 animate-in stagger-4">
            {/* Recent Transactions — split retail | service */}
            <div className="flex flex-col overflow-hidden gap-4">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold text-ink">Transaksi Terakhir</h2>
                <button onClick={() => router.push('/reports')} className="text-xs text-brand font-medium hover:underline flex items-center gap-1">
                  Lihat Semua <ArrowUpRight size={12} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                {/* POS Retail */}
                <Card padding={false} className="flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border-light">
                    <ShoppingCart size={13} className="text-brand" />
                    <span className="text-[12px] font-semibold text-ink">POS Retail</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-1.5 bg-surface-subtle border-b border-border-light text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
                    <span className="flex-1">No. Nota</span>
                    <span className="w-10 shrink-0">Waktu</span>
                    <span className="w-16 shrink-0">Metode</span>
                    <span className="w-24 shrink-0 text-right">Total</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={16} className="text-ink-faint animate-spin" />
                      </div>
                    ) : recentTx.filter(t => t.source === 'pos').length > 0 ? (
                      recentTx.filter(t => t.source === 'pos').map(tx => (
                        <div key={tx.id} className="flex items-center gap-3 px-4 py-2 border-b border-border-light last:border-b-0 hover:bg-surface-subtle transition-colors">
                          <span className="flex-1 font-mono text-[11px] text-ink-secondary truncate">
                            {shortId(tx.clientUuid)}
                          </span>
                          <span className="w-10 shrink-0 text-ink-muted text-[11px]">{formatTime(tx.createdAt)}</span>
                          <span className="w-16 shrink-0">
                            <Badge color={METHOD_BADGE[tx.primaryMethod] ?? 'neutral'}>
                              {METHOD_LABELS[tx.primaryMethod] ?? tx.primaryMethod}
                            </Badge>
                          </span>
                          <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-ink text-[12px]">{formatRp(tx.total)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-ink-muted text-center py-8">Belum ada transaksi</p>
                    )}
                  </div>
                </Card>

                {/* Service Bengkel */}
                <Card padding={false} className="flex flex-col overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-border-light">
                    <Wrench size={13} className="text-success" />
                    <span className="text-[12px] font-semibold text-ink">Service Bengkel</span>
                  </div>
                  <div className="flex items-center gap-3 px-4 py-1.5 bg-surface-subtle border-b border-border-light text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
                    <span className="flex-1">No. Order</span>
                    <span className="w-10 shrink-0">Waktu</span>
                    <span className="w-16 shrink-0">Metode</span>
                    <span className="w-24 shrink-0 text-right">Total</span>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {loading ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 size={16} className="text-ink-faint animate-spin" />
                      </div>
                    ) : recentTx.filter(t => t.source === 'service').length > 0 ? (
                      recentTx.filter(t => t.source === 'service').map(tx => (
                        <div key={tx.id} className="flex items-center gap-3 px-4 py-2 border-b border-border-light last:border-b-0 hover:bg-surface-subtle transition-colors">
                          <span className="flex-1 font-mono text-[11px] text-ink-secondary truncate">
                            {tx.clientUuid}
                          </span>
                          <span className="w-10 shrink-0 text-ink-muted text-[11px]">{formatTime(tx.createdAt)}</span>
                          <span className="w-16 shrink-0">
                            <Badge color={METHOD_BADGE[tx.primaryMethod] ?? 'neutral'}>
                              {METHOD_LABELS[tx.primaryMethod] ?? tx.primaryMethod}
                            </Badge>
                          </span>
                          <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-ink text-[12px]">{formatRp(tx.total)}</span>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-ink-muted text-center py-8">Belum ada transaksi</p>
                    )}
                  </div>
                </Card>
              </div>
            </div>

            {/* Top Products */}
            <div className="flex flex-col overflow-hidden gap-4">
              <div className="flex items-center px-1" style={{height: '20px'}}>
                <span className="text-sm font-semibold text-ink">Produk Terlaris</span>
              </div>
              <Card padding={false} className="flex flex-col overflow-hidden flex-1 min-h-0">
              <div className="flex items-center gap-3 px-4 py-1.5 bg-surface-subtle border-b border-border-light text-[10px] font-semibold text-ink-muted uppercase tracking-wider">
                <span className="w-5 shrink-0">#</span>
                <span className="flex-1">Produk</span>
                <span className="w-10 shrink-0 text-center">Terjual</span>
                <span className="w-24 shrink-0 text-right">Total</span>
              </div>
              {loading ? (
                <div className="flex-1 flex items-center justify-center py-8">
                  <Loader2 size={18} className="text-ink-faint animate-spin" />
                </div>
              ) : topProducts.length > 0 ? (
                <div className="flex-1 overflow-y-auto">
                  {topProducts.map((prod, i) => (
                    <div key={prod.variantId} className="flex items-center gap-3 px-4 py-2 border-b border-border-light last:border-b-0 hover:bg-surface-subtle transition-colors">
                      <span className="w-5 shrink-0 text-[11px] font-bold text-ink-muted">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-ink truncate">{prod.name}</p>
                        <p className="text-[10px] text-ink-faint truncate">{prod.sku}</p>
                      </div>
                      <span className="w-10 shrink-0 text-center text-[11px] text-ink-muted tabular-nums">{prod.totalQty}</span>
                      <span className="w-24 shrink-0 text-right text-[12px] font-semibold tabular-nums text-ink">{formatRp(prod.totalRevenue)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-2 py-8">
                  <Package size={24} className="text-ink-faint" />
                  <p className="text-xs text-ink-muted text-center">Belum ada data produk terlaris</p>
                </div>
              )}
            </Card>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  )
}
