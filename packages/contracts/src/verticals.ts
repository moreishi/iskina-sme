import { z } from 'zod'

/** Verticals are config-driven; adding one must not fork the schema. */
export const verticalSchema = z.enum(['food', 'aircon', 'lpg'])
export const fulfillmentKindSchema = z.enum(['delivery', 'booking'])

export const VERTICALS = verticalSchema.options
export type Vertical = z.infer<typeof verticalSchema>
export type FulfillmentKind = z.infer<typeof fulfillmentKindSchema>

export const VERTICAL_FULFILLMENT: Record<Vertical, FulfillmentKind> = {
  food: 'delivery',
  aircon: 'booking',
  lpg: 'delivery',
}

export const VERTICAL_LABELS: Record<Vertical, string> = {
  food: 'Food delivery',
  aircon: 'Aircon cleaning',
  lpg: 'LPG refill',
}
