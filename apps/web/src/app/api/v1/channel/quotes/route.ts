import { apiError, apiJson, readJson } from '@/lib/api'
import { authenticateChannel, isResponse } from '@/lib/auth/channel'
import { priceChannelOrder } from '@/lib/orders/channel'
import { channelQuoteSchema } from '@/lib/orders/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const auth = await authenticateChannel(request, 'catalog:read')
  if (isResponse(auth)) return auth

  const parsed = channelQuoteSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return apiError(400, 'invalid_request', parsed.error.issues[0]?.message ?? 'Invalid cart')
  }

  const priced = await priceChannelOrder({
    auth,
    businessId: parsed.data.businessId,
    items: parsed.data.items,
    delivery: parsed.data.delivery,
  })
  if (priced instanceof Response) return priced

  return apiJson({
    businessId: priced.businessId,
    subtotalCentavos: priced.subtotalCentavos,
    deliveryFeeCentavos: priced.deliveryFeeCentavos,
    totalCentavos: priced.totalCentavos,
    currency: 'PHP',
    meetsMinOrder: priced.meetsMinOrder,
    distanceKm: Number(priced.distanceKm.toFixed(2)),
    lines: priced.lines,
  })
}
