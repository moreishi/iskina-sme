import { apiError, apiJson } from '@/lib/api'
import { currentSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')
  return apiJson(session)
}
