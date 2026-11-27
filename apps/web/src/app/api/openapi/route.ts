import { openApiDocument } from '@/lib/openapi'

export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json(openApiDocument, {
    headers: {
      'cache-control': 'public, max-age=300',
      'content-disposition': 'inline; filename="iskina-sme-openapi.json"',
    },
  })
}
