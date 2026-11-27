import { sql } from 'drizzle-orm'
import { createDb } from './client'
import { businesses, memberships, tenants, users } from './schema'

const DEMO_OWNER_PHONE = '+639170000001'

const DEMO = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    businessId: '11111111-1111-4111-8111-222222222222',
    name: "Aling Nena's Kitchen",
    slug: 'aling-nena',
    vertical: 'food' as const,
  },
  {
    id: '22222222-2222-4222-8222-222222222221',
    businessId: '22222222-2222-4222-8222-222222222222',
    name: 'Cebu Cool Aircon Services',
    slug: 'cebu-cool',
    vertical: 'aircon' as const,
  },
  {
    id: '33333333-3333-4333-8333-333333333331',
    businessId: '33333333-3333-4333-8333-333333333332',
    name: 'Mactan LPG Trading',
    slug: 'mactan-lpg',
    vertical: 'lpg' as const,
  },
]

/**
 * Demo data for a fresh local/staging database. Runs as the app role, so each
 * tenant insert sets `app.tenant_id` first — the seed never bypasses RLS.
 */
async function main() {
  const { db, pool } = createDb()
  try {
    const ownerRows = await db
      .insert(users)
      .values({ phone: DEMO_OWNER_PHONE, name: 'Demo Owner' })
      .onConflictDoNothing({ target: users.phone })
      .returning()
    const owner =
      ownerRows[0] ??
      (await db.select().from(users).where(sql`${users.phone} = ${DEMO_OWNER_PHONE}`).limit(1))[0]

    if (!owner) throw new Error('demo owner missing after insert')

    await db.transaction(async (tx) => {
      for (const demo of DEMO) {
        await tx.execute(sql`select set_config('app.tenant_id', ${demo.id}, true)`)

        await tx
          .insert(tenants)
          .values({
            id: demo.id,
            name: demo.name,
            slug: demo.slug,
            timezone: 'Asia/Manila',
          })
          .onConflictDoNothing()

        await tx
          .insert(businesses)
          .values({
            id: demo.businessId,
            tenantId: demo.id,
            name: demo.name,
            slug: demo.slug,
            vertical: demo.vertical,
            timezone: 'Asia/Manila',
          })
          .onConflictDoNothing()

        await tx
          .insert(memberships)
          .values({
            tenantId: demo.id,
            businessId: demo.businessId,
            userId: owner.id,
            role: 'owner',
          })
          .onConflictDoNothing()
      }
    })

    console.log(`Seeded ${DEMO.length} businesses.`)
    for (const row of DEMO) {
      console.log(`  ${row.slug.padEnd(16)} ${row.name} [${row.vertical}/active]`)
    }
    console.log(`Demo owner: ${DEMO_OWNER_PHONE} (dev OTP code is shown at login)`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
