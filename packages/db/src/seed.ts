import { sql } from 'drizzle-orm'
import { createDb } from './client'
import {
  businesses,
  catalogCategories,
  catalogItems,
  customers,
  memberships,
  orderEvents,
  orderLines,
  orders,
  tenants,
  users,
} from './schema'

const DEMO_OWNER_PHONE = '+639170000001'

interface SeedOrder {
  id: string
  customerId: string
  number: string
  kind: 'delivery' | 'booking'
  status: 'PLACED' | 'ACCEPTED'
  customerName: string
  customerPhone: string
  subtotalCentavos: number
  deliveryFeeCentavos: number
  totalCentavos: number
  address: string
  scheduledAt: Date | null
  intake: Record<string, unknown>
  lines: { id: string; itemId: string; name: string; unitPriceCentavos: number; quantity: number }[]
  events: { id: string; from: 'PLACED' | null; to: 'PLACED' | 'ACCEPTED' }[]
}

const DEMO = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    businessId: '11111111-1111-4111-8111-222222222222',
    name: "Aling Nena's Kitchen",
    slug: 'aling-nena',
    vertical: 'food' as const,
    categories: [
      {
        id: '11111111-1111-4111-8111-333333333331',
        name: 'Rice meals',
        items: [
          { id: '11111111-1111-4111-8111-444444444441', name: 'Chicken adobo', price: 12_000 },
          { id: '11111111-1111-4111-8111-444444444442', name: 'Lechon kawali', price: 15_000 },
        ],
      },
      {
        id: '11111111-1111-4111-8111-333333333332',
        name: 'Drinks',
        items: [
          { id: '11111111-1111-4111-8111-444444444443', name: "Sago't gulaman", price: 4_500 },
        ],
      },
    ],
  },
  {
    id: '22222222-2222-4222-8222-222222222221',
    businessId: '22222222-2222-4222-8222-222222222222',
    name: 'Cebu Cool Aircon Services',
    slug: 'cebu-cool',
    vertical: 'aircon' as const,
    categories: [
      {
        id: '22222222-2222-4222-8222-333333333331',
        name: 'Cleaning',
        items: [
          {
            id: '22222222-2222-4222-8222-444444444441',
            name: 'Split unit cleaning',
            price: 80_000,
          },
          {
            id: '22222222-2222-4222-8222-444444444442',
            name: 'Window unit cleaning',
            price: 50_000,
          },
        ],
      },
    ],
  },
  {
    id: '33333333-3333-4333-8333-333333333331',
    businessId: '33333333-3333-4333-8333-333333333332',
    name: 'Mactan LPG Trading',
    slug: 'mactan-lpg',
    vertical: 'lpg' as const,
    categories: [
      {
        id: '33333333-3333-4333-8333-333333333331',
        name: 'LPG',
        items: [
          { id: '33333333-3333-4333-8333-444444444441', name: '11kg tank exchange', price: 85_000 },
          { id: '33333333-3333-4333-8333-444444444442', name: '22kg refill', price: 160_000 },
        ],
      },
    ],
  },
]

