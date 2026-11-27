import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { env } from './env'
import * as schema from './schema'

export type Database = NodePgDatabase<typeof schema>

export interface DbHandle {
  db: Database
  pool: Pool
}

export function createDb(connectionString = env.databaseUrl, max = 10): DbHandle {
  const pool = new Pool({ connectionString, max })
  const db = drizzle(pool, { schema })
  return { db, pool }
}

const globalForDb = globalThis as unknown as { __iskinaSmeDb?: DbHandle }

export function getDb(): Database {
  if (!globalForDb.__iskinaSmeDb) {
    globalForDb.__iskinaSmeDb = createDb()
  }
  return globalForDb.__iskinaSmeDb.db
}

export function getPool(): Pool {
  if (!globalForDb.__iskinaSmeDb) {
    globalForDb.__iskinaSmeDb = createDb()
  }
  return globalForDb.__iskinaSmeDb.pool
}

export { schema }
