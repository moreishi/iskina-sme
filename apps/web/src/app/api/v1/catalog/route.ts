import { mergeVerticalConfig } from '@iskina/core'
import { getBusinessForTenant, getCatalog } from '@iskina/db'
import { apiError, apiJson } from '@/lib/api'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const businessId = new URL(request.url).searchParams.get('businessId')
  if (!businessId) return apiError(400, 'invalid_request', 'businessId is required')

  const membership = businessMembership(session, businessId, ['owner', 'manager', 'staff'])
  if (!membership) return apiError(403, 'forbidden', 'You do not have access to this business')

  const business = await getBusinessForTenant(membership.tenantId, businessId)
  if (!business) return apiError(404, 'not_found', 'Business not found')

  const catalog = await getCatalog(membership.tenantId, businessId)
  const config = mergeVerticalConfig(business.vertical, business.verticalConfig)

  return apiJson({
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      vertical: business.vertical,
      status: business.status,
      timezone: business.timezone,
    },
    config,
    ...catalog,
  })
}
