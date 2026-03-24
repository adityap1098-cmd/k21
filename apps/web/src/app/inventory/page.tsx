'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Badge, Card, MetricCard, Input, Select } from '@/components/ui'
import { apiGet, apiPost } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import {
  ClipboardCheck,
  List,
  Search,
  AlertTriangle,
  Loader2,
  Save,
  Plus,
  Minus,
  RefreshCw,
} from 'lucide-react'

/* ─── Types ─── */

interface Product {
  id: string
  name: string
  variants?: Array<{
    id: string
    sku: string
    barcode: string | null
    price: number
    stockQty: number
    lowStockThreshold: number
    attributes: Record<string, string> | null
  }>
}

interface StockRow {
  variantId: string
  name: string
  sku: string
  barcode: string
  stock: number
  threshold: number
  critical: boolean
}

interface MovementForm {
  variantId: string
  movementType: 'PURCHASE' | 'RETURN' | 'ADJUSTMENT'
  qty: number
  reference: string
  reason: string
}

/* ─── Helpers ─── */

function formatRp(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

/* ─── Opname Tab ─── */

interface OpnameRow {
  variantId: string
  name: string
  sku: string
  currentStock: number
  physicalCount: number
}

function OpnameTab({ rows, onRefresh }: { rows: StockRow[]; onRefresh: () => void }) {
  const [opnameRows, setOpnameRows] = useState<OpnameRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setOpnameRows(rows.map(r => ({
      variantId: r.variantId,
      name: r.name,
      sku: r.sku,
      currentStock: r.stock,
      physicalCount: r.stock, // default = current stock (no adjustment)
    })))
  }, [rows])

  const updateCount = (variantId: string, value: number) => {
    setOpnameRows(prev =>
      prev.map(r => r.variantId === variantId ? { ...r, physicalCount: Math.max(0, value) } : r)
    )
  }

  const filtered = opnameRows.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    return r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q)
  })

  const changedCount = opnameRows.filter(r => r.physicalCount !== r.currentStock).length

  const handleSubmit = async () => {
    const items = opnameRows
      .filter(r => r.physicalCount !== r.currentStock)
      .map(r => ({ variantId: r.variantId, physicalCount: r.physicalCount }))

    if (items.length === 0) {
      setError('Tidak ada perubahan stok untuk disimpan')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const res = await apiPost<{ adjustments: unknown[]; opnameId: string }>(
      '/api/v1/inventory/opname',
      { items }
    )

    setSubmitting(false)

    if (res.success && res.data) {
      setSuccess(`Stock opname berhasil. ${res.data.adjustments.length} item disesuaikan.`)
      onRefresh()
      // Reset physicalCount to match new stock
      setOpnameRows(prev => prev.map(r => {
        const adjusted = items.find(i => i.variantId === r.variantId)
        return adjusted ? { ...r, currentStock: adjusted.physicalCount, physicalCount: adjusted.physicalCount } : r
      }))
    } else {
      setError(res.error || 'Gagal menyimpan stock opname')
    }
  }

  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Input
            icon={<Search size={16} />}
            placeholder="Cari variant atau SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        {changedCount > 0 && (
          <Badge color="amber">{changedCount} item berubah</Badge>
        )}
      </div>

      {success && (
        <div className="p-3 bg-success-muted text-success rounded-lg text-sm font-medium">
          {success}
        </div>
      )}
      {error && (
        <div className="p-3 bg-danger-muted text-danger rounded-lg text-sm">
          {error}
        </div>
      )}

      <Card padding={false} className="flex-1 flex flex-col overflow-hidden">
        <div className="grid grid-cols-[1fr_minmax(80px,1.2fr)_100px_130px_80px] items-center px-6 py-3 bg-surface-subtle border-b border-border gap-4">
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Variant / SKU</span>
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Stok Sistem</span>
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Stok Fisik</span>
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Selisih</span>
          <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(r => {
            const diff = r.physicalCount - r.currentStock
            return (
              <div
                key={r.variantId}
                className={`grid grid-cols-[1fr_minmax(80px,1.2fr)_100px_130px_80px] items-center px-6 py-3 border-b border-border-light gap-4 ${
                  diff !== 0 ? 'bg-warning-muted/30' : ''
                }`}
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink truncate">{r.name}</p>
                  <p className="text-xs text-ink-muted font-mono">{r.sku}</p>
                </div>
                <span className="text-[13px] text-ink-secondary tabular-nums">{r.currentStock}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => updateCount(r.variantId, r.physicalCount - 1)}
                    className="w-6 h-6 rounded-md border border-border flex items-center justify-center hover:bg-surface-subtle transition-colors"
                  >
                    <Minus size={12} className="text-ink-muted" />
                  </button>
                  <input
                    type="number"
                    min={0}
                    value={r.physicalCount}
                    onChange={e => updateCount(r.variantId, parseInt(e.target.value) || 0)}
                    className="w-14 text-center text-[13px] font-medium border border-border rounded-md px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-brand tabular-nums bg-transparent text-ink"
                  />
                  <button
                    onClick={() => updateCount(r.variantId, r.physicalCount + 1)}
                    className="w-6 h-6 rounded-md border border-border flex items-center justify-center hover:bg-surface-subtle transition-colors"
                  >
                    <Plus size={12} className="text-ink-muted" />
                  </button>
                </div>
                <span className={`text-[13px] font-semibold tabular-nums ${
                  diff > 0 ? 'text-success' : diff < 0 ? 'text-danger' : 'text-ink-faint'
                }`}>
                  {diff > 0 ? `+${diff}` : diff === 0 ? '—' : diff}
                </span>
                <div>
                  {diff !== 0 ? (
                    <Badge color={diff > 0 ? 'green' : 'red'}>{diff > 0 ? 'Tambah' : 'Kurang'}</Badge>
                  ) : (
                    <Badge color="neutral">Sesuai</Badge>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button
          onClick={handleSubmit}
          disabled={submitting || changedCount === 0}
          icon={submitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        >
          Simpan Opname ({changedCount} perubahan)
        </Button>
      </div>
    </div>
  )
}

/* ─── Movement Tab ─── */

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  PURCHASE: 'Pembelian',
  RETURN: 'Retur',
  ADJUSTMENT: 'Penyesuaian',
  SALE: 'Penjualan',
}

const MOVEMENT_TYPE_COLORS: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'neutral'> = {
  PURCHASE: 'green',
  RETURN: 'blue',
  ADJUSTMENT: 'amber',
  SALE: 'red',
}

function MovementTab({ rows }: { rows: StockRow[] }) {
  const [form, setForm] = useState<MovementForm>({
    variantId: '',
    movementType: 'ADJUSTMENT',
    qty: 1,
    reference: '',
    reason: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)

  const variantOptions = [
    { label: 'Pilih variant...', value: '' },
    ...rows.map(r => ({ label: `${r.name} (${r.sku}) — stok: ${r.stock}`, value: r.variantId })),
  ]

  const movementTypeOptions = [
    { label: 'Penyesuaian', value: 'ADJUSTMENT' },
    { label: 'Pembelian', value: 'PURCHASE' },
    { label: 'Retur', value: 'RETURN' },
  ]

  const handleSubmit = async () => {
    if (!form.variantId) { setError('Pilih variant'); return }
    if (form.qty === 0) { setError('Qty tidak boleh 0'); return }
    if (form.movementType === 'ADJUSTMENT' && !form.reason.trim()) {
      setError('Alasan penyesuaian harus diisi')
      return
    }

    setSubmitting(true)
    setError(null)
    setSuccess(null)

    const res = await apiPost('/api/v1/inventory/movements', {
      variantId: form.variantId,
      movementType: form.movementType,
      qty: form.qty,
      reference: form.reference.trim() || undefined,
      reason: form.reason.trim() || undefined,
    })

    setSubmitting(false)

    if (res.success) {
      setSuccess('Movement berhasil dicatat')
      setForm({ variantId: '', movementType: 'ADJUSTMENT', qty: 1, reference: '', reason: '' })
      setShowForm(false)
    } else {
      setError(res.error || 'Gagal mencatat movement')
    }
  }

  return (
    <div className="flex flex-col gap-4 flex-1">
      <div className="flex items-center justify-between">
        <p className="text-sm text-ink-muted">
          Catat pergerakan stok manual — pembelian, retur, atau penyesuaian.
        </p>
        <Button
          icon={<Plus size={14} />}
          onClick={() => { setShowForm(true); setSuccess(null); setError(null) }}
        >
          Catat Movement
        </Button>
      </div>

      {success && (
        <div className="p-3 bg-success-muted text-success rounded-lg text-sm font-medium">
          {success}
        </div>
      )}

      {showForm && (
        <Card className="flex flex-col gap-4">
          <h3 className="text-[15px] font-semibold text-ink">Catat Stock Movement</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Variant *"
              options={variantOptions}
              value={form.variantId}
              onChange={v => setForm(f => ({ ...f, variantId: v }))}
            />
            <Select
              label="Tipe Movement *"
              options={movementTypeOptions}
              value={form.movementType}
              onChange={v => setForm(f => ({ ...f, movementType: v as MovementForm['movementType'] }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-ink block mb-1.5">
                Qty *
                {form.movementType === 'ADJUSTMENT' && (
                  <span className="text-xs text-ink-muted ml-1">(negatif untuk kurangi)</span>
                )}
              </label>
              <input
                type="number"
                value={form.qty}
                onChange={e => setForm(f => ({ ...f, qty: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-transparent text-ink"
              />
            </div>
            <Input
              label="Referensi (opsional)"
              placeholder="No. invoice, PO, dll"
              value={form.reference}
              onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-ink block mb-1.5">
              Alasan {form.movementType === 'ADJUSTMENT' && '*'}
            </label>
            <textarea
              placeholder="Alasan atau keterangan movement"
              value={form.reason}
              onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand bg-transparent text-ink"
              rows={2}
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex gap-2 justify-end">
            <Button variant="secondary" onClick={() => setShowForm(false)} disabled={submitting}>Batal</Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? <Loader2 size={14} className="animate-spin mr-1" /> : null}
              Simpan
            </Button>
          </div>
        </Card>
      )}

      <Card className="flex-1 flex flex-col items-center justify-center py-12 gap-3">
        <List size={32} className="text-ink-faint" />
        <p className="text-sm font-medium text-ink-muted">Log Movement</p>
        <p className="text-xs text-ink-faint max-w-xs text-center">
          Riwayat pergerakan stok akan ditampilkan di sini. Gunakan form di atas untuk mencatat movement manual.
        </p>
      </Card>
    </div>
  )
}

/* ─── Main Page ─── */

export default function InventoryPage() {
  const { user } = useAuth()
  const [rows, setRows] = useState<StockRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'list' | 'opname' | 'movement'>('list')

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
  const totalUnits = rows.reduce((sum, s) => sum + s.stock, 0)

  // Opname only for Owner, Admin, Warehouse Staff
  const canOpname = ['Owner', 'Admin', 'Warehouse Staff'].includes(user?.role ?? '')

  return (
    <DashboardLayout>
      <PageHeader
        title="Inventori"
        subtitle="Pantau stok dan movement barang"
        actions={
          <div className="flex gap-2">
            {canOpname && (
              <>
                <Button
                  variant={activeTab === 'movement' ? 'primary' : 'secondary'}
                  icon={<List size={15} />}
                  onClick={() => setActiveTab('movement')}
                >
                  Movement Log
                </Button>
                <Button
                  variant={activeTab === 'opname' ? 'primary' : 'secondary'}
                  icon={<ClipboardCheck size={15} />}
                  onClick={() => setActiveTab('opname')}
                >
                  Stock Opname
                </Button>
              </>
            )}
            <Button
              variant="secondary"
              icon={loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              onClick={loadData}
              disabled={loading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {/* Tab selector */}
      {canOpname && (
        <div className="flex items-center gap-1 bg-surface-raised border border-border rounded-lg p-1 w-fit animate-in stagger-1">
          {(['list', 'opname', 'movement'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ${
                activeTab === tab
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-ink-secondary hover:bg-surface-subtle'
              }`}
            >
              {tab === 'list' ? 'Stok' : tab === 'opname' ? 'Stock Opname' : 'Movement Log'}
            </button>
          ))}
        </div>
      )}

      {/* Metrics — always visible */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in stagger-2">
        <MetricCard label="Total SKU" value={String(rows.length)} subtitle={`${rows.length} variant`} />
        <MetricCard label="Total Unit" value={totalUnits.toLocaleString('id-ID')} subtitle="Total stok semua variant" />
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

      {/* Content by tab */}
      {activeTab === 'list' && (
        <>
          <div className="animate-in stagger-3">
            <Input
              icon={<Search size={16} />}
              placeholder="Cari variant, SKU, atau barcode..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <Card padding={false} className="flex-1 flex flex-col overflow-hidden animate-in stagger-4">
            <div className="overflow-x-auto flex-1 flex flex-col">
              <div className="min-w-[760px] flex flex-col flex-1">
                <div className="grid grid-cols-[minmax(180px,2.5fr)_minmax(100px,1.5fr)_90px_90px_100px] items-center px-6 py-3 bg-surface-subtle border-b border-border gap-4">
                  <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Variant</span>
                  <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">SKU</span>
                  <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Stok</span>
                  <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Threshold</span>
                  <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status</span>
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
                      className={`grid grid-cols-[minmax(180px,2.5fr)_minmax(100px,1.5fr)_90px_90px_100px] items-center px-6 py-3 border-b border-border-light transition-colors hover:bg-surface-subtle gap-4 ${
                        s.critical ? 'bg-[rgba(220,38,38,0.03)]' : ''
                      }`}
                    >
                      <div className="min-w-0 flex flex-col gap-0.5">
                        <span className="text-[13px] font-medium text-ink">{s.name}</span>
                        {s.barcode && <span className="text-[11px] text-ink-muted">Barcode: {s.barcode}</span>}
                      </div>
                      <span className="font-mono text-xs text-ink-secondary">{s.sku}</span>
                      <span className={`text-[13px] font-semibold tabular-nums ${s.critical ? 'text-danger' : 'text-ink-secondary'}`}>
                        {s.stock}
                      </span>
                      <span className="text-[13px] text-ink-muted tabular-nums">{s.threshold}</span>
                      <div className="flex items-center gap-2">
                        {s.critical ? (
                          <Badge color="red"><AlertTriangle size={10} className="mr-1" />Low Stock</Badge>
                        ) : (
                          <Badge color="green">Normal</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Card>
        </>
      )}

      {activeTab === 'opname' && canOpname && (
        <div className="flex flex-col flex-1 gap-4 animate-in">
          <OpnameTab rows={rows} onRefresh={loadData} />
        </div>
      )}

      {activeTab === 'movement' && canOpname && (
        <div className="flex flex-col flex-1 gap-4 animate-in">
          <MovementTab rows={rows} />
        </div>
      )}
    </DashboardLayout>
  )
}
