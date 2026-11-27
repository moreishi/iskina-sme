import { registerDevice } from '@iskina/db'
import { z } from 'zod'
import { apiError, apiJson, readJson } from '@/lib/api'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  businessId: z.uuid(),
  platform: z.enum(['android', 'ios', 'web']),
  token: z.string().trim().min(10).max(500),
})

export async function POST(request: Request) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const parsed = bodySchema.safeParse(await readJson(request))
  if (!parsed.success) return apiError(400, 'invalid_request', 'Invalid device registration')

  const membership = businessMembership(session, parsed.data.businessId, [
    'owner',
    'manager',
    'staff',
  ])
  if (!membership) return apiError(403, 'forbidden', 'You do not have access to this business')

  const device = await registerDevice({
    tenantId: membership.tenantId,
    businessId: parsed.data.businessId,
    userId: session.user.id,
    platform: parsed.data.platform,
    token: parsed.data.token,
  })

  return apiJson(
    {
      device: {
        id: device.id,
        platform: device.platform,
        lastSeenAt: device.lastSeenAt,
      },
    },
    201,
  )
}
