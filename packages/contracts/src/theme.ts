import { z } from 'zod'

/** A published storefront theme. Only allowlisted tokens — never arbitrary CSS. */
export const themeLayoutSchema = z.enum(['grid', 'list', 'compact'])
export const themeRadiusSchema = z.enum(['sm', 'md', 'lg', 'full'])
export const themeFontSchema = z.enum(['sans', 'serif', 'rounded'])
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a #RRGGBB colour')

export const themeTokensSchema = z.strictObject({
  primary: hexColorSchema,
  onPrimary: hexColorSchema,
  accent: hexColorSchema,
  onAccent: hexColorSchema,
  surface: hexColorSchema,
  surfaceMuted: hexColorSchema,
  onSurface: hexColorSchema,
  outline: hexColorSchema,
  success: hexColorSchema,
  warning: hexColorSchema,
  danger: hexColorSchema,
  radius: themeRadiusSchema,
  font: themeFontSchema,
})

export const themeAssetsSchema = z.strictObject({
  logo: z.url().nullable().default(null),
  banner: z.url().nullable().default(null),
})

export const themeManifestSchema = z.strictObject({
  version: z.number().int().positive(),
  layout: themeLayoutSchema,
  tokens: z.strictObject({
    light: themeTokensSchema,
    dark: themeTokensSchema,
  }),
  assets: themeAssetsSchema.default({ logo: null, banner: null }),
})

export type ThemeLayout = z.infer<typeof themeLayoutSchema>
export type ThemeRadius = z.infer<typeof themeRadiusSchema>
export type ThemeFont = z.infer<typeof themeFontSchema>
export type ThemeTokens = z.infer<typeof themeTokensSchema>
export type ThemeAssets = z.infer<typeof themeAssetsSchema>
export type ThemeManifest = z.infer<typeof themeManifestSchema>

export const THEME_TOKEN_KEYS = [
  'primary',
  'onPrimary',
  'accent',
  'onAccent',
  'surface',
  'surfaceMuted',
  'onSurface',
  'outline',
  'success',
  'warning',
  'danger',
] as const

export type ThemeColorKey = (typeof THEME_TOKEN_KEYS)[number]
