import { type Vertical, type VerticalConfig, verticalConfigSchema } from '@iskina/contracts'

const DEFAULTS: Record<Vertical, VerticalConfig> = {
  food: {
    fulfillment: 'delivery',
    orderFlow: 'food_delivery',
    requiresSchedule: false,
    intakeFields: ['address', 'notes'],
    minOrderCentavos: 0,
    deliveryFeeCentavos: 3_900,
    deliveryFeePerKmCentavos: 1_500,
    maxDeliveryKm: 10,
    prepMinutes: 20,
    slotMinutes: null,
  },
  aircon: {
    fulfillment: 'booking',
    orderFlow: 'service_booking',
    requiresSchedule: true,
    intakeFields: ['unitCount', 'unitType', 'scheduledAt', 'address', 'notes'],
    minOrderCentavos: 0,
    deliveryFeeCentavos: 0,
    deliveryFeePerKmCentavos: 0,
    maxDeliveryKm: 0,
    prepMinutes: 0,
    slotMinutes: 60,
  },
  lpg: {
    fulfillment: 'delivery',
    orderFlow: 'lpg_delivery',
    requiresSchedule: false,
    intakeFields: ['tankSize', 'refillType', 'address', 'notes'],
    minOrderCentavos: 0,
    deliveryFeeCentavos: 2_900,
    deliveryFeePerKmCentavos: 1_000,
    maxDeliveryKm: 12,
    prepMinutes: 10,
    slotMinutes: null,
  },
}

export function defaultVerticalConfig(vertical: Vertical): VerticalConfig {
  return { ...DEFAULTS[vertical], intakeFields: [...DEFAULTS[vertical].intakeFields] }
}

/**
 * Stored overrides are partial and must still validate after merging. An
 * invalid override is a bug, not something to silently drop.
 */
export function mergeVerticalConfig(vertical: Vertical, override: unknown): VerticalConfig {
  if (override === null || override === undefined) return defaultVerticalConfig(vertical)
  const parsed = verticalConfigSchema.partial().safeParse(override)
  if (!parsed.success) {
    throw new Error(`Invalid vertical config override: ${parsed.error.message}`)
  }
  return verticalConfigSchema.parse({
    ...defaultVerticalConfig(vertical),
    ...parsed.data,
  })
}
