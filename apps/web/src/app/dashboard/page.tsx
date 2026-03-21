'use client'

import { useEffect, useState } from 'react'
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
  Loader2,
} from 'lucide-react'

/* ─── Types ─── */

interface DashboardKpi {
  revenueToday: number
  revenueThisWeek: number
  revenueThisMonth: number
  margin: number
  criticalStockItems: Array<{ variantId: string; name?: string; stockQty: number; lowStockThreshold: number }>
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

/* ─── Page ─── */

export default function DashboardPage() {
  const { user } = useAuth()
  const [kpi, setKpi] = useState<DashboardKpi | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await apiGet<DashboardKpi>('/api/v1/analytics/dashboard')
      if (res.success && res.data) setKpi(res.data)
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date()
  const greeting = now.getHours() < 12 ? 'Selamat pagi' : now.getHours() < 18 ? 'Selamat siang' : 'Selamat malam'
  const dateStr = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const userName = user?.sub ? 'User' : 'Aditya'

  return (
    <DashboardLayout>
      {/* Top bar */}
      <div className="flex items-center justify-between animate-in stagger-1">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-xl font-bold text-ink">{greeting}, {userName}</h1>
          <p className="text-[13px] text-ink-muted">{dateStr}</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="relative p-2 rounded-lg hover:bg-surface-subtle transition-colors">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M13.5 6.75C13.5 5.56 13.03 4.42 12.18 3.57C11.33 2.72 10.19 2.25 9 2.25C7.81 2.25 6.67 2.72 5.82 3.57C4.97 4.42 4.5 5.56 4.5 6.75C4.5 12 2.25 13.5 2.25 13.5H15.75C15.75 13.5 13.5 12 13.5 6.75Z" stroke="#5A6270" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M10.3 15.75C10.17 15.98 9.98 16.17 9.74 16.3C9.51 16.44 9.26 16.5 9 16.5C8.74 16.5 8.49 16.44 8.26 16.3C8.02 16.17 7.83 15.98 7.7 15.75" stroke="#5A6270" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-danger border-2 border-surface" />
          </button>
        </div>
      </div>

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
          <div className="relative">
            <MetricCard
              label="Penjualan Hari Ini"
              value={formatRp(kpi.revenueToday)}
              subtitle={`Minggu ini ${formatRp(kpi.revenueThisWeek)}`}
              trend="up"
            />
            <div className="absolute top-5 right-5">
              <Badge color="green"><TrendingUp size={10} className="mr-1" />Live</Badge>
            </div>
          </div>
          <MetricCard
            label="Revenue Bulan Ini"
            value={formatRp(kpi.revenueThisMonth)}
            subtitle="Akumulasi bulan berjalan"
          />
          <MetricCard
            label="Margin"
            value={`${(kpi.margin * 100).toFixed(1)}%`}
            subtitle="Gross margin"
            trend={kpi.margin > 0.2 ? 'up' : 'down'}
          />
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

      {/* Revenue chart */}
      <Card className="animate-in stagger-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Trend Penjualan</h2>
            <p className="text-xs text-ink-muted mt-0.5">7 hari terakhir — POS vs Marketplace</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-brand" />
              <span className="text-[11px] text-ink-muted">POS</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-info" />
              <span className="text-[11px] text-ink-muted">Marketplace</span>
            </div>
          </div>
        </div>
        <RevenueChart data={[
          { date: '15 Mar', pos: 2100000, marketplace: 850000 },
          { date: '16 Mar', pos: 1800000, marketplace: 1200000 },
          { date: '17 Mar', pos: 2400000, marketplace: 950000 },
          { date: '18 Mar', pos: 2900000, marketplace: 1100000 },
          { date: '19 Mar', pos: 2200000, marketplace: 1400000 },
          { date: '20 Mar', pos: 2600000, marketplace: 1050000 },
          { date: '21 Mar', pos: 2450000, marketplace: 900000 },
        ]} />
      </Card>

      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4 flex-1 min-h-0 animate-in stagger-4">
        <Card padding={false} className="flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Transaksi Terakhir</h2>
            <button className="text-xs text-brand font-medium hover:underline flex items-center gap-1">
              Lihat Semua <ArrowUpRight size={12} />
            </button>
          </div>
          <div className="flex items-center px-5 py-2 bg-surface-subtle border-y border-border-light text-[11px] font-semibold text-ink-muted uppercase tracking-wider">
            <span className="w-[100px]">No. Nota</span>
            <span className="w-[60px]">Waktu</span>
            <span className="w-[50px]">Item</span>
            <span className="w-[80px]">Metode</span>
            <span className="flex-1 text-right">Total</span>
          </div>
          <div className="flex-1 overflow-y-auto px-5 py-3">
            <p className="text-xs text-ink-muted text-center py-8">Data transaksi akan muncul setelah terhubung ke server</p>
          </div>
        </Card>

        <Card className="flex flex-col overflow-hidden">
          <h2 className="text-sm font-semibold text-ink mb-4">Produk Terlaris</h2>
          <div className="flex-1 flex items-center justify-center">
            <p className="text-xs text-ink-muted text-center">Data produk akan muncul setelah terhubung ke server</p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
