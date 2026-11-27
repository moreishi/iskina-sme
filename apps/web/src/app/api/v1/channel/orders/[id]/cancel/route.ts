import { canTransition } from '@iskina/core'
import { applyTransition, getOrderById, recordAudit } from '@iskina/db'
import { apiError, apiJson, clientIp, readJson, userAgent } from '@/lib/api'
import { authenticateChannel, isResponse } from '@/lib/auth/channel'
import { resolveChannelScope } from '@/lib/channel/scope'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticateChannel(request, 'orders:write')
  if (isResponse(auth)) return auth

  const body = (await readJson(request)) ?? {}
  const requestedBusinessId =
    typeof body.businessId === 'string' ? body.businessId : auth.businessId
  const scope = await resolveChannelScope(auth, requestedBusinessId)
  if (isResponse(scope)) return scope

  const { id } = await context.params
  const current = await getOrderById(scope.tenantId, scope.businessId, id)
  if (!current) return apiError(404, 'not_found', 'Order not found')

  if (
    !canTransition({
      vertical: current.order.vertical,
      from: current.order.status,
      to: 'CANCELLED',
      actor: 'customer',
    })
  ) {
    return apiError(
      409,
      'not_cancellable',
      `${current.order.status} can no longer be cancelled by the customer`,
    )
  }

  const updated = await applyTransition({
    tenantId: scope.tenantId,
    businessId: scope.businessId,
    orderId: id,
    from: current.order.status,
    to: 'CANCELLED',
    actorType: 'customer',
    actorId: auth.keyId,
    note: 'Cancelled from the HATOD channel',
  })
  if (!updated) return apiError(409, 'stale_order', 'The order moved before the cancellation')

  await recordAudit({
    tenantId: scope.tenantId,
    actorType: 'api_key',
    actorId: auth.keyId,
    action: 'order.cancelled',
    entityType: 'order',
    entityId: id,
    metadata: { from: current.order.status, channel: 'hatod' },
    ip: clientIp(request),
    userAgent: userAgent(request),
  })

  return apiJson({ order: updated })
}
