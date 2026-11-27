import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { HttpClient } from './http'

export interface Membership {
  tenantId: string
  businessId: string | null
  businessSlug: string | null
  businessName: string | null
  vertical: 'food' | 'aircon' | 'lpg' | null
  role: 'owner' | 'manager' | 'staff'
}

export interface BoardOrder {
  id: string
  number: string
  status: string
  totalCentavos: number
  placedAt: string
}

export interface AnalyticsTotals {
  ordersPlaced: number
  ordersCompleted: number
  gmvCentavos: number
}

export class MerchantAgent {
  private constructor(
    readonly http: HttpClient,
    readonly user: { id: string; phone: string },
    readonly memberships: Membership[],
  ) {}

  static async login(baseUrl: string, phone: string): Promise<MerchantAgent> {
    const cached = await readSession(baseUrl, phone)
    if (cached) {
      const http = new HttpClient(baseUrl, cached)
      try {
        const me = await http.request<{
          user: { id: string; phone: string }
          memberships: Membership[]
        }>('GET', '/api/v1/auth/me')
        return new MerchantAgent(http, me.body.user, me.body.memberships)
      } catch {
        // Fall through to a fresh OTP login.
      }
    }

    const http = new HttpClient(baseUrl)
    const otp = await http.request<{ challengeId: string; devCode?: string | null }>(
      'POST',
      '/api/v1/auth/otp',
      { phone },
    )
    const devCode = otp.body.devCode
    if (!devCode) {
      throw new Error(
        'The API did not return a dev OTP. Staging needs AUTH_ALLOW_DEV_OTP=true and AUTH_EXPOSE_DEV_OTP=true.',
      )
    }

    const verified = await http.request<{
      sessionToken: string
      user: { id: string; phone: string }
      memberships: Membership[]
    }>('POST', '/api/v1/auth/verify', {
      challengeId: otp.body.challengeId,
      code: devCode,
      client: 'mobile',
    })

    http.setToken(verified.body.sessionToken)
    await writeSession(baseUrl, phone, verified.body.sessionToken)
    return new MerchantAgent(http, verified.body.user, verified.body.memberships)
  }

  membership(slug: string): Membership | null {
    return this.memberships.find((membership) => membership.businessSlug === slug) ?? null
  }

  async onboard(input: {
    businessName: string
    slug: string
    vertical: 'food' | 'aircon' | 'lpg'
  }): Promise<{ business: { id: string; slug: string } }> {
    const result = await this.http.request<{ business: { id: string; slug: string } }>(
      'POST',
      '/api/v1/onboarding',
      input,
    )
    this.memberships.push({
      tenantId: '',
      businessId: result.body.business.id,
      businessSlug: result.body.business.slug,
      businessName: input.businessName,
      vertical: input.vertical,
      role: 'owner',
    })
    return result.body
  }

  async orders(businessId: string): Promise<{ order: BoardOrder; lines: unknown[] }[]> {
    const result = await this.http.request<{
      orders: { order: BoardOrder; lines: unknown[] }[]
    }>('GET', `/api/v1/merchant/orders?businessId=${encodeURIComponent(businessId)}`)
    return result.body.orders
  }

  async transition(businessId: string, orderId: string, to: string): Promise<void> {
    await this.http.request('POST', `/api/v1/merchant/orders/${orderId}/transition`, {
      businessId,
      to,
    })
  }

  async cashReceived(businessId: string, orderId: string): Promise<void> {
    await this.http.request('POST', `/api/v1/merchant/orders/${orderId}/cash-received`, {
      businessId,
    })
  }

  async analytics(businessId: string, days = 7): Promise<AnalyticsTotals> {
    const result = await this.http.request<{ totals: AnalyticsTotals }>(
      'GET',
      `/api/v1/merchant/analytics?businessId=${encodeURIComponent(businessId)}&days=${days}`,
    )
    return result.body.totals
  }

  async catalog(businessId: string): Promise<{
    categories: { id: string; name: string; items: { id: string; name: string }[] }[]
    uncategorized: { id: string; name: string }[]
  }> {
    const result = await this.http.request<{
      categories: { id: string; name: string; items: { id: string; name: string }[] }[]
      uncategorized: { id: string; name: string }[]
    }>('GET', `/api/v1/catalog?businessId=${encodeURIComponent(businessId)}`)
    return result.body
  }

  async createCategory(businessId: string, name: string): Promise<{ id: string }> {
    const result = await this.http.request<{ category: { id: string } }>(
      'POST',
      '/api/v1/catalog/categories',
      { businessId, name },
    )
    return result.body.category
  }

  async createItem(input: {
    businessId: string
    categoryId: string | null
    name: string
    priceCentavos: number
    unit?: string
  }): Promise<{ id: string }> {
    const result = await this.http.request<{ item: { id: string } }>(
      'POST',
      '/api/v1/catalog/items',
      { ...input, unit: input.unit ?? 'order' },
    )
    return result.body.item
  }

  async theme(businessId: string): Promise<{ published: { version: number } | null }> {
    const result = await this.http.request<{ published: { version: number } | null }>(
      'GET',
      `/api/v1/merchant/theme?businessId=${encodeURIComponent(businessId)}`,
    )
    return result.body
  }

  async publishTheme(businessId: string, presetId = 'ferrari'): Promise<{ version: number }> {
    const result = await this.http.request<{ theme: { version: number } }>(
      'POST',
      '/api/v1/merchant/theme/publish',
      { businessId, presetId },
    )
    return result.body.theme
  }
}

const SESSION_FILE = resolve(process.cwd(), '.sim-session.json')

interface CachedSession {
  baseUrl: string
  phone: string
  token: string
}

async function readSession(baseUrl: string, phone: string): Promise<string | null> {
  try {
    const parsed = JSON.parse(await readFile(SESSION_FILE, 'utf8')) as CachedSession
    if (parsed.baseUrl === baseUrl && parsed.phone === phone && parsed.token) {
      return parsed.token
    }
  } catch {
    // No cache is normal.
  }
  return null
}

async function writeSession(baseUrl: string, phone: string, token: string): Promise<void> {
  const payload: CachedSession = { baseUrl, phone, token }
  await writeFile(SESSION_FILE, `${JSON.stringify(payload)}\n`, { mode: 0o600, encoding: 'utf8' })
}
