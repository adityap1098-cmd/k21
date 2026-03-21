'use client'

import { useEffect, useState, useCallback } from 'react'
import { DashboardLayout } from '@/components/layout'
import { PageHeader, Button, Badge, Card, MetricCard } from '@/components/ui'
import { apiGet } from '@/lib/api'
import {
  Plus,
  ShoppingBag,
  RefreshCw,
  Loader2,
  Globe,
} from 'lucide-react'

/* ─── Types ─── */

interface Channel {
  id: string; platform: string; shopName: string
  status: string; tokenExpiresAt: string | null
}

const PLATFORM_COLORS: Record<string, 'brand' | 'blue'> = {
  'SHOPEE': 'brand',
  'TIKTOK': 'blue',
}

const STATUS_COLORS: Record<string, 'green' | 'red' | 'neutral'> = {
  'ACTIVE': 'green',
  'TOKEN_EXPIRED': 'red',
  'DISCONNECTED': 'neutral',
}

/* ─── Page ─── */

export default function MarketplacePage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'channels' | 'orders' | 'webhooks'>('channels')

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await apiGet<Channel[]>('/api/v1/marketplace/channels')
    if (res.success && res.data) setChannels(res.data)
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const activeChannels = channels.filter(c => c.status === 'ACTIVE').length
  const expiredChannels = channels.filter(c => c.status === 'TOKEN_EXPIRED').length

  return (
    <DashboardLayout>
      <PageHeader
        title="Marketplace"
        subtitle="Shopee & TikTok Shop integration"
        actions={
          <>
            <Button variant="secondary" icon={<RefreshCw size={15} />}>Sync Stok</Button>
            <Button icon={<Plus size={15} />}>Tambah Channel</Button>
          </>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-surface-raised border border-border rounded-lg p-1 w-fit animate-in stagger-2">
        {(['channels', 'orders', 'webhooks'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ${
              activeTab === tab
                ? 'bg-brand text-white shadow-sm'
                : 'text-ink-secondary hover:bg-surface-subtle'
            }`}
          >
            {tab === 'channels' ? 'Channel' : tab === 'orders' ? 'Order' : 'Webhook Events'}
          </button>
        ))}
      </div>

      {activeTab === 'channels' && (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in stagger-3">
            <MetricCard label="Total Channel" value={String(channels.length)} subtitle="Platform terhubung" />
            <MetricCard label="Aktif" value={String(activeChannels)} subtitle="Token valid" valueColor="text-success" />
            <MetricCard
              label="Token Expired"
              value={String(expiredChannels)}
              subtitle="Perlu reconnect"
              labelColor={expiredChannels > 0 ? 'text-danger' : undefined}
              valueColor={expiredChannels > 0 ? 'text-danger' : undefined}
            />
          </div>

          {/* Channel cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in stagger-4">
            {loading ? (
              [1,2].map(i => (
                <Card key={i} className="h-[140px] flex items-center justify-center">
                  <Loader2 size={20} className="text-ink-faint animate-spin" />
                </Card>
              ))
            ) : channels.length === 0 ? (
              <Card className="col-span-2 py-16 flex flex-col items-center gap-3">
                <Globe size={32} className="text-ink-faint" />
                <p className="text-sm font-medium text-ink-muted">Belum ada marketplace terhubung</p>
                <p className="text-xs text-ink-faint">Hubungkan Shopee atau TikTok Shop untuk mulai</p>
              </Card>
            ) : channels.map(ch => (
              <Card key={ch.id} className="flex flex-col gap-3 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      ch.platform === 'SHOPEE' ? 'bg-brand-muted' : 'bg-info-muted'
                    }`}>
                      <ShoppingBag size={18} className={ch.platform === 'SHOPEE' ? 'text-brand' : 'text-info'} />
                    </div>
                    <div>
                      <h3 className="text-[15px] font-semibold text-ink">{ch.shopName}</h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge color={PLATFORM_COLORS[ch.platform] || 'neutral'}>{ch.platform}</Badge>
                      </div>
                    </div>
                  </div>
                  <Badge color={STATUS_COLORS[ch.status] || 'neutral'}>
                    {ch.status === 'ACTIVE' ? 'Connected' : ch.status === 'TOKEN_EXPIRED' ? 'Expired' : 'Disconnected'}
                  </Badge>
                </div>
                {ch.tokenExpiresAt && (
                  <p className="text-xs text-ink-muted pt-1 border-t border-border-light">
                    Token expires: {new Date(ch.tokenExpiresAt).toLocaleDateString('id-ID')}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </>
      )}

      {activeTab === 'orders' && (
        <Card className="flex-1 flex flex-col items-center justify-center py-16 gap-3 animate-in stagger-3">
          <ShoppingBag size={32} className="text-ink-faint" />
          <p className="text-sm font-medium text-ink-muted">Marketplace Orders</p>
          <p className="text-xs text-ink-faint max-w-sm text-center">
            Order dari Shopee dan TikTok Shop akan muncul di sini secara otomatis via webhook
          </p>
        </Card>
      )}

      {activeTab === 'webhooks' && (
        <Card className="flex-1 flex flex-col items-center justify-center py-16 gap-3 animate-in stagger-3">
          <RefreshCw size={32} className="text-ink-faint" />
          <p className="text-sm font-medium text-ink-muted">Webhook Events</p>
          <p className="text-xs text-ink-faint max-w-sm text-center">
            Log webhook events dari marketplace. Gunakan untuk debugging jika order tidak masuk.
          </p>
        </Card>
      )}
    </DashboardLayout>
  )
}
