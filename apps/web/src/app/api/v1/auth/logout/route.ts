import { apiJson } from '@/lib/api'
import { endSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export async function POST() {
  await endSession()
  return apiJson({ ok: true })
}
