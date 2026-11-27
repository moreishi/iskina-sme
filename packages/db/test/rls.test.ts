import { randomBytes, randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const adminUrl = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL
if (!adminUrl) throw new Error('DATABASE_ADMIN_URL or DATABASE_URL is required')

const suffix = randomBytes(4).toString('hex')
const role = `rls_probe_${suffix}`
const password = `probe_${suffix}`

const tenantA = randomUUID()
const tenantB = randomUUID()
const businessA = randomUUID()
const businessB = randomUUID()
const userA = randomUUID()
const keyA = randomUUID()
const keyB = randomUUID()
const categoryA = randomUUID()
const itemA = randomUUID()
const customerA = randomUUID()
const orderA = randomUUID()
const hashA = `hash_a_${suffix}`
const hashB = `hash_b_${suffix}`

let admin: Pool
let probe: Pool

function withCredentials(connectionString: string, user: string, pass: string): string {
  const url = new URL(connectionString)
  url.username = user
  url.password = pass
  return url.toString()
}

async function inTenant<T>(
  tenantId: string,
  fn: (client: import('pg').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await probe.connect()
  try {
    await client.query('begin')
    await client.query(`select set_config('app.tenant_id', $1, true)`, [tenantId])
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}

beforeAll(async () => {
  admin = new Pool({ connectionString: adminUrl })

  await admin.query(
    `create role ${role} login password '${password}' nosuperuser nocreatedb nocreaterole nobypassrls`,
  )
  await admin.query(`grant usage on schema public to ${role}`)
  await admin.query(
    `grant select, insert, update, delete on all tables in schema public to ${role}`,
  )

  await admin.query(
    `insert into tenants (id, name, slug) values ($1, 'RLS A', $2), ($3, 'RLS B', $4)`,
    [tenantA, `rls-a-${suffix}`, tenantB, `rls-b-${suffix}`],
  )
  await admin.query(
    `insert into businesses (id, tenant_id, name, slug, vertical) values
      ($1, $2, 'Business A', $3, 'food'),
      ($4, $5, 'Business B', $6, 'lpg')`,
    [businessA, tenantA, `biz-a-${suffix}`, businessB, tenantB, `biz-b-${suffix}`],
  )
  await admin.query(`insert into users (id, phone) values ($1, $2)`, [
    userA,
    `+63917${suffix.slice(0, 6).padEnd(6, '0')}`,
  ])
  await admin.query(
    `insert into memberships (tenant_id, business_id, user_id, role) values ($1, $2, $3, 'owner')`,
    [tenantA, businessA, userA],
  )
  await admin.query(
    `insert into api_keys (id, tenant_id, name, prefix, key_hash, env) values
      ($1, $2, 'Key A', 'sk_test_a', $3, 'test'),
      ($4, $5, 'Key B', 'sk_test_b', $6, 'test')`,
    [keyA, tenantA, hashA, keyB, tenantB, hashB],
  )
  await admin.query(
    `insert into catalog_categories (id, tenant_id, business_id, name) values ($1, $2, $3, 'Meals')`,
    [categoryA, tenantA, businessA],
  )
  await admin.query(
    `insert into catalog_items (id, tenant_id, business_id, category_id, name, price_centavos)
     values ($1, $2, $3, $4, 'Adobo', 12000)`,
    [itemA, tenantA, businessA, categoryA],
  )
  await admin.query(
    `insert into customers (id, tenant_id, business_id, name, phone)
     values ($1, $2, $3, 'RLS Customer', '+639170009999')`,
    [customerA, tenantA, businessA],
  )
  await admin.query(
    `insert into orders (id, tenant_id, business_id, customer_id, number, vertical, kind, channel,
       subtotal_centavos, delivery_fee_centavos, total_centavos, contact_phone)
     values ($1, $2, $3, $4, $5, 'food', 'delivery', 'hatod', 12000, 0, 12000, '+639170009999')`,
    [orderA, tenantA, businessA, customerA, `SME-RLS-${suffix}`],
  )

  probe = new Pool({ connectionString: withCredentials(adminUrl, role, password) })
})

afterAll(async () => {
  await probe?.end()
  if (admin) {
    await admin.query(`delete from order_events where order_id = $1`, [orderA])
    await admin.query(`delete from order_lines where order_id = $1`, [orderA])
    await admin.query(`delete from orders where id = $1`, [orderA])
    await admin.query(`delete from customers where id = $1`, [customerA])
    await admin.query(`delete from catalog_items where id = $1`, [itemA])
    await admin.query(`delete from catalog_categories where id = $1`, [categoryA])
    await admin.query(`delete from api_keys where id in ($1, $2)`, [keyA, keyB])
    await admin.query(`delete from memberships where user_id = $1`, [userA])
    await admin.query(`delete from businesses where id in ($1, $2)`, [businessA, businessB])
    await admin.query(`delete from tenants where id in ($1, $2)`, [tenantA, tenantB])
    await admin.query(`delete from users where id = $1`, [userA])
    await admin.query(`drop owned by ${role}`)
    await admin.query(`drop role ${role}`)
    await admin.end()
  }
})

describe('row level security', () => {
  it('returns no tenant rows when no context is set', async () => {
    const { rows } = await probe.query('select id from businesses')
    expect(rows).toEqual([])
  })

  it('returns only the tenant in context', async () => {
    const rows = await inTenant(tenantA, async (client) => {
      const result = await client.query('select id from businesses order by id')
      return result.rows as { id: string }[]
    })
    expect(rows.map((row) => row.id)).toEqual([businessA])
  })

  it('cannot read another tenant even when asking for it', async () => {
    const rows = await inTenant(tenantA, async (client) => {
      const result = await client.query('select id from businesses where id = $1', [businessB])
      return result.rows
    })
    expect(rows).toEqual([])
  })

  it('scopes membership reads to the signed-in user', async () => {
    const client = await probe.connect()
    try {
      await client.query('begin')
      await client.query(`select set_config('app.user_id', $1, true)`, [userA])
      const { rows } = await client.query('select tenant_id from memberships')
      expect(rows).toEqual([{ tenant_id: tenantA }])
      await client.query('commit')
    } finally {
      client.release()
    }
  })

  it('resolves exactly the presented api key hash', async () => {
    const client = await probe.connect()
    try {
      await client.query('begin')
      await client.query(`select set_config('app.api_key_hash', $1, true)`, [hashA])
      const { rows } = await client.query('select id from api_keys order by id')
      expect(rows).toEqual([{ id: keyA }])
      await client.query('commit')
    } finally {
      client.release()
    }
  })

  it('hides api keys without a tenant or hash context', async () => {
    const { rows } = await probe.query('select id from api_keys')
    expect(rows).toEqual([])
  })

  it('isolates catalog items by tenant', async () => {
    const withoutContext = await probe.query('select id from catalog_items')
    expect(withoutContext.rows).toEqual([])

    const rows = await inTenant(tenantA, async (client) => {
      const result = await client.query('select id from catalog_items')
      return result.rows as { id: string }[]
    })
    expect(rows.map((row) => row.id)).toEqual([itemA])
  })

  it('isolates orders by tenant', async () => {
    const withoutContext = await probe.query('select id from orders')
    expect(withoutContext.rows).toEqual([])

    const rows = await inTenant(tenantA, async (client) => {
      const result = await client.query('select id from orders')
      return result.rows as { id: string }[]
    })
    expect(rows.map((row) => row.id)).toEqual([orderA])
  })

  it('blocks writes outside the tenant context', async () => {
    await expect(
      probe.query(
        `insert into businesses (tenant_id, name, slug, vertical) values ($1, 'Sneaky', $2, 'food')`,
        [tenantB, `sneaky-${suffix}`],
      ),
    ).rejects.toMatchObject({ code: '42501' })
  })
})
