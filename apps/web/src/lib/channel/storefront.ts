import { type ThemeManifest, themeManifestSchema } from '@iskina/contracts'
import {
  buildThemeManifest,
  DEFAULT_PRESET_ID,
  mergeVerticalConfig,
  validateThemeManifest,
} from '@iskina/core'
import { getBusinessForTenant, getCatalog, getPublishedTheme, type Storefront } from '@iskina/db'

export async function storefrontPayload(storefront: Storefront) {
  const business = await getBusinessForTenant(storefront.tenantId, storefront.id)
  if (!business) return null

  const config = mergeVerticalConfig(business.vertical, business.verticalConfig)
  const catalog = await getCatalog(storefront.tenantId, storefront.id)

  const published = await getPublishedTheme(storefront.tenantId, storefront.id)
  let theme: ThemeManifest = buildThemeManifest({ presetId: DEFAULT_PRESET_ID }, 1)
  let source: 'published' | 'default' = 'default'
  if (published) {
    const parsed = themeManifestSchema.safeParse(published.manifest)
    if (parsed.success && validateThemeManifest(parsed.data).ok) {
      theme = { ...parsed.data, version: published.version }
      source = 'published'
    }
  }

  const publicItem = (item: (typeof catalog.categories)[number]['items'][number]) => ({
    id: item.id,
    categoryId: item.categoryId,
    name: item.name,
    description: item.description,
    priceCentavos: item.priceCentavos,
    unit: item.unit,
    metadata: item.metadata,
  })

  return {
    business: {
      id: business.id,
      name: business.name,
      slug: business.slug,
      vertical: business.vertical,
      timezone: business.timezone,
      lat: business.lat,
      lng: business.lng,
    },
    config,
    theme,
    source,
    categories: catalog.categories
      .filter((category) => category.active)
      .map((category) => ({
        id: category.id,
        name: category.name,
        items: category.items.filter((item) => item.available).map(publicItem),
      })),
    uncategorized: catalog.uncategorized.filter((item) => item.available).map(publicItem),
  }
}
