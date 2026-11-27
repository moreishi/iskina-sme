import { getItemForTenant, recordAudit, setItemImage } from '@iskina/db'
import { z } from 'zod'
import { apiError, apiJson, clientIp, userAgent } from '@/lib/api'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'
import { ALLOWED_IMAGE_TYPES, MAX_IMAGE_BYTES, processItemImage, sniffImage } from '@/lib/images'
import { itemImageKey, StorageUnavailableError, storage } from '@/lib/storage'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const businessIdSchema = z.uuid()

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return apiError(400, 'invalid_request', 'Send the image as multipart form data')
  }

  const parsedBusiness = businessIdSchema.safeParse(form.get('businessId'))
  if (!parsedBusiness.success) return apiError(400, 'invalid_request', 'businessId is required')

  const membership = businessMembership(session, parsedBusiness.data)
  if (!membership) return apiError(403, 'forbidden', 'Only an owner or manager can upload images')

  const file = form.get('file')
  if (!(file instanceof File)) return apiError(400, 'invalid_request', 'A file is required')
  if (file.size === 0) return apiError(400, 'invalid_image', 'The file is empty')
  if (file.size > MAX_IMAGE_BYTES) {
    return apiError(413, 'image_too_large', `Images must be at most ${MAX_IMAGE_BYTES} bytes`)
  }
  if (
    file.type &&
    !ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])
  ) {
    return apiError(400, 'invalid_image', 'Use a JPEG, PNG or WebP image')
  }

  const raw = Buffer.from(await file.arrayBuffer())
  if (!sniffImage(raw)) {
    return apiError(400, 'invalid_image', 'The file is not a JPEG, PNG or WebP image')
  }

  const { id } = await context.params
  const item = await getItemForTenant(membership.tenantId, parsedBusiness.data, id)
  if (!item) return apiError(404, 'not_found', 'Item not found')

  let processed: Awaited<ReturnType<typeof processItemImage>>
  try {
    processed = await processItemImage(raw)
  } catch {
    return apiError(400, 'invalid_image', 'The image could not be processed')
  }

  const key = itemImageKey(parsedBusiness.data, processed.extension)
  let imageUrl: string
  try {
    imageUrl = await storage().put(key, processed.buffer, processed.contentType)
  } catch (error) {
    if (error instanceof StorageUnavailableError) {
      return apiError(503, 'storage_unavailable', error.message)
    }
    return apiError(503, 'storage_unavailable', 'Could not store the image')
  }

  const updated = await setItemImage(membership.tenantId, parsedBusiness.data, id, imageUrl)
  if (!updated) return apiError(404, 'not_found', 'Item not found')

  if (item.imageUrl) {
    await storage()
      .delete(item.imageUrl)
      .catch(() => undefined)
  }

  await recordAudit({
    tenantId: membership.tenantId,
    actorType: 'user',
    actorId: session.user.id,
    action: 'catalog.item_image_updated',
    entityType: 'catalog_item',
    entityId: id,
    metadata: {
      businessId: parsedBusiness.data,
      bytes: processed.buffer.length,
      width: processed.width,
      height: processed.height,
    },
    ip: clientIp(request),
    userAgent: userAgent(request),
  })

  return apiJson(
    {
      item: { id: updated.id, imageUrl: updated.imageUrl },
      image: { width: processed.width, height: processed.height, bytes: processed.buffer.length },
    },
    201,
  )
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const businessId = new URL(request.url).searchParams.get('businessId')
  const parsed = businessIdSchema.safeParse(businessId)
  if (!parsed.success) return apiError(400, 'invalid_request', 'businessId is required')

  const membership = businessMembership(session, parsed.data)
  if (!membership) return apiError(403, 'forbidden', 'Only an owner or manager can edit images')

  const { id } = await context.params
  const item = await getItemForTenant(membership.tenantId, parsed.data, id)
  if (!item) return apiError(404, 'not_found', 'Item not found')

  await setItemImage(membership.tenantId, parsed.data, id, null)
  if (item.imageUrl) {
    await storage()
      .delete(item.imageUrl)
      .catch(() => undefined)
  }

  return apiJson({ ok: true })
}
