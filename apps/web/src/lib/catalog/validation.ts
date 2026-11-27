import { z } from 'zod'

export const catalogUnits = [
  'piece',
  'plate',
  'order',
  'kg',
  'liter',
  'tank',
  'service',
  'hour',
  'sack',
] as const

const money = z.number().int().min(0).max(100_000_000)
const name = z.string().trim().min(1).max(80)
const metadata = z.record(z.string(), z.unknown())

export const categoryCreateSchema = z.object({
  businessId: z.uuid(),
  name,
  sortOrder: z.number().int().min(0).max(10_000).optional(),
})

export const categoryUpdateSchema = z.object({
  businessId: z.uuid(),
  name: name.optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  active: z.boolean().optional(),
})

export const itemCreateSchema = z.object({
  businessId: z.uuid(),
  categoryId: z.uuid().nullable().optional(),
  name,
  description: z.string().trim().max(500).nullable().optional(),
  priceCentavos: money,
  unit: z.enum(catalogUnits).default('piece'),
  available: z.boolean().default(true),
  stockCount: z.number().int().min(0).max(1_000_000).nullable().optional(),
  metadata: metadata.default({}),
})

export const itemUpdateSchema = z.object({
  businessId: z.uuid(),
  categoryId: z.uuid().nullable().optional(),
  name: name.optional(),
  description: z.string().trim().max(500).nullable().optional(),
  priceCentavos: money.optional(),
  unit: z.enum(catalogUnits).optional(),
  available: z.boolean().optional(),
  stockCount: z.number().int().min(0).max(1_000_000).nullable().optional(),
  metadata: metadata.optional(),
})
