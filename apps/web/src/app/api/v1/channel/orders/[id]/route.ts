import { getOrderById } from '@iskina/db'
import { apiError, apiJson } from '@/lib/api'
import { authenticateChannel, isResponse } from '@/lib/auth/channel'
import { resolveChannelScope } from '@/lib/channel/scope'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await authenticateChannel(request, 'orders:read')
  if (isResponse(auth)) return auth

  const url = new URL(request.url)
  const scope = await resolveChannelScope(
    auth,
    url.searchParams.get('businessId') ?? auth.businessId,
  )
  if (isResponse(scope)) return scope

  const { id } = await context.params
  const full = await getOrderById(scope.tenantId, scope.businessId, id)
  if (!full) return apiError(404, 'not_found', 'Order not found')

  return apiJson({
    order: {
      id: full.order.id,
      number: full.order.number,
      status: full.order.status,
      kind: full.order.kind,
      vertical: full.order.vertical,
      subtotalCentavos: full.order.subtotalCentavos,
      deliveryFeeCentavos: full.order.deliveryFeeCentavos,
      totalCentavos: full.order.totalCentavos,
      address: full.order.address,
      scheduledAt: full.order.scheduledAt,
      cashReceivedAt: full.order.cashReceivedAt,
      placedAt: full.order.placedAt,
      completedAt: full.order.completedAt,
    },
    lines: full.lines.map((line) => ({
      name: line.name,
      quantity: line.quantity,
      unitPriceCentavos: line.unitPriceCentavos,
      lineTotalCentavos: line.lineTotalCentavos,
    })),
    events: full.events.map((event) => ({
      toStatus: event.toStatus,
      actorType: event.actorType,
      createdAt: event.createdAt,
    })),
  })
}
