import { CategoryNotFoundError, deleteItem, recordAudit, updateItem } from '@iskina/db'
import { apiError, apiJson, clientIp, readJson, userAgent } from '@/lib/api'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'
import { itemUpdateSchema } from '@/lib/catalog/validation'

export const dynamic = 'force-dynamic'

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const parsed = itemUpdateSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return apiError(400, 'invalid_request', parsed.error.issues[0]?.message ?? 'Invalid item')
  }

  const membership = businessMembership(session, parsed.data.businessId)
  if (!membership) return apiError(403, 'forbidden', 'Only an owner or manager can edit the menu')

  const { id } = await context.params
  try {
    const item = await updateItem({
      tenantId: membership.tenantId,
      businessId: parsed.data.businessId,
      id,
      categoryId: parsed.data.categoryId,
      name: parsed.data.name,
      description: parsed.data.description,
      priceCentavos: parsed.data.priceCentavos,
      unit: parsed.data.unit,
      available: parsed.data.available,
      stockCount: parsed.data.stockCount,
      metadata: parsed.data.metadata,
    })
    if (!item) return apiError(404, 'not_found', 'Item not found')

    await recordAudit({
      tenantId: membership.tenantId,
      actorType: 'user',
      actorId: session.user.id,
      action: 'catalog.item_updated',
      entityType: 'catalog_item',
      entityId: item.id,
      ip: clientIp(request),
      userAgent: userAgent(request),
    })

    return apiJson({ item })
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return apiError(400, 'invalid_category', error.message)
    }
    throw error
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const businessId = new URL(request.url).searchParams.get('businessId')
  if (!businessId) return apiError(400, 'invalid_request', 'businessId is required')

  const membership = businessMembership(session, businessId)
  if (!membership) return apiError(403, 'forbidden', 'Only an owner or manager can edit the menu')

  const { id } = await context.params
  const removed = await deleteItem(membership.tenantId, businessId, id)
  if (!removed) return apiError(404, 'not_found', 'Item not found')

  await recordAudit({
    tenantId: membership.tenantId,
    actorType: 'user',
    actorId: session.user.id,
    action: 'catalog.item_deleted',
    entityType: 'catalog_item',
    entityId: id,
    ip: clientIp(request),
    userAgent: userAgent(request),
  })

  return apiJson({ ok: true })
}
