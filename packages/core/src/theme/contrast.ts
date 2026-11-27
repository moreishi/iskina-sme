/**
 * WCAG 2.x relative luminance and contrast. Pure functions so the theme editor
 * and the publish guard share exactly one implementation.
 */

export interface Rgb {
  r: number
  g: number
  b: number
}

export function parseHex(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, '')
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`Invalid hex colour: ${hex}`)
  }
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

function channelToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = parseHex(hex)
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}

/** Contrast ratio from 1 (identical) to 21 (black on white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  const lighter = Math.max(la, lb)
  const darker = Math.min(la, lb)
  return (lighter + 0.05) / (darker + 0.05)
}

export const WCAG_AA_NORMAL = 4.5
export const WCAG_AA_LARGE = 3
export const WCAG_AA_UI = 3

export function meetsContrast(a: string, b: string, minimum = WCAG_AA_NORMAL): boolean {
  return contrastRatio(a, b) >= minimum
}
