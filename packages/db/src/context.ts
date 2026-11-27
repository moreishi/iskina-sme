import { sql } from 'drizzle-orm'
import { type Database, getDb } from './client'

/**
 * Every tenant-owned query runs inside this transaction so `app.tenant_id` is
 * set for RLS. The repository `where` clause is still mandatory — the policy is
 * the second wall, not the first.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Database) => Promise<T>,
): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`)
    return fn(tx)
  })
}

/** Session resolution needs membership rows across tenants for one user. */
export async function withUser<T>(userId: string, fn: (tx: Database) => Promise<T>): Promise<T> {
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.user_id', ${userId}, true)`)
    return fn(tx)
  })
}
