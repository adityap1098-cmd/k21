'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Badge, Card, MetricCard, Input } from '@/components/ui'
import { apiGet } from '@/lib/api'
import {
  ClipboardCheck,
  List,
  Search,
  AlertTriangle,
  Loader2,
} from 'lucide-react'

/* ─── Types ─── */

interface StockInfo {
  variantId: string
  stockQty: number
}

interface Product {
  id: string; name: string
  variants?: Array<{
    id: string; sku: string; barcode: string | null
    price: number; stockQty: number; lowStockThreshold: number
    attributes: Record<string, string> | null
  }>
}

interface StockRow {
  variantId: string; name: string; sku: string; barcode: string
  stock: number; threshold: number; critical: boolean
}

function formatRp(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

/* ─── Page ─── */

export default function InventoryPage() {
  const [rows, setRows] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await apiGet<Product[]>('/api/v1/products?variants=true&active=true')
    if (res.success && res.data) {
      const stockRows: StockRow[] = []
      for (const p of res.data) {
        for (const v of p.variants || []) {
          const attrs = v.attributes ? Object.values(v.attributes).join(' / ') : ''
          stockRows.push({
            variantId: v.id,
            name: attrs ? `${p.name} — ${attrs}` : p.name,
            sku: v.sku,
            barcode: v.barcode || '',
            stock: v.stockQty,
            threshold: v.lowStockThreshold,
            critical: v.stockQty <= v.lowStockThreshold,
          })
        }
      }
      setRows(stockRows)
    }
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = rows.filter(s => {
    if (!search) return true
    const q = search.toLowerCase()
    return s.name.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q) || s.barcode.includes(q)
  })

  const lowStockCount = rows.filter(s => s.critical).length
  const totalValue = rows.reduce((sum, s) => sum + s.stock, 0)

  return (
    <DashboardLayout>
      <PageHeader
        title="Inventori"
        subtitle="Pantau stok dan movement barang"
        actions={
          <>
            <Button variant="secondary" icon={<List size={15} />}>Movement Log</Button>
            <Button icon={<ClipboardCheck size={15} />}>Stock Opname</Button>
          </>
        }
      />

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in stagger-2">
        <MetricCard label="Total SKU" value={String(rows.length)} subtitle={`${rows.length} variant`} />
        <MetricCard label="Total Unit" value={totalValue.toLocaleString('id-ID')} subtitle="Total stok semua variant" />
        <MetricCard
          label="Low Stock Alert"
          value={String(lowStockCount)}
          subtitle="item di bawah threshold"
          labelColor={lowStockCount > 0 ? 'text-danger' : undefined}
          valueColor={lowStockCount > 0 ? 'text-danger' : undefined}
        />
        <MetricCard
          label="Stok Sehat"
          value={String(rows.length - lowStockCount)}
          subtitle="item di atas threshold"
          valueColor="text-success"
        />
      </div>

      {/* Search */}
      <div className="animate-in stagger-3">
        <Input
          icon={<Search size={16} />}
          placeholder="Cari variant, SKU, atau barcode..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Stock table */}
      <Card padding={false} className="flex-1 flex flex-col overflow-hidden animate-in stagger-4">
        <div className="overflow-x-auto flex-1 flex flex-col">
          <div className="min-w-[760px] flex flex-col flex-1">
        <div className="flex items-center px-5 py-3 bg-surface-subtle border-b border-border">
          <span className="w-[320px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Variant</span>
          <span className="w-[140px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">SKU</span>
          <span className="w-[100px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Stok</span>
          <span className="w-[100px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Threshold</span>
          <span className="flex-1 text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="text-ink-faint animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <p className="text-sm font-medium text-ink-muted">Tidak ada data inventori</p>
            </div>
          ) : filtered.map(s => (
            <div
              key={s.variantId}
              className={`flex items-center px-5 py-3 border-b border-border-light transition-colors cursor-pointer hover:bg-surface-subtle ${
                s.critical ? 'bg-[rgba(220,38,38,0.03)]' : ''
              }`}
            >
              <div className="w-[320px] flex flex-col gap-0.5">
                <span className="text-[13px] font-medium text-ink">{s.name}</span>
                {s.barcode && <span className="text-[11px] text-ink-muted">Barcode: {s.barcode}</span>}
              </div>
              <span className="w-[140px] font-mono text-xs text-ink-secondary">{s.sku}</span>
              <span className={`w-[100px] text-[13px] font-semibold tabular-nums ${
                s.critical ? 'text-danger' : s.stock <= s.threshold * 1.5 ? 'text-warning' : 'text-success'
              }`}>
                {s.stock}
              </span>
              <span className="w-[100px] text-[13px] text-ink-muted tabular-nums">{s.threshold}</span>
              <div className="flex-1 flex items-center gap-2">
                {s.critical ? (
                  <Badge color="red"><AlertTriangle size={10} className="mr-1" />Low Stock</Badge>
                ) : (
                  <Badge color="green">Normal</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
          </div>{/* min-w */}
        </div>{/* overflow-x */}
      </Card>
    </DashboardLayout>
  )
}
