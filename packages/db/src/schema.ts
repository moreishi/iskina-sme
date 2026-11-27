import { sql } from 'drizzle-orm'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const tenantStatus = pgEnum('tenant_status', ['active', 'suspended'])
export const businessStatus = pgEnum('business_status', ['draft', 'active', 'suspended'])
export const vertical = pgEnum('vertical', ['food', 'aircon', 'lpg'])
export const membershipRole = pgEnum('membership_role', ['owner', 'manager', 'staff'])
export const keyEnv = pgEnum('key_env', ['test', 'live'])
export const auditActorType = pgEnum('audit_actor_type', ['user', 'api_key', 'system'])
export const orderKind = pgEnum('order_kind', ['delivery', 'booking'])
export const orderStatus = pgEnum('order_status', [
  'PLACED',
  'ACCEPTED',
  'PREPARING',
  'READY',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
  'EXPIRED',
])
export const orderChannel = pgEnum('order_channel', ['hatod', 'merchant', 'manual'])
export const orderActor = pgEnum('order_actor', ['customer', 'merchant', 'rider', 'system'])
export const devicePlatform = pgEnum('device_platform', ['android', 'ios', 'web'])

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    timezone: text('timezone').default('Asia/Manila').notNull(),
    status: tenantStatus('status').default('active').notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('tenants_slug_uq').on(t.slug), index('tenants_status_idx').on(t.status)],
)

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: text('phone').notNull(),
    name: text('name'),
    email: text('email'),
    ...timestamps,
  },
  (t) => [uniqueIndex('users_phone_uq').on(t.phone)],
)

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('sessions_token_hash_uq').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
  ],
)

export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    phone: text('phone').notNull(),
    provider: text('provider').notNull(),
    providerId: text('provider_id'),
    codeHash: text('code_hash'),
    attempts: integer('attempts').default(0).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('otp_challenges_phone_idx').on(t.phone, t.createdAt),
    index('otp_challenges_expires_idx').on(t.expiresAt),
  ],
)

export const businesses = pgTable(
  'businesses',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    vertical: vertical('vertical').notNull(),
    status: businessStatus('status').default('active').notNull(),
    timezone: text('timezone').default('Asia/Manila').notNull(),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    /** Partial override of the vertical preset; null means use the preset. */
    verticalConfig: jsonb('vertical_config'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('businesses_slug_uq').on(t.slug),
    index('businesses_tenant_idx').on(t.tenantId),
  ],
)

export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: membershipRole('role').default('owner').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('memberships_user_tenant_business_uq').on(t.userId, t.tenantId, t.businessId),
    index('memberships_tenant_idx').on(t.tenantId),
    index('memberships_user_idx').on(t.userId),
  ],
)

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id').references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    prefix: text('prefix').notNull(),
    keyHash: text('key_hash').notNull(),
    env: keyEnv('env').notNull(),
    scopes: text('scopes').array().notNull().default(sql`'{}'::text[]`),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('api_keys_key_hash_uq').on(t.keyHash),
    index('api_keys_tenant_idx').on(t.tenantId),
  ],
)

export const catalogCategories = pgTable(
  'catalog_categories',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    active: boolean('active').default(true).notNull(),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('catalog_categories_business_name_uq').on(t.businessId, t.name),
    index('catalog_categories_tenant_idx').on(t.tenantId),
    index('catalog_categories_business_idx').on(t.businessId),
  ],
)

export const catalogItems = pgTable(
  'catalog_items',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => catalogCategories.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    description: text('description'),
    priceCentavos: integer('price_centavos').notNull(),
    unit: text('unit').default('piece').notNull(),
    available: boolean('available').default(true).notNull(),
    stockCount: integer('stock_count'),
    imageUrl: text('image_url'),
    metadata: jsonb('metadata').default({}).notNull(),
    sortOrder: integer('sort_order').default(0).notNull(),
    ...timestamps,
  },
  (t) => [
    index('catalog_items_tenant_idx').on(t.tenantId),
    index('catalog_items_business_idx').on(t.businessId),
    index('catalog_items_category_idx').on(t.categoryId),
  ],
)

export const customers = pgTable(
  'customers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    name: text('name'),
    phone: text('phone').notNull(),
    hatodUserId: text('hatod_user_id'),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('customers_business_phone_uq').on(t.businessId, t.phone),
    index('customers_tenant_idx').on(t.tenantId),
  ],
)

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    number: text('number').notNull(),
    vertical: vertical('vertical').notNull(),
    kind: orderKind('kind').notNull(),
    status: orderStatus('status').default('PLACED').notNull(),
    channel: orderChannel('channel').notNull(),
    subtotalCentavos: integer('subtotal_centavos').notNull(),
    deliveryFeeCentavos: integer('delivery_fee_centavos').notNull(),
    totalCentavos: integer('total_centavos').notNull(),
    contactName: text('contact_name'),
    contactPhone: text('contact_phone').notNull(),
    address: text('address'),
    lat: doublePrecision('lat'),
    lng: doublePrecision('lng'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    notes: text('notes'),
    intake: jsonb('intake').default({}).notNull(),
    paymentMethod: text('payment_method').default('cash').notNull(),
    cashReceivedAt: timestamp('cash_received_at', { withTimezone: true }),
    idempotencyKey: text('idempotency_key'),
    placedAt: timestamp('placed_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex('orders_business_idempotency_uq').on(t.businessId, t.idempotencyKey),
    uniqueIndex('orders_number_uq').on(t.number),
    index('orders_tenant_idx').on(t.tenantId),
    index('orders_business_status_idx').on(t.businessId, t.status),
  ],
)

export const orderLines = pgTable(
  'order_lines',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    itemId: uuid('item_id').references(() => catalogItems.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    unitPriceCentavos: integer('unit_price_centavos').notNull(),
    quantity: integer('quantity').notNull(),
    lineTotalCentavos: integer('line_total_centavos').notNull(),
  },
  (t) => [
    index('order_lines_tenant_idx').on(t.tenantId),
    index('order_lines_order_idx').on(t.orderId),
  ],
)

export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    fromStatus: orderStatus('from_status'),
    toStatus: orderStatus('to_status').notNull(),
    actorType: orderActor('actor_type').notNull(),
    actorId: text('actor_id'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('order_events_tenant_idx').on(t.tenantId),
    index('order_events_order_idx').on(t.orderId, t.createdAt),
  ],
)

export const deviceTokens = pgTable(
  'device_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    platform: devicePlatform('platform').notNull(),
    token: text('token').notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('device_tokens_token_uq').on(t.token),
    index('device_tokens_business_idx').on(t.businessId),
  ],
)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    actorType: auditActorType('actor_type').notNull(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id'),
    metadata: jsonb('metadata').default({}).notNull(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('audit_logs_tenant_created_idx').on(t.tenantId, t.createdAt),
    index('audit_logs_action_idx').on(t.action),
  ],
)

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
export type User = typeof users.$inferSelect
export type Business = typeof businesses.$inferSelect
export type Membership = typeof memberships.$inferSelect
export type ApiKey = typeof apiKeys.$inferSelect
export type CatalogCategory = typeof catalogCategories.$inferSelect
export type CatalogItem = typeof catalogItems.$inferSelect
export type Customer = typeof customers.$inferSelect
export type Order = typeof orders.$inferSelect
export type OrderLine = typeof orderLines.$inferSelect
export type OrderEvent = typeof orderEvents.$inferSelect
export type DeviceToken = typeof deviceTokens.$inferSelect
export type AuditLog = typeof auditLogs.$inferSelect
