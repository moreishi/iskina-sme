import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { createDb } from './client'

const here = dirname(fileURLToPath(import.meta.url))

async function main() {
  const { db, pool } = createDb()
  try {
    await migrate(db, { migrationsFolder: resolve(here, '../drizzle') })
    console.log('Migrations applied.')
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
