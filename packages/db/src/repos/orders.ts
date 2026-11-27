import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { withTenant } from '../context'
import {
  type Customer,
  customers,
  type Order,
  type OrderEvent,
  type OrderLine,
  orderEvents,
  orderLines,
  orders,
} from '../schema'

export interface CustomerInput {
  name: string | null
  phone: string
  hatodUserId: string | null
}

export interface CreateOrderInput {
  tenantId: string
  businessId: string
  customer: CustomerInput
  number: string
  vertical: 'food' | 'aircon' | 'lpg'
  kind: 'delivery' | 'booking'
  channel: 'hatod' | 'merchant' | 'manual'
  subtotalCentavos: number
  deliveryFeeCentavos: number
  totalCentavos: number
  contactName: string | null
  contactPhone: string
  address: string | null
  lat: number | null
  lng: number | null
  scheduledAt: Date | null
  notes: string | null
  intake: Record<string, unknown>
  idempotencyKey: string | null
  lines: {
    itemId: string | null
    name: string
    unitPriceCentavos: number
    quantity: number
  }[]
}

export interface OrderWithLines {
  order: Order
  lines: OrderLine[]
}

export async function findCustomerByPhone(
  tenantId: string,
  businessId: string,
  phone: string,
): Promise<Customer | null> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(customers)
      .where(and(eq(customers.businessId, businessId), eq(customers.phone, phone)))
      .limit(1)
    return rows[0] ?? null
  })
}

export async function createOrder(input: CreateOrderInput): Promise<OrderWithLines> {
  return withTenant(input.tenantId, async (tx) => {
    const customerRows = await tx
      .insert(customers)
      .values({
        tenantId: input.tenantId,
        businessId: input.businessId,
        name: input.customer.name,
        phone: input.customer.phone,
        hatodUserId: input.customer.hatodUserId,
      })
      .onConflictDoNothing({ target: [customers.businessId, customers.phone] })
      .returning()

    let customer = customerRows[0]
    if (!customer) {
      const existing = await tx
        .select()
        .from(customers)
        .where(
          and(
            eq(customers.businessId, input.businessId),
            eq(customers.phone, input.customer.phone),
          ),
        )
        .limit(1)
      customer = existing[0]
    }
    if (!customer) throw new Error('customer upsert returned no row')

    const orderRows = await tx
      .insert(orders)
      .values({
        tenantId: input.tenantId,
        businessId: input.businessId,
        customerId: customer.id,
        number: input.number,
        vertical: input.vertical,
        kind: input.kind,
        channel: input.channel,
        subtotalCentavos: input.subtotalCentavos,
        deliveryFeeCentavos: input.deliveryFeeCentavos,
        totalCentavos: input.totalCentavos,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        address: input.address,
        lat: input.lat,
        lng: input.lng,
        scheduledAt: input.scheduledAt,
        notes: input.notes,
        intake: input.intake,
        idempotencyKey: input.idempotencyKey,
      })
      .returning()
    const order = orderRows[0]
    if (!order) throw new Error('order insert returned no row')

    const lineRows = await tx
      .insert(orderLines)
      .values(
        input.lines.map((line) => ({
          tenantId: input.tenantId,
          orderId: order.id,
          itemId: line.itemId,
          name: line.name,
          unitPriceCentavos: line.unitPriceCentavos,
          quantity: line.quantity,
          lineTotalCentavos: line.unitPriceCentavos * line.quantity,
        })),
      )
      .returning()

    await tx.insert(orderEvents).values({
      tenantId: input.tenantId,
      orderId: order.id,
      fromStatus: null,
      toStatus: 'PLACED',
      actorType: input.channel === 'hatod' ? 'customer' : 'merchant',
      note: `Order placed via ${input.channel}`,
    })

    return { order, lines: lineRows }
  })
}

export async function findOrderByIdempotencyKey(
  tenantId: string,
  businessId: string,
  key: string,
): Promise<OrderWithLines | null> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.businessId, businessId), eq(orders.idempotencyKey, key)))
      .limit(1)
    const order = rows[0]
    if (!order) return null
    const lines = await tx.select().from(orderLines).where(eq(orderLines.orderId, order.id))
    return { order, lines }
  })
}

export async function getOrderById(
  tenantId: string,
  businessId: string,
  orderId: string,
): Promise<{ order: Order; lines: OrderLine[]; events: OrderEvent[] } | null> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.tenantId, tenantId),
          eq(orders.businessId, businessId),
        ),
      )
      .limit(1)
    const order = rows[0]
    if (!order) return null
    const lines = await tx
      .select()
      .from(orderLines)
      .where(eq(orderLines.orderId, order.id))
      .orderBy(asc(orderLines.name))
    const events = await tx
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(asc(orderEvents.createdAt))
    return { order, lines, events }
  })
}

export async function listOrders(
  tenantId: string,
  businessId: string,
  statuses?: readonly string[],
): Promise<OrderWithLines[]> {
  return withTenant(tenantId, async (tx) => {
    const filters = [eq(orders.tenantId, tenantId), eq(orders.businessId, businessId)]
    const rows = await tx
      .select()
      .from(orders)
      .where(and(...filters))
      .orderBy(desc(orders.placedAt))
      .limit(100)
    const filtered =
      statuses && statuses.length > 0
        ? rows.filter((order) => statuses.includes(order.status))
        : rows
    if (filtered.length === 0) return []
    const lines = await tx
      .select()
      .from(orderLines)
      .where(
        inArray(
          orderLines.orderId,
          filtered.map((order) => order.id),
        ),
      )
    const byOrder = new Map<string, OrderLine[]>()
    for (const line of lines) {
      const bucket = byOrder.get(line.orderId) ?? []
      bucket.push(line)
      byOrder.set(line.orderId, bucket)
    }
    return filtered.map((order) => ({ order, lines: byOrder.get(order.id) ?? [] }))
  })
}

export interface ApplyTransitionInput {
  tenantId: string
  businessId: string
  orderId: string
  from: Exclude<Order['status'], never>
  to: Order['status']
  actorType: 'customer' | 'merchant' | 'rider' | 'system'
  actorId: string | null
  note: string | null
}

/**
 * The caller has already checked the state machine in `@iskina/core`.
 * `where status = from` makes a lost race a null result, never a double write.
 */
export async function applyTransition(input: ApplyTransitionInput): Promise<Order | null> {
  return withTenant(input.tenantId, async (tx) => {
    const rows = await tx
      .update(orders)
      .set({
        status: input.to,
        updatedAt: new Date(),
        ...(input.to === 'COMPLETED' ? { completedAt: new Date() } : {}),
      })
      .where(
        and(
          eq(orders.id, input.orderId),
          eq(orders.tenantId, input.tenantId),
          eq(orders.businessId, input.businessId),
          eq(orders.status, input.from),
        ),
      )
      .returning()
    const order = rows[0]
    if (!order) return null

    await tx.insert(orderEvents).values({
      tenantId: input.tenantId,
      orderId: input.orderId,
      fromStatus: input.from,
      toStatus: input.to,
      actorType: input.actorType,
      actorId: input.actorId,
      note: input.note,
    })

    return order
  })
}

export async function markCashReceived(
  tenantId: string,
  businessId: string,
  orderId: string,
): Promise<Order | null> {
  return withTenant(tenantId, async (tx) => {
    const rows = await tx
      .update(orders)
      .set({ cashReceivedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.tenantId, tenantId),
          eq(orders.businessId, businessId),
          inArray(orders.status, ['DELIVERED', 'COMPLETED']),
        ),
      )
      .returning()
    return rows[0] ?? null
  })
}
