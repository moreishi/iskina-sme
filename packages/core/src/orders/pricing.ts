import type { VerticalConfig } from '@iskina/contracts'

export interface QuoteLine {
  unitPriceCentavos: number
  quantity: number
}

export interface Quote {
  subtotalCentavos: number
  deliveryFeeCentavos: number
  totalCentavos: number
  meetsMinOrder: boolean
}

/**
 * Server-side only. The client never supplies a total.
 * Delivery distance is straight-line km until routing is wired in.
 */
export function quoteOrder(input: {
  lines: readonly QuoteLine[]
  config: VerticalConfig
  distanceKm?: number
}): Quote {
  if (input.lines.length === 0) {
    throw new Error('An order needs at least one line')
  }

  let subtotalCentavos = 0
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error('Quantity must be a positive integer')
    }
    if (!Number.isInteger(line.unitPriceCentavos) || line.unitPriceCentavos < 0) {
      throw new Error('Unit price must be a non-negative integer of centavos')
    }
    subtotalCentavos += line.unitPriceCentavos * line.quantity
  }

  const distance = Math.max(0, input.distanceKm ?? 0)
  const deliveryFeeCentavos =
    input.config.fulfillment === 'booking'
      ? 0
      : Math.round(
          input.config.deliveryFeeCentavos + input.config.deliveryFeePerKmCentavos * distance,
        )

  return {
    subtotalCentavos,
    deliveryFeeCentavos,
    totalCentavos: subtotalCentavos + deliveryFeeCentavos,
    meetsMinOrder: subtotalCentavos >= input.config.minOrderCentavos,
  }
}

export interface Point {
  lat: number
  lng: number
}

const EARTH_RADIUS_KM = 6371

export function haversineKm(a: Point, b: Point): number {
  const rad = (value: number) => (value * Math.PI) / 180
  const dLat = rad(b.lat - a.lat)
  const dLng = rad(b.lng - a.lng)
  const lat1 = rad(a.lat)
  const lat2 = rad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)))
}
