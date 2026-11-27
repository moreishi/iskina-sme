import { getDb } from '@iskina/db'
import { sql } from 'drizzle-orm'
import { buildHealthResponse } from '@/lib/health'

export const dynamic = 'force-dynamic'

export async function GET() {
  let database: 'ok' | 'error' = 'error'
  try {
    await getDb().execute(sql`select 1`)
    database = 'ok'
  } catch {
    // The response carries the failure; logs must never include the DSN.
  }

  return Response.json(buildHealthResponse({ database }), {
    status: database === 'ok' ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  })
}
