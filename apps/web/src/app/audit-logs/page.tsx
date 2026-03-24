'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { Card, Badge } from '@/components/ui'
import { apiGet } from '@/lib/api'
import {
  ScrollText,
  Filter,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Pencil,
  Trash2,
  Eye,
  X,
  User,
} from 'lucide-react'

interface AuditLogItem {
  id: string
  user_id: string
  user_name: string
  action: 'CREATE' | 'UPDATE' | 'DELETE'
  table_name: string
  record_id: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip_address: string
  created_at: string
}

const ACTION_CONFIG = {
  CREATE: { label: 'Buat', color: 'green' as const, icon: Plus },
  UPDATE: { label: 'Ubah', color: 'blue' as const, icon: Pencil },
  DELETE: { label: 'Hapus', color: 'red' as const, icon: Trash2 },
}

const TABLE_LABELS: Record<string, string> = {
  users: 'Pengguna',
  products: 'Produk',
  product_variants: 'Varian Produk',
  categories: 'Kategori',
  transactions: 'Transaksi',
  shifts: 'Shift',
  service_orders: 'Service Order',
  purchase_orders: 'Purchase Order',
  inventory_movements: 'Stok',
  customers: 'Pelanggan',
  vehicles: 'Kendaraan',
  mechanics: 'Mekanik',
}

function formatDateTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const LIMIT = 30

