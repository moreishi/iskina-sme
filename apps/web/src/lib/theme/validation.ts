import { z } from 'zod'

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a #RRGGBB colour')

const override = z
  .object({
    primary: color.optional(),
    accent: color.optional(),
    surface: color.optional(),
    onSurface: color.optional(),
  })
  .strict()

export const publishThemeSchema = z
  .object({
    businessId: z.uuid(),
    presetId: z.string().trim().min(1).max(40).optional(),
    layout: z.enum(['grid', 'list', 'compact']).optional(),
    light: override.optional(),
    dark: override.optional(),
    assets: z
      .object({
        logo: z.url().nullable().optional(),
        banner: z.url().nullable().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
