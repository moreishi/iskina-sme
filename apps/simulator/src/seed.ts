import { ApiError } from './http'
import type { MerchantAgent } from './merchant'

export type Vertical = 'food' | 'aircon' | 'lpg'

export interface SimBusiness {
  slug: string
  businessId: string
  vertical: Vertical
  name: string
}

interface Spec {
  slug: string
  name: string
  category: string
  items: { name: string; priceCentavos: number }[]
}

const SPECS: Record<Vertical, Spec> = {
  food: {
    slug: 'sim-food',
    name: 'SIM Kitchen',
    category: 'Sim meals',
    items: [
      { name: 'Sim adobo', priceCentavos: 12_000 },
      { name: 'Sim pancit', priceCentavos: 9_500 },
      { name: 'Sim iced tea', priceCentavos: 4_500 },
    ],
  },
  aircon: {
    slug: 'sim-aircon',
    name: 'SIM Aircon',
    category: 'Sim cleaning',
    items: [
      { name: 'Sim split cleaning', priceCentavos: 80_000 },
      { name: 'Sim window cleaning', priceCentavos: 50_000 },
    ],
  },
  lpg: {
    slug: 'sim-lpg',
    name: 'SIM LPG',
    category: 'Sim LPG',
    items: [
      { name: 'Sim 11kg exchange', priceCentavos: 85_000 },
      { name: 'Sim 22kg refill', priceCentavos: 160_000 },
    ],
  },
}

export function simSpec(vertical: Vertical): Spec {
  return SPECS[vertical]
}

export async function ensureBusiness(
  agent: MerchantAgent,
  vertical: Vertical,
): Promise<SimBusiness> {
  const spec = SPECS[vertical]
  let membership = agent.membership(spec.slug)

  if (!membership) {
    try {
      await agent.onboard({
        businessName: spec.name,
        slug: spec.slug,
        vertical,
      })
    } catch (error) {
      if (error instanceof ApiError && error.code === 'slug_taken') {
        throw new Error(
          `Slug ${spec.slug} already exists but this account does not own it. Reset the SIM tenant or use another phone.`,
        )
      }
      throw error
    }
    membership = agent.membership(spec.slug)
  }

  const businessId = membership?.businessId
  if (!businessId) {
    throw new Error(`No business id for ${spec.slug}; onboarding did not return a membership.`)
  }

  await ensureCatalog(agent, businessId, spec)
  await ensureTheme(agent, businessId)

  return { slug: spec.slug, businessId, vertical, name: spec.name }
}

async function ensureCatalog(agent: MerchantAgent, businessId: string, spec: Spec): Promise<void> {
  const catalog = await agent.catalog(businessId)
  const existing = catalog.categories.reduce((total, category) => total + category.items.length, 0)
  if (existing > 0) return

  let categoryId = catalog.categories.find((category) => category.name === spec.category)?.id
  if (!categoryId) {
    try {
      const category = await agent.createCategory(businessId, spec.category)
      categoryId = category.id
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        const refreshed = await agent.catalog(businessId)
        categoryId = refreshed.categories.find((item) => item.name === spec.category)?.id
      }
      if (!categoryId) throw error
    }
  }

  for (const item of spec.items) {
    try {
      await agent.createItem({
        businessId,
        categoryId,
        name: item.name,
        priceCentavos: item.priceCentavos,
      })
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) continue
      throw error
    }
  }
}

async function ensureTheme(agent: MerchantAgent, businessId: string): Promise<void> {
  const theme = await agent.theme(businessId)
  if (!theme.published) {
    await agent.publishTheme(businessId, 'ferrari')
  }
}

export async function seedAll(agent: MerchantAgent): Promise<SimBusiness[]> {
  return [
    await ensureBusiness(agent, 'food'),
    await ensureBusiness(agent, 'aircon'),
    await ensureBusiness(agent, 'lpg'),
  ]
}
