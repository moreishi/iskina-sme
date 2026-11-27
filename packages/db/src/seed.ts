import { eq } from 'drizzle-orm'
import { createDb } from './client'
import { businesses, memberships, tenants, users } from './schema'

const DEMO = [
  {
    name: "Aling Nena's Kitchen",
    slug: 'aling-nena',
    vertical: 'food' as const,
  },
  {
    name: 'Cebu Cool Aircon Services',
    slug: 'cebu-cool',
    vertical: 'aircon' as const,
  },
  {
    name: 'Mactan LPG Trading',
    slug: 'mactan-lpg',
    vertical: 'lpg' as const,
  },
]

const DEMO_OWNER_PHONE = '+639170000001'

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
      (await db.select().from(users).where(eq(users.phone, DEMO_OWNER_PHONE)).limit(1))[0]

    for (const demo of DEMO) {
      const tenantRows = await db
        .insert(tenants)
        .values({ name: demo.name, slug: demo.slug, timezone: 'Asia/Manila' })
        .onConflictDoNothing({ target: tenants.slug })
        .returning()
      const tenant =
        tenantRows[0] ??
        (await db.select().from(tenants).where(eq(tenants.slug, demo.slug)).limit(1))[0]
      if (!tenant) throw new Error(`tenant ${demo.slug} missing after insert`)

      const businessRows = await db
        .insert(businesses)
        .values({
          tenantId: tenant.id,
          name: demo.name,
          slug: demo.slug,
          vertical: demo.vertical,
          timezone: 'Asia/Manila',
        })
        .onConflictDoNothing({ target: businesses.slug })
        .returning()
      const business =
        businessRows[0] ??
        (await db.select().from(businesses).where(eq(businesses.slug, demo.slug)).limit(1))[0]
      if (!business) throw new Error(`business ${demo.slug} missing after insert`)

      if (owner) {
        await db
          .insert(memberships)
          .values({
            tenantId: tenant.id,
            businessId: business.id,
            userId: owner.id,
            role: 'owner',
          })
          .onConflictDoNothing()
      }
    }

    const rows = await db.select().from(businesses)
    console.log(`Seeded ${rows.length} businesses.`)
    for (const row of rows) {
      console.log(`  ${row.slug.padEnd(16)} ${row.name} [${row.vertical}/${row.status}]`)
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
