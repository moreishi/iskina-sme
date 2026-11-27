import { recordAudit, revokeApiKey } from '@iskina/db'
import { apiError, apiJson, clientIp, readJson, userAgent } from '@/lib/api'
import { currentSession, ownerMembership } from '@/lib/auth/session'
import { apiKeyRevokeSchema } from '@/lib/auth/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const { id } = await context.params
  const body = await readJson(request)
  const parsed = apiKeyRevokeSchema.safeParse(body ?? {})
  if (!parsed.success) return apiError(400, 'invalid_request', 'Invalid tenant')

  const owner = ownerMembership(session, parsed.data.tenantId)
  if (!owner) return apiError(403, 'forbidden', 'Only an owner can revoke API keys')

  const revoked = await revokeApiKey(owner.tenantId, id)
  if (!revoked) return apiError(404, 'not_found', 'That key does not exist')

  await recordAudit({
    tenantId: owner.tenantId,
    actorType: 'user',
    actorId: session.user.id,
    action: 'api_key.revoked',
    entityType: 'api_key',
    entityId: id,
    ip: clientIp(request),
    userAgent: userAgent(request),
  })

  return apiJson({ ok: true })
}
