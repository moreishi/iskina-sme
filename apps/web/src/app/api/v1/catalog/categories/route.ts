import { createCategory, recordAudit } from '@iskina/db'
import { apiError, apiJson, clientIp, readJson, userAgent } from '@/lib/api'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'
import { categoryCreateSchema } from '@/lib/catalog/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const parsed = categoryCreateSchema.safeParse(await readJson(request))
  if (!parsed.success) return apiError(400, 'invalid_request', 'A category name is required')

  const membership = businessMembership(session, parsed.data.businessId)
  if (!membership) return apiError(403, 'forbidden', 'Only an owner or manager can edit the menu')

  try {
    const category = await createCategory({
      tenantId: membership.tenantId,
      businessId: parsed.data.businessId,
      name: parsed.data.name,
      sortOrder: parsed.data.sortOrder,
    })

    await recordAudit({
      tenantId: membership.tenantId,
      actorType: 'user',
      actorId: session.user.id,
      action: 'catalog.category_created',
      entityType: 'catalog_category',
      entityId: category.id,
      metadata: { businessId: parsed.data.businessId, name: category.name },
      ip: clientIp(request),
      userAgent: userAgent(request),
    })

    return apiJson({ category }, 201)
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === '23505') {
      return apiError(409, 'category_exists', 'That category already exists')
    }
    throw error
  }
}