export default function AuditLogsPage() {
  const [items, setItems] = useState<AuditLogItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [actionFilter, setActionFilter] = useState('')
  const [tableFilter, setTableFilter] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [tables, setTables] = useState<string[]>([])
  const [detailItem, setDetailItem] = useState<AuditLogItem | null>(null)

  // Fetch distinct tables for filter
  useEffect(() => {
    apiGet<string[]>('/api/v1/audit-logs/tables').then(res => {
      if (res.success && res.data) setTables(res.data)
    })
  }, [])

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (actionFilter) params.set('action', actionFilter)
    if (tableFilter) params.set('tableName', tableFilter)
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)

    const res = await apiGet<{ items: AuditLogItem[]; total: number }>(`/api/v1/audit-logs?${params}`)
    if (res.success && res.data) {
      setItems(res.data.items)
      setTotal(res.data.total)
    }
    setLoading(false)
  }, [page, actionFilter, tableFilter, dateFrom, dateTo])

  useEffect(() => { fetchLogs() }, [fetchLogs])

  const totalPages = Math.ceil(total / LIMIT)

  return (
    <DashboardLayout>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink">Audit Log</h1>
          <p className="text-xs text-ink-muted mt-0.5">Riwayat semua perubahan data sistem</p>
        </div>
        <span className="text-xs text-ink-muted">{total} catatan</span>
      </div>

      {/* Filters */}
      <Card className="flex flex-wrap items-center gap-3">
        <Filter size={14} className="text-ink-muted" />
        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(1) }}
          className="text-xs border border-border rounded-lg px-3 py-2 bg-transparent text-ink"
        >
          <option value="">Semua Aksi</option>
          <option value="CREATE">Buat</option>
          <option value="UPDATE">Ubah</option>
          <option value="DELETE">Hapus</option>
        </select>
        <select
          value={tableFilter}
          onChange={e => { setTableFilter(e.target.value); setPage(1) }}
          className="text-xs border border-border rounded-lg px-3 py-2 bg-transparent text-ink"
        >
          <option value="">Semua Tabel</option>
          {tables.map(t => (
            <option key={t} value={t}>{TABLE_LABELS[t] || t}</option>
          ))}
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          className="text-xs border border-border rounded-lg px-3 py-2 bg-transparent text-ink"
        />
        <span className="text-xs text-ink-muted">s/d</span>
        <input
          type="date"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1) }}
          className="text-xs border border-border rounded-lg px-3 py-2 bg-transparent text-ink"
        />
        {(actionFilter || tableFilter || dateFrom || dateTo) && (
          <button
            onClick={() => { setActionFilter(''); setTableFilter(''); setDateFrom(''); setDateTo(''); setPage(1) }}
            className="text-xs text-brand hover:underline"
          >
            Reset
          </button>
        )}
      </Card>

      {/* Table */}
      <Card padding={false}>
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <Loader2 size={24} className="text-ink-faint animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <ScrollText size={32} className="text-ink-faint mx-auto mb-3" />
            <p className="text-sm text-ink-muted">Tidak ada log ditemukan</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-surface-subtle border-b border-border-light">
                    <th className="text-left px-4 py-3 font-semibold text-ink-muted">Waktu</th>
                    <th className="text-left px-4 py-3 font-semibold text-ink-muted">User</th>
                    <th className="text-left px-4 py-3 font-semibold text-ink-muted">Aksi</th>
                    <th className="text-left px-4 py-3 font-semibold text-ink-muted">Tabel</th>
                    <th className="text-left px-4 py-3 font-semibold text-ink-muted">Record ID</th>
                    <th className="text-left px-4 py-3 font-semibold text-ink-muted">IP</th>
                    <th className="text-center px-4 py-3 font-semibold text-ink-muted">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const cfg = ACTION_CONFIG[item.action]
                    const Icon = cfg.icon
                    return (
                      <tr key={item.id} className="border-b border-border-light hover:bg-surface-subtle transition-colors">
                        <td className="px-4 py-2.5 text-ink-secondary whitespace-nowrap">{formatDateTime(item.created_at)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <User size={12} className="text-ink-faint" />
                            <span className="text-ink font-medium">{item.user_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge color={cfg.color}>
                            <Icon size={10} className="mr-1" />
                            {cfg.label}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-ink-secondary">{TABLE_LABELS[item.table_name] || item.table_name}</td>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-ink-faint">{item.record_id.slice(0, 8)}</td>
                        <td className="px-4 py-2.5 text-ink-faint font-mono text-[10px]">{item.ip_address}</td>
                        <td className="px-4 py-2.5 text-center">
                          <button
                            onClick={() => setDetailItem(item)}
                            className="text-brand hover:underline text-[11px] font-medium inline-flex items-center gap-0.5"
                          >
                            <Eye size={12} /> Lihat
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border-light">
                <span className="text-xs text-ink-muted">Halaman {page} dari {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="p-1.5 rounded-lg hover:bg-surface-subtle disabled:opacity-30 transition-colors">
                    <ChevronLeft size={16} />
                  </button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    className="p-1.5 rounded-lg hover:bg-surface-subtle disabled:opacity-30 transition-colors">
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Detail modal */}
      {detailItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDetailItem(null)}>
          <div className="bg-surface-raised rounded-2xl shadow-2xl border border-border w-full max-w-2xl max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h3 className="text-sm font-semibold text-ink">Detail Perubahan</h3>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  {ACTION_CONFIG[detailItem.action].label} pada {TABLE_LABELS[detailItem.table_name] || detailItem.table_name}
                  {' · '}{formatDateTime(detailItem.created_at)}
                </p>
              </div>
              <button onClick={() => setDetailItem(null)} className="text-ink-muted hover:text-ink p-1">
                <X size={18} />
              </button>
            </div>
            <div className="px-6 py-4 overflow-y-auto max-h-[60vh] space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div><span className="text-ink-muted">User:</span> <span className="font-medium">{detailItem.user_name}</span></div>
                <div><span className="text-ink-muted">IP:</span> <span className="font-mono">{detailItem.ip_address}</span></div>
                <div><span className="text-ink-muted">Record ID:</span> <span className="font-mono text-[11px]">{detailItem.record_id}</span></div>
              </div>

              {detailItem.action === 'UPDATE' && detailItem.old_value && detailItem.new_value && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs font-semibold text-ink-muted mb-2">Sebelum</p>
                    <pre className="text-[11px] bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(detailItem.old_value, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-ink-muted mb-2">Sesudah</p>
                    <pre className="text-[11px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(detailItem.new_value, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {detailItem.action === 'CREATE' && detailItem.new_value && (
                <div>
                  <p className="text-xs font-semibold text-ink-muted mb-2">Data Baru</p>
                  <pre className="text-[11px] bg-emerald-50 dark:bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(detailItem.new_value, null, 2)}
                  </pre>
                </div>
              )}

              {detailItem.action === 'DELETE' && detailItem.old_value && (
                <div>
                  <p className="text-xs font-semibold text-ink-muted mb-2">Data yang Dihapus</p>
                  <pre className="text-[11px] bg-red-50 dark:bg-red-500/10 text-red-800 dark:text-red-300 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(detailItem.old_value, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
