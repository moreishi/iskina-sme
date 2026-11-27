import { buildThemeManifest, validateThemeManifest } from '@iskina/core'
import { getBusinessForTenant, publishTheme, recordAudit } from '@iskina/db'
import { apiError, apiJson, clientIp, readJson, userAgent } from '@/lib/api'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'
import { publishThemeSchema } from '@/lib/theme/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const parsed = publishThemeSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return apiError(400, 'invalid_request', parsed.error.issues[0]?.message ?? 'Invalid theme')
  }

  const membership = businessMembership(session, parsed.data.businessId)
  if (!membership) return apiError(403, 'forbidden', 'Only an owner or manager can publish a theme')

  const business = await getBusinessForTenant(membership.tenantId, parsed.data.businessId)
  if (!business) return apiError(404, 'not_found', 'Business not found')

  let manifest: ReturnType<typeof buildThemeManifest>
  try {
    manifest = buildThemeManifest(
      {
        presetId: parsed.data.presetId,
        layout: parsed.data.layout,
        light: parsed.data.light,
        dark: parsed.data.dark,
        assets: parsed.data.assets,
      },
      1,
    )
  } catch (error) {
    return apiError(400, 'invalid_theme', error instanceof Error ? error.message : 'Invalid theme')
  }

  const validation = validateThemeManifest(manifest)
  if (!validation.ok) {
    return apiJson(
      { error: { code: 'contrast', message: 'Theme fails contrast', issues: validation.issues } },
      400,
    )
  }

  const saved = await publishTheme({
    tenantId: membership.tenantId,
    businessId: parsed.data.businessId,
    manifest,
    publishedBy: session.user.id,
  })

  await recordAudit({
    tenantId: membership.tenantId,
    actorType: 'user',
    actorId: session.user.id,
    action: 'theme.published',
    entityType: 'theme_version',
    entityId: saved.id,
    metadata: { businessId: parsed.data.businessId, version: saved.version },
    ip: clientIp(request),
    userAgent: userAgent(request),
  })

  return apiJson(
    {
      theme: {
        version: saved.version,
        manifest: saved.manifest,
        publishedAt: saved.publishedAt,
      },
    },
    201,
  )
}
