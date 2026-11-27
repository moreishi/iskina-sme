import { sql } from 'drizzle-orm'
import { getDb } from '../client'

export interface Storefront {
  id: string
  tenantId: string
  name: string
  slug: string
  vertical: 'food' | 'aircon' | 'lpg'
  lat: number | null
  lng: number | null
  timezone: string
}

interface StorefrontRow {
  id: string
  tenant_id: string
  name: string
  slug: string
  vertical: string
  lat: number | string | null
  lng: number | string | null
  timezone: string
}

function map(row: StorefrontRow): Storefront {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    name: row.name,
    slug: row.slug,
    vertical: row.vertical as Storefront['vertical'],
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
    timezone: row.timezone,
  }
}

/** Cross-tenant read via SECURITY DEFINER; only public columns leave the server. */
export async function listStorefronts(limit = 50): Promise<Storefront[]> {
  const result = await getDb().execute(
    sql`select * from storefront_directory(${Math.min(200, Math.max(1, limit))})`,
  )
  return (result.rows as unknown as StorefrontRow[]).map(map)
}

export async function getStorefrontBySlug(slug: string): Promise<Storefront | null> {
  const result = await getDb().execute(sql`select * from storefront_by_slug(${slug})`)
  const rows = result.rows as unknown as StorefrontRow[]
  return rows[0] ? map(rows[0]) : null
}

export async function getStorefrontById(id: string): Promise<Storefront | null> {
  const result = await getDb().execute(sql`select * from storefront_by_id(${id})`)
  const rows = result.rows as unknown as StorefrontRow[]
  return rows[0] ? map(rows[0]) : null
}
