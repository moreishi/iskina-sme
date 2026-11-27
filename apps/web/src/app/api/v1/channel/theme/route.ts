import { themeManifestSchema } from '@iskina/contracts'
import { buildThemeManifest, DEFAULT_PRESET_ID, validateThemeManifest } from '@iskina/core'
import { getBusinessForTenant, getPublishedTheme } from '@iskina/db'
import { apiError, apiJson } from '@/lib/api'
import { authenticateChannel, isResponse } from '@/lib/auth/channel'

export const dynamic = 'force-dynamic'

/** HATOD reads the published theme; unpublished businesses get the preset. */
export async function GET(request: Request) {
  const auth = await authenticateChannel(request, 'themes:read')
  if (isResponse(auth)) return auth

  if (!auth.businessId) {
    return apiError(400, 'business_scoped_key_required', 'Use a business-scoped key')
  }

  const business = await getBusinessForTenant(auth.tenantId, auth.businessId)
  if (!business) return apiError(404, 'not_found', 'Business not found')

  const published = await getPublishedTheme(auth.tenantId, auth.businessId)
  if (published) {
    const parsed = themeManifestSchema.safeParse(published.manifest)
    if (parsed.success && validateThemeManifest(parsed.data).ok) {
      return apiJson({
        business: {
          id: business.id,
          name: business.name,
          slug: business.slug,
          vertical: business.vertical,
        },
        theme: { ...parsed.data, version: published.version },
        source: 'published',
      })
    }
  }

  const fallback = buildThemeManifest({ presetId: DEFAULT_PRESET_ID }, 1)
  return apiJson({
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      vertical: business.vertical,
    },
    theme: fallback,
    source: 'default',
  })
}
