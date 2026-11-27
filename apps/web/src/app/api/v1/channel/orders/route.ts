import { orderKindFor } from '@iskina/core'
import { createOrder, findOrderByIdempotencyKey, getOrderById, recordAudit } from '@iskina/db'
import { apiError, apiJson, clientIp, readJson, userAgent } from '@/lib/api'
import { authenticateChannel, isResponse } from '@/lib/auth/channel'
import { resolveChannelScope } from '@/lib/channel/scope'
import { priceChannelOrder } from '@/lib/orders/channel'
import { makeOrderNumber } from '@/lib/orders/number'
import { channelQuoteSchema } from '@/lib/orders/validation'
import { notifyBusiness } from '@/lib/push'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await authenticateChannel(request, 'orders:write')
  if (isResponse(auth)) return auth

  const parsed = channelQuoteSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return apiError(400, 'invalid_request', parsed.error.issues[0]?.message ?? 'Invalid order')
  }
  if (!parsed.data.customer) {
    return apiError(400, 'invalid_customer', 'A customer phone is required')
  }

  const scope = await resolveChannelScope(auth, parsed.data.businessId)
  if (isResponse(scope)) return scope

  if (parsed.data.idempotencyKey) {
    const existing = await findOrderByIdempotencyKey(
      scope.tenantId,
      scope.businessId,
      parsed.data.idempotencyKey,
    )
    if (existing) return apiJson({ order: existing.order, lines: existing.lines }, 200)
  }

  const priced = await priceChannelOrder({
    tenantId: scope.tenantId,
    businessId: scope.businessId,
    items: parsed.data.items,
    delivery: parsed.data.delivery,
  })
  if (priced instanceof Response) return priced

  if (!priced.meetsMinOrder) {
    return apiError(400, 'min_order', 'The cart is below the minimum order')
  }
  if (priced.config.requiresSchedule && !parsed.data.scheduledAt) {
    return apiError(400, 'schedule_required', 'This business needs a scheduled time')
  }
  if (priced.config.fulfillment === 'delivery' && !parsed.data.delivery?.address) {
    return apiError(400, 'address_required', 'A delivery address is required')
  }

  const scheduledAt = parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : null
  if (scheduledAt && Number.isNaN(scheduledAt.getTime())) {
    return apiError(400, 'invalid_schedule', 'Invalid scheduled time')
  }

  const created = await createOrder({
    tenantId: scope.tenantId,
    businessId: scope.businessId,
    customer: {
      name: parsed.data.customer.name ?? null,
      phone: parsed.data.customer.phone,
      hatodUserId: parsed.data.customer.hatodUserId ?? null,
    },
    number: makeOrderNumber(),
    vertical: priced.vertical,
    kind: orderKindFor(priced.vertical),
    channel: 'hatod',
    subtotalCentavos: priced.subtotalCentavos,
    deliveryFeeCentavos: priced.deliveryFeeCentavos,
    totalCentavos: priced.totalCentavos,
    contactName: parsed.data.customer.name ?? null,
    contactPhone: parsed.data.customer.phone,
    address: parsed.data.delivery?.address ?? null,
    lat: parsed.data.delivery?.lat ?? null,
    lng: parsed.data.delivery?.lng ?? null,
    scheduledAt,
    notes: parsed.data.notes ?? null,
    intake: parsed.data.intake ?? {},
    idempotencyKey: parsed.data.idempotencyKey ?? null,
    lines: priced.lines.map((line) => ({
      itemId: line.itemId,
      name: line.name,
      unitPriceCentavos: line.unitPriceCentavos,
      quantity: line.quantity,
    })),
  })

  const full = await getOrderById(scope.tenantId, scope.businessId, created.order.id)

  await notifyBusiness(
    { tenantId: scope.tenantId, businessId: scope.businessId },
    {
      title: 'New order',
      body: `${created.order.number} · PHP ${(created.order.totalCentavos / 100).toFixed(2)}`,
      data: { orderId: created.order.id, status: created.order.status },
    },
  ).catch(() => undefined)

  await recordAudit({
    tenantId: scope.tenantId,
    actorType: 'api_key',
    actorId: auth.keyId,
    action: 'order.placed',
    entityType: 'order',
    entityId: created.order.id,
    metadata: {
      businessId: scope.businessId,
      channel: 'hatod',
      totalCentavos: created.order.totalCentavos,
    },
    ip: clientIp(request),
    userAgent: userAgent(request),
  })

  return apiJson(full ?? { order: created.order, lines: created.lines, events: [] }, 201)
}
