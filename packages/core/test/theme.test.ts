import { describe, expect, it } from 'vitest'
import { DEFAULT_PRESET_ID, defaultPreset, getPreset, listPresets } from '../src/theme/presets'
import {
  themeManifestFromPreset,
  validateThemeManifest,
  validateThemeTokens,
} from '../src/theme/validate'

describe('theme presets', () => {
  it('defaults to Ember (brand orange #FF6A00)', () => {
    expect(DEFAULT_PRESET_ID).toBe('alibaba')
    expect(defaultPreset().label).toBe('Ember')
    expect(defaultPreset().tokens.light.primary).toBe('#FF6A00')
  })

  it('ships four presets with unique ids', () => {
    const presets = listPresets()
    expect(presets.map((preset) => preset.id)).toEqual(['alibaba', 'ocean', 'forest', 'mono'])
    expect(new Set(presets.map((preset) => preset.id)).size).toBe(presets.length)
  })

  it('throws for an unknown preset instead of silently falling back', () => {
    expect(() => getPreset('not-a-preset')).toThrow(/Unknown theme preset/)
  })
})

describe('theme validation', () => {
  it('accepts every shipped preset in both modes', () => {
    for (const preset of listPresets()) {
      const manifest = themeManifestFromPreset(preset, 1)
      const result = validateThemeManifest(manifest)
      expect(result.issues, `${preset.id}: ${JSON.stringify(result.issues)}`).toEqual([])
      expect(result.ok).toBe(true)
    }
  })

  it('rejects a low-contrast pair', () => {
    const manifest = themeManifestFromPreset(defaultPreset(), 1)
    manifest.tokens.light.onPrimary = '#FFE0CC'
    const result = validateThemeManifest(manifest)
    expect(result.ok).toBe(false)
    expect(result.issues[0]?.code).toBe('contrast')
    expect(result.issues[0]?.path).toContain('tokens.light')
  })

  it('rejects white text on Ember orange', () => {
    const manifest = themeManifestFromPreset(defaultPreset(), 1)
    manifest.tokens.light.onPrimary = '#FFFFFF'
    const issues = validateThemeTokens(manifest.tokens.light, 'light')
    expect(issues.some((issue) => issue.ratio !== undefined && issue.ratio < 4.5)).toBe(true)
  })

  it('rejects a malformed manifest before contrast checks', () => {
    const result = validateThemeManifest({ version: 0, layout: 'grid' })
    expect(result.ok).toBe(false)
    expect(result.issues.every((issue) => issue.code === 'schema')).toBe(true)
  })

  it('requires a positive integer version', () => {
    expect(() => themeManifestFromPreset(defaultPreset(), 0)).toThrow(/positive integer/)
    expect(() => themeManifestFromPreset(defaultPreset(), 1.5)).toThrow(/positive integer/)
  })
})
