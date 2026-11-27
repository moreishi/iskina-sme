export const SLUG_MIN = 3
export const SLUG_MAX = 40
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/

/** Slugs that would collide with the app's own routes or brand. */
export const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'app',
  'dashboard',
  'login',
  'logout',
  'onboarding',
  'signup',
  'support',
  'www',
  'iskina',
])

/** Storefront slugs are public URLs, so normalise instead of silently accepting junk. */
export function normalizeSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, '')
}

export function isValidSlug(value: string): boolean {
  return (
    value.length >= SLUG_MIN &&
    value.length <= SLUG_MAX &&
    SLUG_PATTERN.test(value) &&
    !value.includes('--')
  )
}

export function isReservedSlug(value: string): boolean {
  return RESERVED_SLUGS.has(value)
}
