import { z } from 'zod'

const status = z.enum([
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
])

export const channelQuoteSchema = z.object({
  businessId: z.uuid().optional(),
  items: z
    .array(
      z.object({
        itemId: z.uuid(),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1)
    .max(50),
  delivery: z
    .object({
      address: z.string().trim().min(3).max(200),
      lat: z.number().min(-90).max(90).nullable().optional(),
      lng: z.number().min(-180).max(180).nullable().optional(),
    })
    .nullable()
    .optional(),
  scheduledAt: z.iso.datetime().nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  intake: z.record(z.string(), z.unknown()).optional(),
  idempotencyKey: z.string().trim().min(8).max(100).optional(),
  customer: z
    .object({
      name: z.string().trim().max(80).nullable().optional(),
      phone: z.string().trim().min(7).max(24),
      hatodUserId: z.string().trim().max(100).nullable().optional(),
    })
    .optional(),
})

export const merchantTransitionSchema = z.object({
  businessId: z.uuid(),
  to: status,
  note: z.string().trim().max(200).nullable().optional(),
})

export const merchantCashSchema = z.object({
  businessId: z.uuid(),
})
