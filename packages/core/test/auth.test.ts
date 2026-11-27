import { describe, expect, it } from 'vitest'
import {
  apiKeyEnv,
  generateApiKey,
  hashApiKey,
  hasScope,
  isApiKeyFormat,
  isApiKeyScope,
} from '../src/auth/api-key'
import { normalizePhone } from '../src/auth/phone'
import { allowedScopesForRole, canManageApiKeys, canProcessOrders } from '../src/auth/roles'
import { isReservedSlug, isValidSlug, normalizeSlug } from '../src/auth/slug'
import { hashOtpCode, safeEqualHex } from '../src/auth/tokens'

describe('phone normalisation', () => {
  it.each([
    ['09171234567', '+639171234567'],
    ['9171234567', '+639171234567'],
    ['+639171234567', '+639171234567'],
    ['639171234567', '+639171234567'],
    ['0917 123 4567', '+639171234567'],
    ['0917-123-4567', '+639171234567'],
  ])('normalises %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected)
  })

  it.each(['12345', '+15551234567', '08171234567', '0917123456'])('rejects %s', (input) => {
    expect(normalizePhone(input)).toBeNull()
  })
})

describe('slugs', () => {
  it('normalises display names', () => {
    expect(normalizeSlug("  Aling Nena's Kitchen! ")).toBe('aling-nena-s-kitchen')
    expect(normalizeSlug('---Cebu   Cool---')).toBe('cebu-cool')
  })

  it('rejects too short, too long and reserved slugs', () => {
    expect(isValidSlug('ab')).toBe(false)
    expect(isValidSlug('-leading')).toBe(false)
    expect(isValidSlug('has--double')).toBe(false)
    expect(isValidSlug('aling-nena')).toBe(true)
    expect(isReservedSlug('admin')).toBe(true)
    expect(isReservedSlug('aling-nena')).toBe(false)
  })
})

describe('api keys', () => {
  it('generates a prefixed key whose hash matches', () => {
    const key = generateApiKey('test')
    expect(key.plaintext.startsWith('sk_test_')).toBe(true)
    expect(isApiKeyFormat(key.plaintext)).toBe(true)
    expect(apiKeyEnv(key.plaintext)).toBe('test')
    expect(hashApiKey(key.plaintext)).toBe(key.keyHash)
    expect(key.prefix).toHaveLength(12)
  })

  it('never produces the same key twice', () => {
    expect(generateApiKey('live').plaintext).not.toBe(generateApiKey('live').plaintext)
  })

  it('rejects non-key strings', () => {
    expect(isApiKeyFormat('sk_live_short')).toBe(false)
    expect(isApiKeyFormat('pk_test_abcdefghijklmnop')).toBe(false)
    expect(apiKeyEnv('sk_prod_abcdefghijklmnop')).toBeNull()
  })

  it('checks scopes against the allowlist', () => {
    expect(hasScope(['orders:read'], 'orders:read')).toBe(true)
    expect(hasScope(['orders:read'], 'orders:write')).toBe(false)
    expect(isApiKeyScope('analytics:read')).toBe(true)
    expect(isApiKeyScope('admin:all')).toBe(false)
  })
})

describe('roles', () => {
  it('limits key management to owners', () => {
    expect(canManageApiKeys('owner')).toBe(true)
    expect(canManageApiKeys('manager')).toBe(false)
    expect(canProcessOrders('staff')).toBe(true)
    expect(allowedScopesForRole('staff')).toEqual(['storefront:read', 'orders:read'])
  })
})

describe('otp hashing', () => {
  it('binds the code to the phone and compares in constant time', () => {
    const hash = hashOtpCode('+639171234567', '123456')
    expect(hash).toHaveLength(64)
    expect(safeEqualHex(hash, hashOtpCode('+639171234567', '123456'))).toBe(true)
    expect(safeEqualHex(hash, hashOtpCode('+639171234567', '654321'))).toBe(false)
    expect(safeEqualHex(hash, hashOtpCode('+639000000000', '123456'))).toBe(false)
    expect(safeEqualHex(hash, 'short')).toBe(false)
  })
})
