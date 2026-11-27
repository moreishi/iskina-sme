import type { VerticalConfig } from '@iskina/contracts'
import { haversineKm, mergeVerticalConfig, quoteOrder } from '@iskina/core'
import { getBusinessForTenant, getItemsByIds } from '@iskina/db'
import { apiError } from '@/lib/api'

export interface PricedLine {
  itemId: string
  name: string
  unitPriceCentavos: number
  quantity: number
}

export interface PricedOrder {
  tenantId: string
  businessId: string
  businessName: string
  businessSlug: string
  vertical: 'food' | 'aircon' | 'lpg'
  timezone: string
  config: VerticalConfig
  lines: PricedLine[]
  subtotalCentavos: number
  deliveryFeeCentavos: number
  totalCentavos: number
  meetsMinOrder: boolean
  distanceKm: number
}

type ItemInput = { itemId: string; quantity: number }
type DeliveryInput =
  | {
      address: string
      lat?: number | null
      lng?: number | null
    }
  | null
  | undefined

export async function priceChannelOrder(input: {
  tenantId: string
  businessId: string
  items: ItemInput[]
  delivery?: DeliveryInput
}): Promise<PricedOrder | Response> {
  const business = await getBusinessForTenant(input.tenantId, input.businessId)
  if (!business) return apiError(404, 'not_found', 'Business not found')
  if (business.status !== 'active') {
    return apiError(409, 'business_inactive', 'This business is not accepting orders')
  }

  const ids = [...new Set(input.items.map((item) => item.itemId))]
  const catalogItems = await getItemsByIds(input.tenantId, input.businessId, ids)
  const byId = new Map(catalogItems.map((item) => [item.id, item]))

  const lines: PricedLine[] = []
  for (const line of input.items) {
    const item = byId.get(line.itemId)
    if (!item) {
      return apiError(400, 'unknown_item', 'An item in the cart is not sold by this business')
    }
    if (!item.available) {
      return apiError(409, 'item_unavailable', `${item.name} is not available right now`)
    }
    lines.push({
      itemId: item.id,
      name: item.name,
      unitPriceCentavos: item.priceCentavos,
      quantity: line.quantity,
    })
  }

  const config = mergeVerticalConfig(business.vertical, business.verticalConfig)
  const distanceKm =
    input.delivery?.lat != null &&
    input.delivery?.lng != null &&
    business.lat != null &&
    business.lng != null
      ? haversineKm(
          { lat: business.lat, lng: business.lng },
          { lat: input.delivery.lat, lng: input.delivery.lng },
        )
      : 0

  const quote = quoteOrder({ lines, config, distanceKm })

  return {
    tenantId: input.tenantId,
    businessId: business.id,
    businessName: business.name,
    businessSlug: business.slug,
    vertical: business.vertical,
    timezone: business.timezone,
    config,
    lines,
    ...quote,
    distanceKm,
  }
}
