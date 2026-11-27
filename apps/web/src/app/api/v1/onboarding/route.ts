import { isReservedSlug, isValidSlug, normalizeSlug } from '@iskina/core/auth'
import { createTenantWithOwner } from '@iskina/db'
import { apiError, apiJson, clientIp, readJson, userAgent } from '@/lib/api'
import { currentSession } from '@/lib/auth/session'
import { onboardingSchema } from '@/lib/auth/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const body = await readJson(request)
  const parsed = onboardingSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'invalid_request', 'Business name and vertical are required')
  }

  const slug = normalizeSlug(parsed.data.slug || parsed.data.businessName)
  if (!isValidSlug(slug)) {
    return apiError(400, 'invalid_slug', 'Use 3–40 lowercase letters, numbers or hyphens')
  }
  if (isReservedSlug(slug)) {
    return apiError(409, 'reserved_slug', 'That storefront address is reserved')
  }

  try {
    const { tenant, business } = await createTenantWithOwner({
      userId: session.user.id,
      businessName: parsed.data.businessName,
      slug,
      vertical: parsed.data.vertical,
      timezone: parsed.data.timezone,
      ip: clientIp(request),
      userAgent: userAgent(request),
    })

    return apiJson(
      {
        tenant: { id: tenant.id, name: tenant.name, slug: tenant.slug },
        business: {
          id: business.id,
          name: business.name,
          slug: business.slug,
          vertical: business.vertical,
          status: business.status,
        },
      },
      201,
    )
  } catch (error) {
    if (isUniqueViolation(error)) {
      return apiError(409, 'slug_taken', 'That storefront address is already taken')
    }
    throw error
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === '23505'
  )
}
