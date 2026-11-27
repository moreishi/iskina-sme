import { describe, expect, it } from 'vitest'
import { bearerSessionToken } from '../src/lib/auth/session'

describe('bearer session token', () => {
  it('extracts a mobile session token', () => {
    expect(bearerSessionToken('Bearer abc123')).toBe('abc123')
  })

  it('rejects missing, malformed and channel keys', () => {
    expect(bearerSessionToken(null)).toBeNull()
    expect(bearerSessionToken('Basic abc')).toBeNull()
    expect(bearerSessionToken('Bearer ')).toBeNull()
    expect(bearerSessionToken('Bearer sk_test_abcdefghijklmnop')).toBeNull()
  })
})
