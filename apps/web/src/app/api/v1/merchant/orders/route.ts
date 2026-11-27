import { listOrders } from '@iskina/db'
import { apiError, apiJson } from '@/lib/api'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const url = new URL(request.url)
  const businessId = url.searchParams.get('businessId')
  if (!businessId) return apiError(400, 'invalid_request', 'businessId is required')

  const membership = businessMembership(session, businessId, ['owner', 'manager', 'staff'])
  if (!membership) return apiError(403, 'forbidden', 'You do not have access to this business')

  const status = url.searchParams.get('status')
  const statuses = status ? status.split(',').filter(Boolean) : undefined
  const orders = await listOrders(membership.tenantId, businessId, statuses)

  return apiJson({ orders })
}
