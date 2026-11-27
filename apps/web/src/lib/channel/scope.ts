import { getStorefrontById } from '@iskina/db'
import { apiError } from '@/lib/api'
import type { ChannelAuth } from '@/lib/auth/channel'

export interface ChannelScope {
  tenantId: string
  businessId: string
}

/**
 * Resolves the tenant a channel request may act on. Business keys keep their
 * scope; the platform key must name an active storefront.
 */
export async function resolveChannelScope(
  auth: ChannelAuth,
  requestedBusinessId?: string | null,
): Promise<ChannelScope | Response> {
  if (auth.kind === 'platform') {
    if (!requestedBusinessId) {
      return apiError(400, 'business_required', 'businessId is required')
    }
    const storefront = await getStorefrontById(requestedBusinessId)
    if (!storefront) return apiError(404, 'not_found', 'Storefront not found')
    return { tenantId: storefront.tenantId, businessId: storefront.id }
  }

  if (auth.businessId && requestedBusinessId && auth.businessId !== requestedBusinessId) {
    return apiError(403, 'forbidden', 'This key is scoped to a different business')
  }

  const businessId = auth.businessId ?? requestedBusinessId
  if (!businessId) {
    return apiError(400, 'business_required', 'businessId is required for tenant-wide keys')
  }

  return { tenantId: auth.tenantId, businessId }
}
