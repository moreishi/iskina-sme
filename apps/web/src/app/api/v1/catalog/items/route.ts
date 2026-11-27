import { CategoryNotFoundError, createItem, recordAudit } from '@iskina/db'
import { apiError, apiJson, clientIp, readJson, userAgent } from '@/lib/api'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'
import { itemCreateSchema } from '@/lib/catalog/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const parsed = itemCreateSchema.safeParse(await readJson(request))
  if (!parsed.success) {
    return apiError(400, 'invalid_request', parsed.error.issues[0]?.message ?? 'Invalid item')
  }

  const membership = businessMembership(session, parsed.data.businessId)
  if (!membership) return apiError(403, 'forbidden', 'Only an owner or manager can edit the menu')

  try {
    const item = await createItem({
      tenantId: membership.tenantId,
      businessId: parsed.data.businessId,
      categoryId: parsed.data.categoryId ?? null,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      priceCentavos: parsed.data.priceCentavos,
      unit: parsed.data.unit,
      available: parsed.data.available,
      stockCount: parsed.data.stockCount ?? null,
      metadata: parsed.data.metadata,
    })

    await recordAudit({
      tenantId: membership.tenantId,
      actorType: 'user',
      actorId: session.user.id,
      action: 'catalog.item_created',
      entityType: 'catalog_item',
      entityId: item.id,
      metadata: { businessId: item.businessId, priceCentavos: item.priceCentavos },
      ip: clientIp(request),
      userAgent: userAgent(request),
    })

    return apiJson({ item }, 201)
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return apiError(400, 'invalid_category', error.message)
    }
    throw error
  }
}
