import { createHash, randomBytes } from 'node:crypto'

export const API_KEY_SCOPES = [
  'storefront:read',
  'catalog:read',
  'themes:read',
  'orders:read',
  'orders:write',
  'analytics:read',
] as const

export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]
export type ApiKeyEnv = 'test' | 'live'

export interface GeneratedApiKey {
  plaintext: string
  prefix: string
  keyHash: string
  env: ApiKeyEnv
}

const KEY_PATTERN = /^sk_(test|live)_[A-Za-z0-9_-]{16,}$/

export function generateApiKey(env: ApiKeyEnv): GeneratedApiKey {
  const plaintext = `sk_${env}_${randomBytes(24).toString('base64url')}`
  return {
    plaintext,
    prefix: plaintext.slice(0, 12),
    keyHash: hashApiKey(plaintext),
    env,
  }
}

export function hashApiKey(plaintext: string): string {
  return createHash('sha256').update(plaintext).digest('hex')
}

export function isApiKeyFormat(value: string): boolean {
  return KEY_PATTERN.test(value)
}

export function apiKeyEnv(value: string): ApiKeyEnv | null {
  const match = KEY_PATTERN.exec(value)
  return match?.[1] === 'test' || match?.[1] === 'live' ? match[1] : null
}

export function hasScope(granted: readonly string[], needed: ApiKeyScope): boolean {
  return granted.includes(needed)
}

export function isApiKeyScope(value: string): value is ApiKeyScope {
  return (API_KEY_SCOPES as readonly string[]).includes(value)
}
