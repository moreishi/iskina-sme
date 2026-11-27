import type { HttpClient } from './http'

export interface StorefrontSummary {
  id: string
  name: string
  slug: string
  vertical: 'food' | 'aircon' | 'lpg'
  lat: number | null
  lng: number | null
}

export interface CatalogItemView {
  id: string
  name: string
  priceCentavos: number
  unit: string
  available?: boolean
}

export interface StorefrontDetail {
  business: {
    id: string
    name: string
    slug: string
    vertical: 'food' | 'aircon' | 'lpg'
    timezone: string
  }
  config: {
    fulfillment: 'delivery' | 'booking'
    requiresSchedule: boolean
    deliveryFeeCentavos: number
    minOrderCentavos: number
  }
  theme: { version: number }
  source: 'published' | 'default'
  categories: { id: string; name: string; items: CatalogItemView[] }[]
  uncategorized: CatalogItemView[]
}

export interface Quote {
  businessId: string
  subtotalCentavos: number
  deliveryFeeCentavos: number
  totalCentavos: number
  meetsMinOrder: boolean
  lines: { itemId: string; name: string; unitPriceCentavos: number; quantity: number }[]
}

export interface PlacedOrder {
  order: {
    id: string
    number: string
    status: string
    totalCentavos: number
  }
  lines: unknown[]
}

export interface OrderStatus {
  order: {
    id: string
    number: string
    status: string
    totalCentavos: number
  }
  events: { toStatus: string; actorType: string; createdAt: string }[]
}

export class ConsumerAgent {
  constructor(private readonly http: HttpClient) {}

  async discover(): Promise<StorefrontSummary[]> {
    const result = await this.http.request<{ storefronts: StorefrontSummary[] }>(
      'GET',
      '/api/v1/channel/storefronts',
    )
    return result.body.storefronts
  }

  async storefront(slug: string): Promise<StorefrontDetail> {
    const result = await this.http.request<StorefrontDetail>(
      'GET',
      `/api/v1/channel/storefronts/${slug}`,
    )
    return result.body
  }

  async quote(input: {
    businessId: string
    items: { itemId: string; quantity: number }[]
    delivery?: { address: string; lat?: number; lng?: number }
  }): Promise<Quote> {
    const result = await this.http.request<Quote>('POST', '/api/v1/channel/quotes', input)
    return result.body
  }

  async place(input: {
    businessId: string
    customer: { name: string; phone: string; hatodUserId?: string }
    items: { itemId: string; quantity: number }[]
    delivery?: { address: string; lat?: number; lng?: number }
    scheduledAt?: string
    intake?: Record<string, unknown>
    idempotencyKey: string
  }): Promise<PlacedOrder> {
    const result = await this.http.request<PlacedOrder>('POST', '/api/v1/channel/orders', input)
    return result.body
  }

  async status(orderId: string, businessId: string): Promise<OrderStatus> {
    const result = await this.http.request<OrderStatus>(
      'GET',
      `/api/v1/channel/orders/${orderId}?businessId=${encodeURIComponent(businessId)}`,
    )
    return result.body
  }

  async cancel(orderId: string, businessId: string): Promise<{ order: { status: string } }> {
    const result = await this.http.request<{ order: { status: string } }>(
      'POST',
      `/api/v1/channel/orders/${orderId}/cancel`,
      { businessId },
    )
    return result.body
  }
}
