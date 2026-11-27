import { and, eq, sql } from 'drizzle-orm'
import { getDb } from '../client'
import { withTenant } from '../context'
import { type ApiKey, apiKeys } from '../schema'

export interface CreateApiKeyInput {
  tenantId: string
  businessId: string | null
  name: string
  prefix: string
  keyHash: string
  env: 'test' | 'live'
  scopes: readonly string[]
  createdBy: string
}

export type ApiKeyView = Omit<ApiKey, 'keyHash'>

export async function createApiKeyRecord(input: CreateApiKeyInput): Promise<ApiKeyView> {
  const row = await withTenant(input.tenantId, async (tx) => {
    const rows = await tx
      .insert(apiKeys)
      .values({
        tenantId: input.tenantId,
        businessId: input.businessId,
        name: input.name,
        prefix: input.prefix,
        keyHash: input.keyHash,
        env: input.env,
        scopes: [...input.scopes],
        createdBy: input.createdBy,
      })
      .returning()
    return rows[0]
  })
  if (!row) throw new Error('api key insert returned no row')
  const { keyHash: _keyHash, ...view } = row
  return view
}

export async function listApiKeys(tenantId: string): Promise<ApiKeyView[]> {
  const rows = await withTenant(tenantId, (tx) =>
    tx.select().from(apiKeys).where(eq(apiKeys.tenantId, tenantId)),
  )
  return rows.map(({ keyHash: _keyHash, ...view }) => view)
}

export async function revokeApiKey(tenantId: string, keyId: string): Promise<boolean> {
  const rows = await withTenant(tenantId, (tx) =>
    tx
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.tenantId, tenantId)))
      .returning({ id: apiKeys.id }),
  )
  return rows.length > 0
}

/**
 * Channel auth looks a key up by hash before any tenant is known. The RLS
 * policy allows exactly this row via `app.api_key_hash`, so the lookup cannot
 * become a cross-tenant read.
 */
export async function findApiKeyByHash(keyHash: string): Promise<ApiKey | null> {
  const db = getDb()
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.api_key_hash', ${keyHash}, true)`)
    const rows = await tx.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash)).limit(1)
    return rows[0] ?? null
  })
}

export async function touchApiKey(keyId: string): Promise<void> {
  const db = getDb()
  await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, keyId))
}
