import { type ThemeManifest, type ThemeTokens, themeManifestSchema } from '@iskina/contracts'
import { contrastRatio, WCAG_AA_NORMAL } from './contrast'
import type { ThemePreset } from './presets'

export interface ThemeIssue {
  code: 'schema' | 'contrast'
  path: string
  message: string
  ratio?: number
}

export interface ThemeValidation {
  ok: boolean
  issues: ThemeIssue[]
}

/** Text-bearing pairs that must clear WCAG AA in both modes. */
const CONTRAST_PAIRS: ReadonlyArray<{
  foreground: keyof ThemeTokens
  background: keyof ThemeTokens
}> = [
  { foreground: 'onPrimary', background: 'primary' },
  { foreground: 'onAccent', background: 'accent' },
  { foreground: 'onSurface', background: 'surface' },
  { foreground: 'onSurface', background: 'surfaceMuted' },
]

export function validateThemeTokens(tokens: ThemeTokens, mode: 'light' | 'dark'): ThemeIssue[] {
  const issues: ThemeIssue[] = []
  for (const pair of CONTRAST_PAIRS) {
    const foreground = tokens[pair.foreground]
    const background = tokens[pair.background]
    if (typeof foreground !== 'string' || typeof background !== 'string') continue
    const ratio = contrastRatio(foreground, background)
    if (ratio < WCAG_AA_NORMAL) {
      issues.push({
        code: 'contrast',
        path: `tokens.${mode}.${pair.foreground}/${pair.background}`,
        message: `${foreground} on ${background} is ${ratio.toFixed(2)}:1; WCAG AA needs ${WCAG_AA_NORMAL}:1`,
        ratio,
      })
    }
  }
  return issues
}

export function validateThemeManifest(input: unknown): ThemeValidation {
  const parsed = themeManifestSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        code: 'schema',
        path: issue.path.join('.'),
        message: issue.message,
      })),
    }
  }
  const issues = [
    ...validateThemeTokens(parsed.data.tokens.light, 'light'),
    ...validateThemeTokens(parsed.data.tokens.dark, 'dark'),
  ]
  return { ok: issues.length === 0, issues }
}

/** Publishing a preset snapshots it into a manifest; old versions never change. */
export function themeManifestFromPreset(preset: ThemePreset, version: number): ThemeManifest {
  if (!Number.isInteger(version) || version < 1) {
    throw new Error(`Theme version must be a positive integer, got ${version}`)
  }
  return {
    version,
    layout: preset.layout,
    tokens: preset.tokens,
    assets: { logo: null, banner: null },
  }
}
