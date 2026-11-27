import { describe, expect, it } from 'vitest'
import { assertSafeTarget, ConfigError } from '../src/config'

describe('simulator target safety', () => {
  it('allows local targets by default', () => {
    expect(assertSafeTarget('http://localhost:3008', {}).hostname).toBe('localhost')
    expect(assertSafeTarget('http://127.0.0.1:3008', {}).hostname).toBe('127.0.0.1')
  })

  it('refuses a remote host without SIM_ALLOW_REMOTE', () => {
    expect(() => assertSafeTarget('https://staging.example.com', {})).toThrow(ConfigError)
  })

  it('allows staging with SIM_ALLOW_REMOTE=1', () => {
    expect(
      assertSafeTarget('https://staging.example.com', { SIM_ALLOW_REMOTE: '1' }).hostname,
    ).toBe('staging.example.com')
  })

  it('still refuses production without the second flag', () => {
    expect(() => assertSafeTarget('https://sme.iskina.cc', { SIM_ALLOW_REMOTE: '1' })).toThrow(
      /production/i,
    )
    expect(
      assertSafeTarget('https://sme.iskina.cc', {
        SIM_ALLOW_REMOTE: '1',
        SIM_ALLOW_PRODUCTION: '1',
      }).hostname,
    ).toBe('sme.iskina.cc')
  })

  it('rejects a malformed URL', () => {
    expect(() => assertSafeTarget('not-a-url', {})).toThrow(/Invalid BASE_URL/)
  })
})
