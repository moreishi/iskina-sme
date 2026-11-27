import { z } from 'zod'
import { fulfillmentKindSchema } from './verticals'

export const intakeFieldSchema = z.enum([
  'address',
  'notes',
  'scheduledAt',
  'unitCount',
  'unitType',
  'tankSize',
  'refillType',
])

export const verticalConfigSchema = z.strictObject({
  fulfillment: fulfillmentKindSchema,
  orderFlow: z.enum(['food_delivery', 'service_booking', 'lpg_delivery']),
  requiresSchedule: z.boolean(),
  intakeFields: z.array(intakeFieldSchema),
  minOrderCentavos: z.number().int().nonnegative(),
  deliveryFeeCentavos: z.number().int().nonnegative(),
  deliveryFeePerKmCentavos: z.number().int().nonnegative(),
  maxDeliveryKm: z.number().nonnegative(),
  prepMinutes: z.number().int().nonnegative(),
  slotMinutes: z.number().int().positive().nullable(),
})

export type IntakeField = z.infer<typeof intakeFieldSchema>
export type VerticalConfig = z.infer<typeof verticalConfigSchema>
