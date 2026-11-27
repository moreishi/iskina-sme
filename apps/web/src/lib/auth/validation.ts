import { API_KEY_SCOPES } from '@iskina/core/auth'
import { z } from 'zod'

export const otpRequestSchema = z.object({
  phone: z.string().trim().min(7).max(24),
})

export const otpVerifySchema = z.object({
  challengeId: z.uuid(),
  code: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  client: z.enum(['mobile']).optional(),
})

export const onboardingSchema = z.object({
  businessName: z.string().trim().min(2).max(80),
  slug: z.string().trim().max(40).optional(),
  vertical: z.enum(['food', 'aircon', 'lpg']),
  timezone: z.string().trim().max(64).optional(),
})

export const apiKeyCreateSchema = z.object({
  tenantId: z.uuid().optional(),
  name: z.string().trim().min(2).max(40),
  env: z.enum(['test', 'live']).default('test'),
  scopes: z.array(z.enum(API_KEY_SCOPES)).min(1).optional(),
})

export const apiKeyRevokeSchema = z.object({
  tenantId: z.uuid().optional(),
})
