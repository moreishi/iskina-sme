import { type ApiKeyScope, hashApiKey, hasScope, isApiKeyFormat } from '@iskina/core/auth'
import { findApiKeyByHash, touchApiKey } from '@iskina/db'
import { apiError } from '@/lib/api'

export interface ChannelAuth {
  keyId: string
  tenantId: string
  businessId: string | null
  scopes: string[]
}

export async function authenticateChannel(
  request: Request,
  scope: ApiKeyScope,
): Promise<ChannelAuth | Response> {
  const header = request.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) {
    return apiError(401, 'unauthorized', 'A channel API key is required')
  }
  const token = header.slice('Bearer '.length).trim()
  if (!isApiKeyFormat(token)) {
    return apiError(401, 'unauthorized', 'Malformed API key')
  }

  const key = await findApiKeyByHash(hashApiKey(token))
  if (!key || key.revokedAt) {
    return apiError(401, 'unauthorized', 'Invalid or revoked API key')
  }
  if (!hasScope(key.scopes, scope)) {
    return apiError(403, 'forbidden', `This key lacks the ${scope} scope`)
  }

  void touchApiKey(key.id)

  return {
    keyId: key.id,
    tenantId: key.tenantId,
    businessId: key.businessId,
    scopes: key.scopes,
  }
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response
}
