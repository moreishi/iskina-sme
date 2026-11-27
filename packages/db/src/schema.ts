import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const tenantStatus = pgEnum('tenant_status', ['active', 'suspended'])

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    timezone: text('timezone').default('Asia/Manila').notNull(),
    status: tenantStatus('status').default('active').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [uniqueIndex('tenants_slug_uq').on(t.slug), index('tenants_status_idx').on(t.status)],
)

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
