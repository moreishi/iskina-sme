import { markCashReceived, recordAudit } from '@iskina/db'
import { apiError, apiJson, clientIp, readJson, userAgent } from '@/lib/api'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'
import { merchantCashSchema } from '@/lib/orders/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const parsed = merchantCashSchema.safeParse(await readJson(request))
  if (!parsed.success) return apiError(400, 'invalid_request', 'Invalid request')

  const membership = businessMembership(session, parsed.data.businessId, [
    'owner',
    'manager',
    'staff',
  ])
  if (!membership) return apiError(403, 'forbidden', 'You do not have access to this business')

  const { id } = await context.params
  const order = await markCashReceived(membership.tenantId, parsed.data.businessId, id)
  if (!order) {
    return apiError(409, 'not_payable', 'Only a delivered or completed order takes cash')
  }

  await recordAudit({
    tenantId: membership.tenantId,
    actorType: 'user',
    actorId: session.user.id,
    action: 'order.cash_received',
    entityType: 'order',
    entityId: id,
    metadata: { totalCentavos: order.totalCentavos },
    ip: clientIp(request),
    userAgent: userAgent(request),
  })

  return apiJson({ order })
}
