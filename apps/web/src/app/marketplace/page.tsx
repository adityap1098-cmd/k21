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
  AlertTriangle,
} from 'lucide-react'

/* ─── Types ─── */

interface Channel {
  id: string; platform: string; shopName: string
  status: string; tokenExpiresAt: string | null
}

interface ChannelOrder {
  id: string; orderSn: string; platform: string; status: string
  buyerName: string | null; totalAmount: string | null
  skuResolutionStatus: string; createdAt: string
}

interface WebhookEvent {
  id: string; eventType: string; processingStatus: string
  errorMessage: string | null; processedAt: string | null; createdAt: string
}

/* ─── Color / label maps ─── */

const PLATFORM_COLORS: Record<string, 'brand' | 'blue'> = {
  'shopee': 'brand',
  'tiktok': 'blue',
}

const STATUS_COLORS: Record<string, 'green' | 'red' | 'neutral'> = {
  'ACTIVE': 'green',
  'TOKEN_EXPIRED': 'red',
  'DISCONNECTED': 'neutral',
}

const ORDER_STATUS_COLORS: Record<string, 'neutral' | 'blue' | 'amber' | 'green' | 'red'> = {
  PENDING: 'neutral',
  CONFIRMED: 'blue',
  READY_TO_SHIP: 'amber',
  SHIPPED: 'green',
  DELIVERED: 'green',
  CANCELLED: 'red',
  RETURNED: 'amber',
  STOCK_CONFLICT: 'red',
}

const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Dikonfirmasi',
  READY_TO_SHIP: 'Siap Kirim',
  SHIPPED: 'Terkirim',
  DELIVERED: 'Diterima',
  CANCELLED: 'Dibatalkan',
  RETURNED: 'Dikembalikan',
  STOCK_CONFLICT: 'Stok Konflik',
}

const WEBHOOK_STATUS_COLORS: Record<string, 'neutral' | 'green' | 'red' | 'amber'> = {
  PENDING: 'neutral',
  PROCESSED: 'green',
  FAILED: 'red',
  SKIPPED: 'amber',
}

/* ─── Helpers ─── */

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

/* ─── Page ─── */

export default function MarketplacePage() {
  const [channels, setChannels] = useState<Channel[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'channels' | 'orders' | 'webhooks'>('channels')

  const [orders, setOrders] = useState<ChannelOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>([])
  const [webhooksLoading, setWebhooksLoading] = useState(false)

  const loadData = useCallback(async () => {
    setLoading(true)
    const res = await apiGet<Channel[]>('/api/v1/marketplace/channels')
    if (res.success && res.data) setChannels(res.data)
    setLoading(false)
  }, [])

  const loadOrders = useCallback(async (channelId: string) => {
    setOrdersLoading(true)
    const res = await apiGet<{ data: ChannelOrder[]; total: number }>(
      `/api/v1/marketplace/channels/${channelId}/orders`
    )
    if (res.success && res.data) setOrders(res.data.data)
    setOrdersLoading(false)
  }, [])

  const loadWebhooks = useCallback(async (channelId: string) => {
    setWebhooksLoading(true)
    const res = await apiGet<{ data: WebhookEvent[]; total: number }>(
      `/api/v1/marketplace/channels/${channelId}/webhooks`
    )
    if (res.success && res.data) setWebhookEvents(res.data.data)
    setWebhooksLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const channelId = channels[0]?.id
    if (!channelId) return
    if (activeTab === 'orders') loadOrders(channelId)
    if (activeTab === 'webhooks') loadWebhooks(channelId)
  }, [activeTab, channels, loadOrders, loadWebhooks])

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

      {/* ─── Channels tab ─── */}
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
              [1, 2].map(i => (
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
                      ch.platform === 'shopee' ? 'bg-brand-muted' : 'bg-info-muted'
                    }`}>
                      <ShoppingBag size={18} className={ch.platform === 'shopee' ? 'text-brand' : 'text-info'} />
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

      {/* ─── Orders tab ─── */}
      {activeTab === 'orders' && (
        <div className="animate-in stagger-3">
          {ordersLoading ? (
            <Card className="flex items-center justify-center py-16">
              <Loader2 size={24} className="text-ink-faint animate-spin" />
            </Card>
          ) : orders.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 gap-3">
              <Globe size={32} className="text-ink-faint" />
              <p className="text-sm font-medium text-ink-muted">Belum ada order</p>
              <p className="text-xs text-ink-faint max-w-sm text-center">
                Order dari marketplace akan muncul di sini setelah webhook diterima
              </p>
            </Card>
          ) : (
            <Card padding={false} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border bg-surface-subtle">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Order SN</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Pembeli</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">SKU</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-ink-muted uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-ink-muted uppercase tracking-wider">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-surface-subtle transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-ink">{o.orderSn}</td>
                        <td className="px-4 py-3 text-ink-secondary">{o.buyerName ?? '—'}</td>
                        <td className="px-4 py-3">
                          <Badge color={ORDER_STATUS_COLORS[o.status] ?? 'neutral'}>
                            {ORDER_STATUS_LABELS[o.status] ?? o.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          {o.skuResolutionStatus !== 'RESOLVED' && (
                            <Badge color="amber">
                              <AlertTriangle size={11} className="inline mr-1" />
                              SKU
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-ink">
                          Rp {Number(o.totalAmount ?? 0).toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-right text-ink-faint whitespace-nowrap">
                          {formatDate(o.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ─── Webhooks tab ─── */}
      {activeTab === 'webhooks' && (
        <div className="animate-in stagger-3">
          {webhooksLoading ? (
            <Card className="flex items-center justify-center py-16">
              <Loader2 size={24} className="text-ink-faint animate-spin" />
            </Card>
          ) : webhookEvents.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 gap-3">
              <RefreshCw size={32} className="text-ink-faint" />
              <p className="text-sm font-medium text-ink-muted">Belum ada webhook event</p>
              <p className="text-xs text-ink-faint max-w-sm text-center">
                Log webhook dari marketplace akan muncul di sini. Gunakan untuk debugging jika order tidak masuk.
              </p>
            </Card>
          ) : (
            <Card padding={false} className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="border-b border-border bg-surface-subtle">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Event Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-ink-muted uppercase tracking-wider">Error</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-ink-muted uppercase tracking-wider">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-light">
                    {webhookEvents.map(e => (
                      <tr key={e.id} className="hover:bg-surface-subtle transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-ink">{e.eventType}</td>
                        <td className="px-4 py-3">
                          <Badge color={WEBHOOK_STATUS_COLORS[e.processingStatus] ?? 'neutral'}>
                            {e.processingStatus}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-ink-faint max-w-[240px] truncate">
                          {e.errorMessage
                            ? <span className="text-danger text-xs">{e.errorMessage.slice(0, 80)}{e.errorMessage.length > 80 ? '…' : ''}</span>
                            : '—'
                          }
                        </td>
                        <td className="px-4 py-3 text-right text-ink-faint whitespace-nowrap">
                          {formatDate(e.createdAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </DashboardLayout>
  )
}
