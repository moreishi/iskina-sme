import { z } from 'zod'

export const serviceName = 'iskina-sme' as const

export const healthResponseSchema = z.object({
  service: z.literal(serviceName),
  version: z.string(),
  status: z.enum(['ok', 'degraded']),
  database: z.enum(['ok', 'error']),
  uptimeSeconds: z.number().nonnegative(),
  checkedAt: z.iso.datetime(),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>
