'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Badge, Card, Input, MetricCard } from '@/components/ui'
import { apiGet } from '@/lib/api'
import {
  Plus,
  Search,
  MapPin,
  Loader2,
  ClipboardList,
  PackageCheck,
} from 'lucide-react'

/* ─── Types ─── */

interface Warehouse {
  id: string; name: string; address: string | null; isActive: boolean
}

const LOCATION_TYPE_COLORS: Record<string, 'brand' | 'blue' | 'green'> = {
  'ZONE': 'brand',
  'RACK': 'blue',
  'BIN': 'green',
}

/* ─── Page ─── */

export default function WarehousePage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'warehouses' | 'picking'>('warehouses')

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await apiGet<Warehouse[]>('/api/v1/warehouse/warehouses')
    if (res.success && res.data) setWarehouses(res.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  return (
    <DashboardLayout>
      <PageHeader
        title="Warehouse"
        subtitle="Kelola gudang, lokasi, dan picking list"
        actions={
          <>
            <Button variant="secondary" icon={<ClipboardList size={15} />}>Picking List</Button>
            <Button icon={<Plus size={15} />}>Tambah Gudang</Button>
          </>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface-raised border border-border rounded-lg p-1 w-fit animate-in stagger-2">
        {(['warehouses', 'picking'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ${
              activeTab === tab
                ? 'bg-brand text-white shadow-sm'
                : 'text-ink-secondary hover:bg-surface-subtle'
            }`}
          >
            {tab === 'warehouses' ? 'Gudang & Lokasi' : 'Picking & Packing'}
          </button>
        ))}
      </div>

      {activeTab === 'warehouses' && (
        <>
          <div className="animate-in stagger-3">
            <Input
              icon={<Search size={16} />}
              placeholder="Cari gudang..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-in stagger-4">
            {loading ? (
              [1,2,3].map(i => (
                <Card key={i} className="h-[180px] flex items-center justify-center">
                  <Loader2 size={20} className="text-ink-faint animate-spin" />
                </Card>
              ))
            ) : warehouses.length === 0 ? (
              <Card className="col-span-3 py-16 flex flex-col items-center gap-3">
                <MapPin size={32} className="text-ink-faint" />
                <p className="text-sm font-medium text-ink-muted">Belum ada gudang</p>
                <p className="text-xs text-ink-faint">Tambah gudang pertama untuk mulai mengelola lokasi</p>
              </Card>
            ) : warehouses.filter(w => !search || w.name.toLowerCase().includes(search.toLowerCase())).map(w => (
              <Card key={w.id} className="flex flex-col gap-4 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-brand-muted flex items-center justify-center">
                      <MapPin size={18} className="text-brand" />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink">{w.name}</h3>
                      <p className="text-xs text-ink-muted mt-0.5">{w.address || 'Alamat belum diisi'}</p>
                    </div>
                  </div>
                  <Badge color={w.isActive ? 'green' : 'neutral'}>
                    {w.isActive ? 'Aktif' : 'Non-aktif'}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 pt-2 border-t border-border-light">
                  <div className="flex items-center gap-1.5">
                    <Badge color="brand">ZONE</Badge>
                    <Badge color="blue">RACK</Badge>
                    <Badge color="green">BIN</Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {activeTab === 'picking' && (
        <Card className="flex-1 flex flex-col items-center justify-center py-16 gap-3 animate-in stagger-3">
          <PackageCheck size={32} className="text-ink-faint" />
          <p className="text-sm font-medium text-ink-muted">Picking & Packing List</p>
          <p className="text-xs text-ink-faint max-w-sm text-center">
            Picking list akan muncul di sini ketika ada order yang perlu diproses
          </p>
        </Card>
      )}
    </DashboardLayout>
  )
}
