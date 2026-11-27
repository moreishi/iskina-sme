import { eq } from 'drizzle-orm'
import { withTenant, withUser } from '../context'
import { businesses, memberships, tenants } from '../schema'

export interface MembershipView {
  tenantId: string
  tenantName: string
  tenantSlug: string
  businessId: string | null
  businessName: string | null
  businessSlug: string | null
  vertical: 'food' | 'aircon' | 'lpg' | null
  role: 'owner' | 'manager' | 'staff'
}

/**
 * Membership bootstrap runs before a tenant context exists. The user policy on
 * `memberships` allows the cross-tenant read for this one user; businesses are
 * then loaded per tenant under that tenant's context, never globally.
 */
export async function listMembershipsForUser(userId: string): Promise<MembershipView[]> {
  const rows = await withUser(userId, (tx) =>
    tx
      .select({
        tenantId: memberships.tenantId,
        tenantName: tenants.name,
        tenantSlug: tenants.slug,
        businessId: memberships.businessId,
        role: memberships.role,
      })
      .from(memberships)
      .innerJoin(tenants, eq(tenants.id, memberships.tenantId))
      .where(eq(memberships.userId, userId)),
  )

  if (rows.length === 0) return []

  const tenantIds = [...new Set(rows.map((row) => row.tenantId))]
  const businessesByTenant = new Map<
    string,
    { id: string; name: string; slug: string; vertical: 'food' | 'aircon' | 'lpg' }[]
  >()
  for (const tenantId of tenantIds) {
    const tenantBusinesses = await withTenant(tenantId, (tx) =>
      tx
        .select({
          id: businesses.id,
          name: businesses.name,
          slug: businesses.slug,
          vertical: businesses.vertical,
        })
        .from(businesses)
        .where(eq(businesses.tenantId, tenantId)),
    )
    businessesByTenant.set(tenantId, tenantBusinesses)
  }

  return rows.map((row) => {
    const business = row.businessId
      ? businessesByTenant.get(row.tenantId)?.find((candidate) => candidate.id === row.businessId)
      : undefined
    return {
      tenantId: row.tenantId,
      tenantName: row.tenantName,
      tenantSlug: row.tenantSlug,
      businessId: row.businessId,
      businessName: business?.name ?? null,
      businessSlug: business?.slug ?? null,
      vertical: business?.vertical ?? null,
      role: row.role,
    }
  })
}
