import {
  type ThemeAssets,
  type ThemeLayout,
  type ThemeManifest,
  type ThemeTokens,
  themeManifestSchema,
} from '@iskina/contracts'
import { contrastRatio } from './contrast'
import { defaultPreset, getPreset } from './presets'

type EditableToken = 'primary' | 'accent' | 'surface' | 'onSurface'

export interface ThemeOverrides {
  presetId?: string
  layout?: ThemeLayout
  light?: Partial<Pick<ThemeTokens, EditableToken>>
  dark?: Partial<Pick<ThemeTokens, EditableToken>>
  assets?: Partial<ThemeAssets>
}

/** Pick whichever text colour reads better on a background. */
export function bestOnColor(background: string): string {
  return contrastRatio('#FFFFFF', background) >= contrastRatio('#121212', background)
    ? '#FFFFFF'
    : '#121212'
}

/**
 * Builds a complete, strict manifest from a preset plus the editor's partial
 * overrides. Button text is derived, never trusted from the client.
 */
export function buildThemeManifest(overrides: ThemeOverrides, version: number): ThemeManifest {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Theme version must be a positive integer, got ${version}`)
  }
  const preset = overrides.presetId ? getPreset(overrides.presetId) : defaultPreset()

  const light: ThemeTokens = { ...preset.tokens.light, ...overrides.light }
  light.onPrimary = bestOnColor(light.primary)
  light.onAccent = bestOnColor(light.accent)

  const dark: ThemeTokens = { ...preset.tokens.dark, ...overrides.dark }
  dark.onPrimary = bestOnColor(dark.primary)
  dark.onAccent = bestOnColor(dark.accent)

  return themeManifestSchema.parse({
    version,
    layout: overrides.layout ?? preset.layout,
    tokens: { light, dark },
    assets: {
      logo: overrides.assets?.logo ?? null,
      banner: overrides.assets?.banner ?? null,
    },
  })
}
