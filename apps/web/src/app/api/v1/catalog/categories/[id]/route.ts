import { deleteCategory, recordAudit, updateCategory } from '@iskina/db'
import { apiError, apiJson, clientIp, readJson, userAgent } from '@/lib/api'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'
import { categoryUpdateSchema } from '@/lib/catalog/validation'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const parsed = categoryUpdateSchema.safeParse(await readJson(request))
  if (!parsed.success) return apiError(400, 'invalid_request', 'Invalid category update')

  const membership = businessMembership(session, parsed.data.businessId)
  if (!membership) return apiError(403, 'forbidden', 'Only an owner or manager can edit the menu')

  const { id } = await context.params
  const category = await updateCategory({
    tenantId: membership.tenantId,
    businessId: parsed.data.businessId,
    id,
    name: parsed.data.name,
    sortOrder: parsed.data.sortOrder,
    active: parsed.data.active,
  })
  if (!category) return apiError(404, 'not_found', 'Category not found')

  await recordAudit({
    tenantId: membership.tenantId,
    actorType: 'user',
    actorId: session.user.id,
    action: 'catalog.category_updated',
    entityType: 'catalog_category',
    entityId: category.id,
    ip: clientIp(request),
    userAgent: userAgent(request),
  })

  return apiJson({ category })
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const businessId = new URL(request.url).searchParams.get('businessId')
  if (!businessId) return apiError(400, 'invalid_request', 'businessId is required')

  const membership = businessMembership(session, businessId)
  if (!membership) return apiError(403, 'forbidden', 'Only an owner or manager can edit the menu')

  const { id } = await context.params
  const removed = await deleteCategory(membership.tenantId, businessId, id)
  if (!removed) return apiError(404, 'not_found', 'Category not found')

  return apiJson({ ok: true })
}
