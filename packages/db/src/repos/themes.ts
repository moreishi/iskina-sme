import { and, desc, eq, sql } from 'drizzle-orm'
import { withTenant } from '../context'
import { type ThemeVersion, themeVersions } from '../schema'

export async function getPublishedTheme(
  tenantId: string,
  businessId: string,
): Promise<ThemeVersion | null> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(themeVersions)
      .where(and(eq(themeVersions.tenantId, tenantId), eq(themeVersions.businessId, businessId)))
      .orderBy(desc(themeVersions.version))
      .limit(1)
    return rows[0] ?? null
  })
}

export async function listThemeVersions(
  tenantId: string,
  businessId: string,
  limit = 10,
): Promise<ThemeVersion[]> {
  return withTenant(tenantId, (tx) =>
    tx
      .select()
      .from(themeVersions)
      .where(and(eq(themeVersions.tenantId, tenantId), eq(themeVersions.businessId, businessId)))
      .orderBy(desc(themeVersions.version))
      .limit(Math.min(50, Math.max(1, limit))),
  )
}

/**
 * Versions are assigned here, under a row lock on the business, so two tabs
 * publishing at once get v2 and v3 rather than both claiming v2.
 */
export async function publishTheme(input: {
  tenantId: string
  businessId: string
  manifest: unknown
  publishedBy: string
}): Promise<ThemeVersion> {
  return withTenant(input.tenantId, async (tx) => {
    await tx.execute(sql`select id from businesses where id = ${input.businessId} for update`)

    const maxRows = await tx
      .select({ max: sql<number>`coalesce(max(${themeVersions.version}), 0)` })
      .from(themeVersions)
      .where(eq(themeVersions.businessId, input.businessId))
    const nextVersion = Number(maxRows[0]?.max ?? 0) + 1

    const manifest =
      typeof input.manifest === 'object' && input.manifest !== null
        ? { ...(input.manifest as Record<string, unknown>), version: nextVersion }
        : input.manifest

    const rows = await tx
      .insert(themeVersions)
      .values({
        tenantId: input.tenantId,
        businessId: input.businessId,
        version: nextVersion,
        manifest,
        publishedBy: input.publishedBy,
      })
      .returning()
    const row = rows[0]
    if (!row) throw new Error('theme publish returned no row')
    return row
  })
}
