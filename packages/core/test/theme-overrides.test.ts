import { describe, expect, it } from 'vitest'
import { contrastRatio } from '../src/theme/contrast'
import { bestOnColor, buildThemeManifest } from '../src/theme/overrides'
import { validateThemeManifest } from '../src/theme/validate'

describe('theme overrides', () => {
  it('derives readable button text for orange', () => {
    expect(bestOnColor('#FF6A00')).toBe('#121212')
    const manifest = buildThemeManifest({ presetId: 'alibaba' }, 1)
    expect(manifest.tokens.light.onPrimary).toBe('#121212')
    expect(contrastRatio(manifest.tokens.light.onPrimary, '#FF6A00')).toBeGreaterThanOrEqual(4.5)
  })

  it('defaults to Rosso with white button text', () => {
    const manifest = buildThemeManifest({}, 1)
    expect(manifest.tokens.light.primary).toBe('#D40000')
    expect(manifest.tokens.light.onPrimary).toBe('#FFFFFF')
    expect(contrastRatio('#FFFFFF', '#D40000')).toBeGreaterThanOrEqual(4.5)
  })

  it('derives white text for a dark primary', () => {
    const manifest = buildThemeManifest({ presetId: 'mono', light: { primary: '#1F1F1F' } }, 1)
    expect(manifest.tokens.light.onPrimary).toBe('#FFFFFF')
  })

  it('builds a valid manifest from partial overrides', () => {
    const manifest = buildThemeManifest(
      {
        presetId: 'ocean',
        layout: 'list',
        light: { primary: '#0B6E99', accent: '#F2A900' },
      },
      3,
    )
    expect(manifest.version).toBe(3)
    expect(manifest.layout).toBe('list')
    expect(validateThemeManifest(manifest).ok).toBe(true)
  })

  it('still fails contrast when the surface pair is unreadable', () => {
    const manifest = buildThemeManifest(
      { presetId: 'alibaba', light: { surface: '#FFFFFF', onSurface: '#FFFDF9' } },
      1,
    )
    const result = validateThemeManifest(manifest)
    expect(result.ok).toBe(false)
    expect(result.issues.some((issue) => issue.code === 'contrast')).toBe(true)
  })

  it('rejects an unknown preset and a bad version', () => {
    expect(() => buildThemeManifest({ presetId: 'nope' }, 1)).toThrow(/Unknown theme preset/)
    expect(() => buildThemeManifest({}, 0)).toThrow(/positive integer/)
  })
})
