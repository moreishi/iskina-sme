import { describe, expect, it } from 'vitest'
import {
  healthResponseSchema,
  themeManifestSchema,
  VERTICAL_FULFILLMENT,
  verticalSchema,
} from '../src'

const tokens = {
  primary: '#FF6A00',
  onPrimary: '#1A1A1A',
  accent: '#FFB300',
  onAccent: '#1A1A1A',
  surface: '#FFFDF9',
  surfaceMuted: '#FFF4EA',
  onSurface: '#1A1A1A',
  outline: '#E8DED4',
  success: '#1B7F3B',
  warning: '#8A5A00',
  danger: '#B00020',
  radius: 'md',
  font: 'sans',
}

const manifest = {
  version: 1,
  layout: 'grid',
  tokens: { light: tokens, dark: tokens },
  assets: { logo: null, banner: null },
}

describe('theme manifest contract', () => {
  it('accepts a valid manifest', () => {
    expect(themeManifestSchema.safeParse(manifest).success).toBe(true)
  })

  it('rejects unknown tokens (allowlist, not CSS)', () => {
    const extra = { ...manifest, tokens: { light: { ...tokens, css: 'body{}' }, dark: tokens } }
    expect(themeManifestSchema.safeParse(extra).success).toBe(false)
  })

  it('rejects a 3-digit hex', () => {
    const bad = { ...manifest, tokens: { light: { ...tokens, primary: '#F60' }, dark: tokens } }
    expect(themeManifestSchema.safeParse(bad).success).toBe(false)
  })

  it('rejects a non-positive version', () => {
    expect(themeManifestSchema.safeParse({ ...manifest, version: 0 }).success).toBe(false)
  })
})

describe('verticals', () => {
  it('maps each vertical to a fulfillment kind', () => {
    expect(verticalSchema.parse('food')).toBe('food')
    expect(VERTICAL_FULFILLMENT.food).toBe('delivery')
    expect(VERTICAL_FULFILLMENT.aircon).toBe('booking')
    expect(VERTICAL_FULFILLMENT.lpg).toBe('delivery')
  })

  it('rejects an unknown vertical', () => {
    expect(verticalSchema.safeParse('rides').success).toBe(false)
  })
})

describe('health contract', () => {
  it('accepts an ok response', () => {
    const result = healthResponseSchema.safeParse({
      service: 'iskina-sme',
      version: '0.1.0',
      status: 'ok',
      database: 'ok',
      uptimeSeconds: 1.2,
      checkedAt: new Date().toISOString(),
    })
    expect(result.success).toBe(true)
  })
})
