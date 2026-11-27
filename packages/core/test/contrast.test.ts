import { describe, expect, it } from 'vitest'
import { contrastRatio, meetsContrast, parseHex, relativeLuminance } from '../src/theme/contrast'

describe('contrast', () => {
  it('parses hex colours', () => {
    expect(parseHex('#FF6A00')).toEqual({ r: 255, g: 106, b: 0 })
    expect(parseHex('1a1a1a')).toEqual({ r: 26, g: 26, b: 26 })
  })

  it('rejects malformed colours', () => {
    expect(() => parseHex('#FFF')).toThrow(/Invalid hex/)
    expect(() => parseHex('red')).toThrow(/Invalid hex/)
  })

  it('computes the known black-on-white ratio', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5)
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 5)
  })

  it('returns 1 for identical colours', () => {
    expect(contrastRatio('#FF6A00', '#FF6A00')).toBeCloseTo(1, 5)
  })

  it('applies the AA threshold', () => {
    // White on Ember orange is only ~2.9:1 — this is why onPrimary is near-black.
    expect(meetsContrast('#FFFFFF', '#FF6A00')).toBe(false)
    expect(meetsContrast('#1A1A1A', '#FF6A00')).toBe(true)
    expect(meetsContrast('#FFFFFF', '#FF6A00', 3)).toBe(false)
  })
})