const SEED_ORDERS: Record<string, SeedOrder[]> = {
  'aling-nena': [
    {
      id: '11111111-1111-4111-8111-555555555551',
      customerId: '11111111-1111-4111-8111-666666666661',
      number: 'SME-20261127-A1',
      kind: 'delivery',
      status: 'PLACED',
      customerName: 'Maria Santos',
      customerPhone: '+639171111111',
      subtotalCentavos: 16_500,
      deliveryFeeCentavos: 3_900,
      totalCentavos: 20_400,
      address: 'Unit 4, Lahug, Cebu City',
      scheduledAt: null,
      intake: {},
      lines: [
        {
          id: '11111111-1111-4111-8111-777777777771',
          itemId: '11111111-1111-4111-8111-444444444441',
          name: 'Chicken adobo',
          unitPriceCentavos: 12_000,
          quantity: 1,
        },
        {
          id: '11111111-1111-4111-8111-777777777772',
          itemId: '11111111-1111-4111-8111-444444444443',
          name: "Sago't gulaman",
          unitPriceCentavos: 4_500,
          quantity: 1,
        },
      ],
      events: [{ id: '11111111-1111-4111-8111-888888888881', from: null, to: 'PLACED' }],
    },
  ],
  'cebu-cool': [
    {
      id: '22222222-2222-4222-8222-555555555551',
      customerId: '22222222-2222-4222-8222-666666666661',
      number: 'SME-20261127-B1',
      kind: 'booking',
      status: 'ACCEPTED',
      customerName: 'Jose Lim',
      customerPhone: '+639172222222',
      subtotalCentavos: 80_000,
      deliveryFeeCentavos: 0,
      totalCentavos: 80_000,
      address: '12B Banilad, Cebu City',
      scheduledAt: new Date('2026-12-01T02:00:00.000Z'),
      intake: { unitCount: 2, unitType: 'split' },
      lines: [
        {
          id: '22222222-2222-4222-8222-777777777771',
          itemId: '22222222-2222-4222-8222-444444444441',
          name: 'Split unit cleaning',
          unitPriceCentavos: 80_000,
          quantity: 1,
        },
      ],
      events: [
        { id: '22222222-2222-4222-8222-888888888881', from: null, to: 'PLACED' },
        { id: '22222222-2222-4222-8222-888888888882', from: 'PLACED', to: 'ACCEPTED' },
      ],
    },
  ],
}

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

        for (const category of demo.categories) {
          await tx
            .insert(catalogCategories)
            .values({
              id: category.id,
              tenantId: demo.id,
              businessId: demo.businessId,
              name: category.name,
            })
            .onConflictDoNothing()

          for (const item of category.items) {
            await tx
              .insert(catalogItems)
              .values({
                id: item.id,
                tenantId: demo.id,
                businessId: demo.businessId,
                categoryId: category.id,
                name: item.name,
                priceCentavos: item.price,
                unit: 'order',
              })
              .onConflictDoNothing()
          }
        }

        for (const seed of SEED_ORDERS[demo.slug] ?? []) {
          await tx
            .insert(customers)
            .values({
              id: seed.customerId,
              tenantId: demo.id,
              businessId: demo.businessId,
              name: seed.customerName,
              phone: seed.customerPhone,
            })
            .onConflictDoNothing()

          await tx
            .insert(orders)
            .values({
              id: seed.id,
              tenantId: demo.id,
              businessId: demo.businessId,
              customerId: seed.customerId,
              number: seed.number,
              vertical: demo.vertical,
              kind: seed.kind,
              status: seed.status,
              channel: 'hatod',
              subtotalCentavos: seed.subtotalCentavos,
              deliveryFeeCentavos: seed.deliveryFeeCentavos,
              totalCentavos: seed.totalCentavos,
              contactName: seed.customerName,
              contactPhone: seed.customerPhone,
              address: seed.address,
              scheduledAt: seed.scheduledAt,
              intake: seed.intake,
            })
            .onConflictDoNothing()

          await tx
            .insert(orderLines)
            .values(
              seed.lines.map((line) => ({
                id: line.id,
                tenantId: demo.id,
                orderId: seed.id,
                itemId: line.itemId,
                name: line.name,
                unitPriceCentavos: line.unitPriceCentavos,
                quantity: line.quantity,
                lineTotalCentavos: line.unitPriceCentavos * line.quantity,
              })),
            )
            .onConflictDoNothing()

          await tx
            .insert(orderEvents)
            .values(
              seed.events.map((event) => ({
                id: event.id,
                tenantId: demo.id,
                orderId: seed.id,
                fromStatus: event.from,
                toStatus: event.to,
                actorType: event.from === null ? ('customer' as const) : ('merchant' as const),
                note: null,
              })),
            )
            .onConflictDoNothing()
        }
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
