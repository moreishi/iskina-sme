import { getStorefrontBySlug } from '@iskina/db'
import { apiError, apiJson } from '@/lib/api'
import { authenticateChannel, isResponse } from '@/lib/auth/channel'
import { storefrontPayload } from '@/lib/channel/storefront'

export const dynamic = 'force-dynamic'

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const auth = await authenticateChannel(request, 'storefront:read')
  if (isResponse(auth)) return auth

  if (auth.kind !== 'platform') {
    return apiError(403, 'forbidden', 'Storefront details need the platform key')
  }

  const { slug } = await context.params
  const storefront = await getStorefrontBySlug(slug)
  if (!storefront) return apiError(404, 'not_found', 'Storefront not found')

  const payload = await storefrontPayload(storefront)
  if (!payload) return apiError(404, 'not_found', 'Storefront not found')

  return apiJson(payload)
}
