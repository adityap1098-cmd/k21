'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Badge, Card, Input, Select } from '@/components/ui'
import { apiGet } from '@/lib/api'
import {
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
} from 'lucide-react'

/* ─── Types ─── */

interface PurchaseOrder {
  id: string; poNumber: string; supplierName: string
  totalAmount: number; status: string; createdAt: string
  approvedBy: string | null; items?: unknown[]
}

const STATUS_COLORS: Record<string, 'neutral' | 'amber' | 'blue' | 'green' | 'red' | 'brand'> = {
  'DRAFT': 'neutral',
  'PENDING_APPROVAL': 'amber',
  'APPROVED': 'blue',
  'PARTIALLY_RECEIVED': 'brand',
  'RECEIVED': 'green',
  'CANCELLED': 'red',
}

const STATUS_LABELS: Record<string, string> = {
  'DRAFT': 'Draft',
  'PENDING_APPROVAL': 'Pending',
  'APPROVED': 'Approved',
  'PARTIALLY_RECEIVED': 'Partial',
  'RECEIVED': 'Received',
  'CANCELLED': 'Cancelled',
}

const STATUS_FILTER = [
  { label: 'Semua', value: 'all' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Pending', value: 'PENDING_APPROVAL' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Received', value: 'RECEIVED' },
]

function formatRp(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

/* ─── Page ─── */

export default function ProcurementPage() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')

  const loadData = useCallback(async () => {
    setLoading(true)
    const params = statusFilter !== 'all' ? `?status=${statusFilter}` : ''
    const res = await apiGet<{ data: PurchaseOrder[]; total: number } | PurchaseOrder[]>(`/api/v1/procurement/purchase-orders${params}`)
    if (res.success && res.data) {
      const list = Array.isArray(res.data) ? res.data : (res.data as { data: PurchaseOrder[] }).data || []
      setOrders(list)
    }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { loadData() }, [loadData])

  const filtered = orders.filter(po => {
    if (!search) return true
    const q = search.toLowerCase()
    return po.poNumber.toLowerCase().includes(q) || po.supplierName.toLowerCase().includes(q)
  })

  return (
    <DashboardLayout>
      <PageHeader
        title="Procurement"
        subtitle="Purchase Order dan penerimaan barang"
        actions={
          <Button icon={<Plus size={15} />}>Buat PO Baru</Button>
        }
      />

      <div className="flex items-center gap-3 animate-in stagger-2">
        <div className="flex-1">
          <Input
            icon={<Search size={16} />}
            placeholder="Cari nomor PO atau nama supplier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Select
          label="Status:"
          options={STATUS_FILTER}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      <Card padding={false} className="flex-1 flex flex-col overflow-hidden animate-in stagger-3">
        <div className="overflow-x-auto flex-1 flex flex-col">
          <div className="min-w-[780px] flex flex-col flex-1">
        <div className="flex items-center px-5 py-3 bg-surface-subtle border-b border-border">
          <span className="w-[180px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">No. PO</span>
          <span className="w-[200px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Supplier</span>
          <span className="w-[130px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Total</span>
          <span className="w-[100px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Status</span>
          <span className="w-[100px] text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Tanggal</span>
          <span className="flex-1 text-[11px] font-semibold text-ink-muted uppercase tracking-wider text-right">Approved</span>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="text-ink-faint animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <FileText size={32} className="text-ink-faint" />
              <p className="text-sm font-medium text-ink-muted">Belum ada Purchase Order</p>
            </div>
          ) : filtered.map(po => (
            <div
              key={po.id}
              className="flex items-center px-5 py-3.5 border-b border-border-light hover:bg-surface-subtle transition-colors cursor-pointer group"
            >
              <div className="w-[180px] flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-surface-subtle flex items-center justify-center flex-shrink-0 border border-border-light">
                  <FileText size={14} className="text-ink-faint" />
                </div>
                <span className="font-mono text-xs font-medium text-ink">{po.poNumber}</span>
              </div>
              <span className="w-[200px] text-[13px] text-ink-secondary truncate">{po.supplierName}</span>
              <span className="w-[130px] text-[13px] font-medium text-ink tabular-nums">{formatRp(po.totalAmount)}</span>
              <div className="w-[100px]">
                <Badge color={STATUS_COLORS[po.status] || 'neutral'}>{STATUS_LABELS[po.status] || po.status}</Badge>
              </div>
              <span className="w-[100px] text-[13px] text-ink-muted">{formatDate(po.createdAt)}</span>
              <span className="flex-1 text-right text-[13px] text-ink-muted">{po.approvedBy || '—'}</span>
            </div>
          ))}
        </div>
          </div>{/* min-w */}
        </div>{/* overflow-x */}

        <div className="flex items-center justify-between px-5 py-3 border-t border-border">
          <span className="text-xs text-ink-muted">{filtered.length} Purchase Order</span>
          <div className="flex items-center gap-1">
            <button className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-surface-subtle transition-colors">
              <ChevronLeft size={14} className="text-ink-faint" />
            </button>
            <button className="w-8 h-8 rounded-md bg-brand text-white text-xs font-semibold flex items-center justify-center">1</button>
            <button className="w-8 h-8 rounded-md border border-border flex items-center justify-center hover:bg-surface-subtle transition-colors">
              <ChevronRight size={14} className="text-ink-secondary" />
            </button>
          </div>
        </div>
      </Card>
    </DashboardLayout>
  )
}
