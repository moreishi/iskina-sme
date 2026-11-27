import { type ApiKeyScope, generateApiKey } from '@iskina/core/auth'
import { createApiKeyRecord, listApiKeys, recordAudit } from '@iskina/db'
import { apiError, apiJson, clientIp, readJson, userAgent } from '@/lib/api'
import { currentSession, ownerMembership } from '@/lib/auth/session'
import { apiKeyCreateSchema } from '@/lib/auth/validation'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const tenantId = new URL(request.url).searchParams.get('tenantId')
  const owner = ownerMembership(session, tenantId)
  if (!owner) return apiError(403, 'forbidden', 'Only an owner can view API keys')

  const keys = await listApiKeys(owner.tenantId)
  return apiJson({ keys })
}

export async function POST(request: Request) {
  const session = await currentSession()
  if (!session) return apiError(401, 'unauthorized', 'Sign in to continue')

  const body = await readJson(request)
  const parsed = apiKeyCreateSchema.safeParse(body)
  if (!parsed.success) {
    return apiError(400, 'invalid_request', 'A key needs a name and a valid environment')
  }

  const owner = ownerMembership(session, parsed.data.tenantId)
  if (!owner) return apiError(403, 'forbidden', 'Only an owner can create API keys')

  const allowed = new Set<ApiKeyScope>([
    'storefront:read',
    'catalog:read',
    'themes:read',
    'orders:read',
    'orders:write',
    'analytics:read',
  ])
  const scopes = parsed.data.scopes ?? [...allowed]
  if (scopes.some((scope) => !allowed.has(scope))) {
    return apiError(400, 'invalid_scope', 'One or more scopes are not allowed')
  }

  const generated = generateApiKey(parsed.data.env)
  const key = await createApiKeyRecord({
    tenantId: owner.tenantId,
    businessId: owner.businessId,
    name: parsed.data.name,
    prefix: generated.prefix,
    keyHash: generated.keyHash,
    env: generated.env,
    scopes,
    createdBy: session.user.id,
  })

  await recordAudit({
    tenantId: owner.tenantId,
    actorType: 'user',
    actorId: session.user.id,
    action: 'api_key.created',
    entityType: 'api_key',
    entityId: key.id,
    metadata: { name: key.name, env: key.env, scopes },
    ip: clientIp(request),
    userAgent: userAgent(request),
  })

  return apiJson({ key, plaintext: generated.plaintext }, 201)
}
