import { dayRange, percentChange } from '@iskina/core'
import { analyticsBucket, getBusinessForTenant } from '@iskina/db'
import { apiError, apiJson } from '@/lib/api'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const url = new URL(request.url)
  const businessId = url.searchParams.get('businessId')
  if (!businessId) return apiError(400, 'invalid_request', 'businessId is required')

  const membership = businessMembership(session, businessId, ['owner', 'manager', 'staff'])
  if (!membership) return apiError(403, 'forbidden', 'You do not have access to this business')

  const business = await getBusinessForTenant(membership.tenantId, businessId)
  if (!business) return apiError(404, 'not_found', 'Business not found')

  const requested = Number(url.searchParams.get('days') ?? 7)
  const range = dayRange(Number.isFinite(requested) ? requested : 7, new Date(), business.timezone)

  const current = await analyticsBucket({
    tenantId: membership.tenantId,
    businessId,
    timeZone: business.timezone,
    from: range.from,
    to: range.to,
  })
  const previous = await analyticsBucket({
    tenantId: membership.tenantId,
    businessId,
    timeZone: business.timezone,
    from: range.previousFrom,
    to: range.previousTo,
  })

  return apiJson({
    business: {
      id: business.id,
      name: business.name,
      timezone: business.timezone,
    },
    range,
    totals: {
      ...current.totals,
      deltas: {
        gmv: percentChange(current.totals.gmvCentavos, previous.totals.gmvCentavos),
        orders: percentChange(current.totals.ordersPlaced, previous.totals.ordersPlaced),
        aov: percentChange(current.totals.aovCentavos, previous.totals.aovCentavos),
        netSales: percentChange(current.totals.netSalesCentavos, previous.totals.netSalesCentavos),
      },
    },
    previousTotals: previous.totals,
    series: current.series,
    topItems: current.topItems,
    hours: current.hours,
  })
}
