import { canTransition } from '@iskina/core'
import { applyTransition, getOrderById, recordAudit } from '@iskina/db'
import { apiError, apiJson, clientIp, readJson, userAgent } from '@/lib/api'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'
import { merchantTransitionSchema } from '@/lib/orders/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const parsed = merchantTransitionSchema.safeParse(await readJson(request))
  if (!parsed.success) return apiError(400, 'invalid_request', 'Invalid transition')

  const membership = businessMembership(session, parsed.data.businessId, [
    'owner',
    'manager',
    'staff',
  ])
  if (!membership) return apiError(403, 'forbidden', 'You do not have access to this business')

  const { id } = await context.params
  const current = await getOrderById(membership.tenantId, parsed.data.businessId, id)
  if (!current) return apiError(404, 'not_found', 'Order not found')

  if (
    !canTransition({
      vertical: current.order.vertical,
      from: current.order.status,
      to: parsed.data.to,
      actor: 'merchant',
    })
  ) {
    return apiError(
      409,
      'invalid_transition',
      `${current.order.status} cannot move to ${parsed.data.to}`,
    )
  }

  const updated = await applyTransition({
    tenantId: membership.tenantId,
    businessId: parsed.data.businessId,
    orderId: id,
    from: current.order.status,
    to: parsed.data.to,
    actorType: 'merchant',
    actorId: session.user.id,
    note: parsed.data.note ?? null,
  })
  if (!updated) {
    return apiError(409, 'stale_order', 'Another device already moved this order')
  }

  await recordAudit({
    tenantId: membership.tenantId,
    actorType: 'user',
    actorId: session.user.id,
    action: 'order.transitioned',
    entityType: 'order',
    entityId: id,
    metadata: { from: current.order.status, to: parsed.data.to },
    ip: clientIp(request),
    userAgent: userAgent(request),
  })

  return apiJson({ order: updated })
}
