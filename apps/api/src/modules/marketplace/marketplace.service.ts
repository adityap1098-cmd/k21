/**
 * Marketplace Service
 * Handles marketplace channel management and order/webhook operations.
 * Phase Future: Returns static/default data for disconnected channels.
 */

export interface Channel {
  id: string
  platform: 'SHOPEE' | 'TIKTOK'
  shopName: string
  status: 'ACTIVE' | 'TOKEN_EXPIRED' | 'DISCONNECTED'
  tokenExpiresAt: string | null
}

export interface ChannelOrder {
  id: string
  channelId: string
  orderId: string
  platform: string
  status: string
  totalAmount: number
  createdAt: string
}

export interface WebhookEvent {
  id: string
  channelId: string
  eventType: string
  payload: Record<string, unknown>
  processedAt: string
  createdAt: string
}

/**
 * List all marketplace channels for this business.
 * Phase Future: Returns hardcoded default channels with DISCONNECTED status.
 */
export async function listChannels(): Promise<Channel[]> {
  // Phase Future: Return default channels showing as disconnected
  return [
    {
      id: 'ch_shopee_001',
      platform: 'SHOPEE',
      shopName: 'My Shopee Store',
      status: 'DISCONNECTED',
      tokenExpiresAt: null,
    },
    {
      id: 'ch_tiktok_001',
      platform: 'TIKTOK',
      shopName: 'My TikTok Shop',
      status: 'DISCONNECTED',
      tokenExpiresAt: null,
    },
  ]
}

/**
 * Get orders for a specific marketplace channel.
 * Phase Future: Returns empty array.
 */
export async function getChannelOrders(
  channelId: string,
  filters?: {
    status?: string
    limit?: number
    offset?: number
  }
): Promise<ChannelOrder[]> {
  // Phase Future: Placeholder implementation
  return []
}

/**
 * Get webhook events for a specific channel.
 * Phase Future: Returns empty array.
 */
export async function getWebhookEvents(
  channelId: string,
  filters?: {
    eventType?: string
    limit?: number
    offset?: number
  }
): Promise<WebhookEvent[]> {
  // Phase Future: Placeholder implementation
  return []
}
