import { randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { getDb } from '../client'
import { auditLogs, type Business, businesses, memberships, type Tenant, tenants } from '../schema'

export interface CreateTenantInput {
  userId: string
  businessName: string
  tenantName?: string
  slug: string
  vertical: 'food' | 'aircon' | 'lpg'
  timezone?: string
  ip?: string | null
  userAgent?: string | null
}

export interface CreatedTenant {
  tenant: Tenant
  business: Business
}

/**
 * Tenant + first business + owner membership + audit row in one transaction.
 * The tenant context is set before the business insert so RLS policies apply.
 */
export async function createTenantWithOwner(input: CreateTenantInput): Promise<CreatedTenant> {
  const db = getDb()
  return db.transaction(async (tx) => {
    const tenantId = randomUUID()
    // Set tenant context before inserting so the tenants RLS WITH CHECK passes.
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`)

    const tenantRows = await tx
      .insert(tenants)
      .values({
        id: tenantId,
        name: input.tenantName?.trim() || input.businessName.trim(),
        slug: input.slug,
        timezone: input.timezone ?? 'Asia/Manila',
      })
      .returning()
    const tenant = tenantRows[0]
    if (!tenant) throw new Error('tenant insert returned no row')

    const businessRows = await tx
      .insert(businesses)
      .values({
        tenantId: tenant.id,
        name: input.businessName.trim(),
        slug: input.slug,
        vertical: input.vertical,
        timezone: input.timezone ?? 'Asia/Manila',
      })
      .returning()
    const business = businessRows[0]
    if (!business) throw new Error('business insert returned no row')

    await tx.insert(memberships).values({
      tenantId: tenant.id,
      businessId: business.id,
      userId: input.userId,
      role: 'owner',
    })

    await tx.insert(auditLogs).values({
      tenantId: tenant.id,
      actorType: 'user',
      actorId: input.userId,
      action: 'tenant.created',
      entityType: 'tenant',
      entityId: tenant.id,
      metadata: { businessId: business.id, slug: business.slug, vertical: business.vertical },
      ip: input.ip ?? null,
      userAgent: input.userAgent ?? null,
    })

    return { tenant, business }
  })
}
