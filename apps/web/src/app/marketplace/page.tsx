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
  Webhook,
  Clock,
} from 'lucide-react'

/* ─── Types ─── */

interface Channel {
  id: string; platform: string; shopName: string
  status: string; tokenExpiresAt: string | null
}

interface ChannelOrder {
  id: string; orderId: string; platform: string
  status: string; totalAmount: number; createdAt: string
}

interface WebhookEvent {
  id: string; eventType: string
  processedAt: string; createdAt: string
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

function formatRp(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/* ─── Page ─── */

export default function MarketplacePage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'channels' | 'orders' | 'webhooks'>('channels')

  // Tab-specific state — only load when that tab is visited
  const [selectedChannelId, setSelectedChannelId] = useState<string | null>(null)
  const [orders, setOrders] = useState<ChannelOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [webhooks, setWebhooks] = useState<WebhookEvent[]>([])
  const [webhooksLoading, setWebhooksLoading] = useState(false)

  const loadChannels = useCallback(async () => {
    setLoading(true)
    const res = await apiGet<Channel[]>('/api/v1/marketplace/channels')
    if (res.success && res.data) {
      setChannels(res.data)
      // Auto-select first channel for orders/webhooks
      if (res.data.length > 0 && !selectedChannelId) {
        setSelectedChannelId(res.data[0].id)
      }
    }
    setLoading(false)
  }, [selectedChannelId])

  const loadOrders = useCallback(async (channelId: string) => {
    setOrdersLoading(true)
    const res = await apiGet<ChannelOrder[]>(`/api/v1/marketplace/channels/${channelId}/orders?limit=50`)
    if (res.success && res.data) setOrders(res.data)
    setOrdersLoading(false)
  }, [])

  const loadWebhooks = useCallback(async (channelId: string) => {
    setWebhooksLoading(true)
    const res = await apiGet<WebhookEvent[]>(`/api/v1/marketplace/channels/${channelId}/webhooks?limit=50`)
    if (res.success && res.data) setWebhooks(res.data)
    setWebhooksLoading(false)
  }, [])

  useEffect(() => { loadChannels() }, [])

  // Load tab data when switching tabs or selecting channel
  useEffect(() => {
    if (!selectedChannelId) return
    if (activeTab === 'orders') loadOrders(selectedChannelId)
    if (activeTab === 'webhooks') loadWebhooks(selectedChannelId)
  }, [activeTab, selectedChannelId])

  const activeChannels = channels.filter(c => c.status === 'ACTIVE').length
  const expiredChannels = channels.filter(c => c.status === 'TOKEN_EXPIRED').length

  const selectedChannel = channels.find(c => c.id === selectedChannelId)

  return (
    <DashboardLayout>
      <PageHeader
        title="Marketplace"
        subtitle="Shopee & TikTok Shop integration"
        actions={
          <>
            <Button
              variant="secondary"
              icon={loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              onClick={loadChannels}
              disabled={loading}
            >
              Refresh
            </Button>
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

      {/* Channel selector for orders/webhooks tabs */}
      {(activeTab === 'orders' || activeTab === 'webhooks') && channels.length > 1 && (
        <div className="flex items-center gap-2 animate-in">
          <span className="text-sm text-ink-muted">Channel:</span>
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setSelectedChannelId(ch.id)}
              className={`px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-colors ${
                selectedChannelId === ch.id
                  ? 'bg-brand text-white border-brand'
                  : 'border-border text-ink-secondary hover:bg-surface-subtle'
              }`}
            >
              {ch.shopName}
            </button>
          ))}
        </div>
      )}

      {activeTab === 'channels' && (
        <>
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
              <div
                key={ch.id}
                onClick={() => { setSelectedChannelId(ch.id); setActiveTab('orders') }}
                className="cursor-pointer"
              >
              <Card
                className="flex flex-col gap-3 hover:shadow-md transition-shadow"
              >
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
                <p className="text-xs text-brand font-medium">Lihat order →</p>
              </Card>
              </div>
            ))}
          </div>
        </>
      )}

      {activeTab === 'orders' && (
        <Card padding={false} className="flex-1 flex flex-col overflow-hidden animate-in stagger-3">
          {ordersLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-ink-faint" />
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ShoppingBag size={32} className="text-ink-faint" />
              <p className="text-sm font-medium text-ink-muted">
                {selectedChannel ? `Tidak ada order masuk dari ${selectedChannel.shopName}` : 'Pilih channel'}
              </p>
              <p className="text-xs text-ink-faint max-w-xs text-center">
                Order marketplace akan masuk via webhook saat ada transaksi baru
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_100px_100px_130px] items-center px-6 py-3 bg-surface-subtle border-b border-border gap-4">
                <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Order ID</span>
                <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Platform</span>
                <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Total</span>
                <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Waktu</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {orders.map(order => (
                  <div key={order.id} className="grid grid-cols-[1fr_100px_100px_130px] items-center px-6 py-3.5 border-b border-border-light gap-4">
                    <span className="font-mono text-xs text-ink truncate">{order.orderId}</span>
                    <Badge color={PLATFORM_COLORS[order.platform] || 'neutral'}>{order.platform}</Badge>
                    <span className="text-[13px] font-medium tabular-nums">{formatRp(order.totalAmount)}</span>
                    <span className="text-[13px] text-ink-muted">{formatDate(order.createdAt)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}

      {activeTab === 'webhooks' && (
        <Card padding={false} className="flex-1 flex flex-col overflow-hidden animate-in stagger-3">
          {webhooksLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-ink-faint" />
            </div>
          ) : webhooks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <Webhook size={32} className="text-ink-faint" />
              <p className="text-sm font-medium text-ink-muted">Belum ada webhook event</p>
              <p className="text-xs text-ink-faint max-w-xs text-center">
                Event webhook dari marketplace akan muncul di sini. Gunakan untuk debugging jika order tidak masuk.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_160px_160px] items-center px-6 py-3 bg-surface-subtle border-b border-border gap-4">
                <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Tipe Event</span>
                <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Diproses</span>
                <span className="text-[11px] font-semibold text-ink-muted uppercase tracking-wider">Diterima</span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {webhooks.map(wh => (
                  <div key={wh.id} className="grid grid-cols-[1fr_160px_160px] items-center px-6 py-3.5 border-b border-border-light gap-4">
                    <span className="font-mono text-xs text-ink">{wh.eventType}</span>
                    <div className="flex items-center gap-1.5">
                      <Clock size={12} className="text-ink-faint" />
                      <span className="text-[13px] text-ink-muted">{formatDate(wh.processedAt)}</span>
                    </div>
                    <span className="text-[13px] text-ink-muted">{formatDate(wh.createdAt)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </Card>
      )}
    </DashboardLayout>
  )
}
