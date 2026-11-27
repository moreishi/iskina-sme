import { createDb } from './client'
import { tenants } from './schema'

const DEMO_TENANTS = [
  { name: "Aling Nena's Kitchen", slug: 'aling-nena', timezone: 'Asia/Manila' },
  { name: 'Cebu Cool Aircon Services', slug: 'cebu-cool', timezone: 'Asia/Manila' },
  { name: 'Mactan LPG Trading', slug: 'mactan-lpg', timezone: 'Asia/Manila' },
] as const

async function main() {
  const { db, pool } = createDb()
  try {
    for (const tenant of DEMO_TENANTS) {
      await db.insert(tenants).values(tenant).onConflictDoNothing({ target: tenants.slug })
    }
    const rows = await db.select().from(tenants)
    console.log(`Seeded tenants (${rows.length} total):`)
    for (const row of rows) {
      console.log(`  ${row.slug.padEnd(16)} ${row.name} [${row.status}]`)
    }
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
