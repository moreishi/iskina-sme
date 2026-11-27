import { listStorefronts } from '@iskina/db'
import { apiError, apiJson } from '@/lib/api'
import { authenticateChannel, isResponse } from '@/lib/auth/channel'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const auth = await authenticateChannel(request, 'storefront:read')
  if (isResponse(auth)) return auth

  if (auth.kind !== 'platform') {
    return apiError(403, 'forbidden', 'Storefront discovery needs the platform key')
  }

  const url = new URL(request.url)
  const limitParam = Number(url.searchParams.get('limit') ?? 50)
  const limit = Number.isFinite(limitParam) ? limitParam : 50
  const storefronts = await listStorefronts(limit)

  return apiJson({
    storefronts: storefronts.map((storefront) => ({
      id: storefront.id,
      name: storefront.name,
      slug: storefront.slug,
      vertical: storefront.vertical,
      lat: storefront.lat,
      lng: storefront.lng,
    })),
  })
}
