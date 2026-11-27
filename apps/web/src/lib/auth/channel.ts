import { timingSafeEqual } from 'node:crypto'
import { type ApiKeyScope, hashApiKey, hasScope, isApiKeyFormat } from '@iskina/core/auth'
import { findApiKeyByHash, touchApiKey } from '@iskina/db'
import { apiError } from '@/lib/api'

export type ChannelAuth =
  | {
      kind: 'platform'
      keyId: 'platform'
      tenantId: null
      businessId: null
      scopes: string[]
    }
  | {
      kind: 'key'
      keyId: string
      tenantId: string
      businessId: string | null
      scopes: string[]
    }

function platformKey(): string | null {
  const value = process.env.CHANNEL_PLATFORM_KEY?.trim()
  return value && value.length >= 24 ? value : null
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
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

  const configured = platformKey()
  if (configured && safeEqual(token, configured)) {
    return {
      kind: 'platform',
      keyId: 'platform',
      tenantId: null,
      businessId: null,
      scopes: [
        'storefront:read',
        'catalog:read',
        'themes:read',
        'orders:read',
        'orders:write',
        'analytics:read',
      ],
    }
  }

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
    kind: 'key',
    keyId: key.id,
    tenantId: key.tenantId,
    businessId: key.businessId,
    scopes: key.scopes,
  }
}

export function isResponse(value: unknown): value is Response {
  return value instanceof Response
}
