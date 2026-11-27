import { describe, expect, it } from 'vitest'
import { defaultVerticalConfig, mergeVerticalConfig } from '../src/catalog'

describe('vertical config', () => {
  it('gives food a delivery flow with a fee', () => {
    const config = defaultVerticalConfig('food')
    expect(config.fulfillment).toBe('delivery')
    expect(config.requiresSchedule).toBe(false)
    expect(config.deliveryFeeCentavos).toBeGreaterThan(0)
  })

  it('gives aircon a scheduled booking flow', () => {
    const config = defaultVerticalConfig('aircon')
    expect(config.fulfillment).toBe('booking')
    expect(config.requiresSchedule).toBe(true)
    expect(config.slotMinutes).toBe(60)
    expect(config.intakeFields).toContain('scheduledAt')
  })

  it('keeps the LPG intake fields', () => {
    expect(defaultVerticalConfig('lpg').intakeFields).toEqual([
      'tankSize',
      'refillType',
      'address',
      'notes',
    ])
  })

  it('merges a valid override onto the preset', () => {
    const config = mergeVerticalConfig('food', { prepMinutes: 35, minOrderCentavos: 15_000 })
    expect(config.prepMinutes).toBe(35)
    expect(config.minOrderCentavos).toBe(15_000)
    expect(config.orderFlow).toBe('food_delivery')
  })

  it('rejects an invalid override instead of silently dropping it', () => {
    expect(() => mergeVerticalConfig('food', { prepMinutes: -5 })).toThrow(
      /Invalid vertical config/,
    )
    expect(() => mergeVerticalConfig('food', { fulfillment: 'magic' })).toThrow(
      /Invalid vertical config/,
    )
  })

  it('returns a fresh object so callers cannot mutate the preset', () => {
    const first = defaultVerticalConfig('food')
    first.intakeFields.push('notes')
    expect(defaultVerticalConfig('food').intakeFields).toEqual(['address', 'notes'])
  })
})
