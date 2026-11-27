import { describe, expect, it } from 'vitest'
import { defaultVerticalConfig } from '../src/catalog'
import { haversineKm, quoteOrder } from '../src/orders/pricing'

const food = defaultVerticalConfig('food')
const booking = defaultVerticalConfig('aircon')

describe('quoteOrder', () => {
  it('sums lines and adds the delivery fee', () => {
    const quote = quoteOrder({
      lines: [
        { unitPriceCentavos: 12_000, quantity: 2 },
        { unitPriceCentavos: 4_500, quantity: 1 },
      ],
      config: food,
      distanceKm: 2,
    })
    expect(quote.subtotalCentavos).toBe(28_500)
    // 3,900 base + 1,500 × 2 km
    expect(quote.deliveryFeeCentavos).toBe(6_900)
    expect(quote.totalCentavos).toBe(35_400)
    expect(quote.meetsMinOrder).toBe(true)
  })

  it('never charges delivery on a booking', () => {
    const quote = quoteOrder({
      lines: [{ unitPriceCentavos: 80_000, quantity: 1 }],
      config: booking,
      distanceKm: 12,
    })
    expect(quote.deliveryFeeCentavos).toBe(0)
    expect(quote.totalCentavos).toBe(80_000)
  })

  it('flags a cart under the minimum order', () => {
    const config = { ...food, minOrderCentavos: 20_000 }
    const quote = quoteOrder({
      lines: [{ unitPriceCentavos: 5_000, quantity: 1 }],
      config,
    })
    expect(quote.meetsMinOrder).toBe(false)
  })

  it('rejects empty carts and bad quantities', () => {
    expect(() => quoteOrder({ lines: [], config: food })).toThrow(/at least one line/)
    expect(() =>
      quoteOrder({ lines: [{ unitPriceCentavos: 100, quantity: 0 }], config: food }),
    ).toThrow(/positive integer/)
    expect(() =>
      quoteOrder({ lines: [{ unitPriceCentavos: 10.5, quantity: 1 }], config: food }),
    ).toThrow(/integer/)
  })
})

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm({ lat: 10.3, lng: 123.9 }, { lat: 10.3, lng: 123.9 })).toBe(0)
  })

  it('matches a known Cebu distance within tolerance', () => {
    // IT Park to SM City Cebu, roughly 4.5 km straight line.
    const km = haversineKm({ lat: 10.329, lng: 123.906 }, { lat: 10.311, lng: 123.918 })
    expect(km).toBeGreaterThan(2)
    expect(km).toBeLessThan(4)
  })
})
