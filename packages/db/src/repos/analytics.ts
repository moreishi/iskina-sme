import { sql } from 'drizzle-orm'
import { withTenant } from '../context'

export interface AnalyticsTotals {
  ordersPlaced: number
  ordersCompleted: number
  activeOrders: number
  ordersCancelled: number
  ordersRejected: number
  ordersExpired: number
  gmvCentavos: number
  netSalesCentavos: number
  deliveryFeeCentavos: number
  aovCentavos: number
  acceptanceRate: number | null
  prepP50Seconds: number | null
  prepP90Seconds: number | null
  fulfillmentP50Seconds: number | null
  fulfillmentP90Seconds: number | null
}

export interface AnalyticsSeriesPoint {
  day: string
  orders: number
  gmvCentavos: number
}

export interface AnalyticsItem {
  itemId: string | null
  name: string
  quantity: number
  revenueCentavos: number
}

export interface AnalyticsHour {
  hour: number
  orders: number
  gmvCentavos: number
}

export interface AnalyticsBucket {
  totals: AnalyticsTotals
  series: AnalyticsSeriesPoint[]
  topItems: AnalyticsItem[]
  hours: AnalyticsHour[]
}

const NOT_PAID = sql`('CANCELLED', 'REJECTED', 'EXPIRED')`
const ACTIVE = sql`('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'OUT_FOR_DELIVERY', 'DELIVERED', 'SCHEDULED', 'IN_PROGRESS')`

function num(value: unknown): number {
  const parsed = Number(value ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
}

function nullable(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function baseCte(tenantId: string, businessId: string, timeZone: string, from: string, to: string) {
  return sql`
    with base as (
      select o.id, o.status, o.total_centavos, o.delivery_fee_centavos, o.placed_at,
             (o.placed_at at time zone ${timeZone})::date as local_day
      from orders o
      where o.tenant_id = ${tenantId}
        and o.business_id = ${businessId}
        and (o.placed_at at time zone ${timeZone})::date between ${from}::date and ${to}::date
    ),
    paid as (select * from base where status not in ${NOT_PAID}),
    durations as (
      select b.id, b.placed_at,
        min(e.created_at) filter (where e.to_status = 'ACCEPTED') as accepted_at,
        min(e.created_at) filter (where e.to_status = 'READY') as ready_at,
        min(e.created_at) filter (where e.to_status in ('COMPLETED', 'DELIVERED')) as done_at
      from base b
      left join order_events e on e.order_id = b.id
      group by b.id, b.placed_at
    )
  `
}

export async function analyticsBucket(input: {
  tenantId: string
  businessId: string
  timeZone: string
  from: string
  to: string
}): Promise<AnalyticsBucket> {
  const { tenantId, businessId, timeZone, from, to } = input

  return withTenant(tenantId, async (tx) => {
    const totalsResult = await tx.execute(sql`
      ${baseCte(tenantId, businessId, timeZone, from, to)}
      select
        (select count(*) from base)::int as orders_placed,
        (select count(*) from base where status = 'COMPLETED')::int as orders_completed,
        (select count(*) from base where status in ${ACTIVE})::int as active_orders,
        (select count(*) from base where status = 'CANCELLED')::int as orders_cancelled,
        (select count(*) from base where status = 'REJECTED')::int as orders_rejected,
        (select count(*) from base where status = 'EXPIRED')::int as orders_expired,
        (select coalesce(sum(total_centavos), 0) from paid)::bigint as gmv_centavos,
        (select coalesce(sum(total_centavos), 0) from base where status = 'COMPLETED')::bigint
          as net_sales_centavos,
        (select coalesce(sum(delivery_fee_centavos), 0) from paid)::bigint as delivery_fee_centavos,
        (select count(*) from durations where accepted_at is not null)::int as accepted,
        (select percentile_cont(0.5) within group (
          order by extract(epoch from (ready_at - placed_at))
        ) from durations where ready_at is not null) as prep_p50,
        (select percentile_cont(0.9) within group (
          order by extract(epoch from (ready_at - placed_at))
        ) from durations where ready_at is not null) as prep_p90,
        (select percentile_cont(0.5) within group (
          order by extract(epoch from (done_at - placed_at))
        ) from durations where done_at is not null) as fulfillment_p50,
        (select percentile_cont(0.9) within group (
          order by extract(epoch from (done_at - placed_at))
        ) from durations where done_at is not null) as fulfillment_p90
    `)

    const seriesResult = await tx.execute(sql`
      ${baseCte(tenantId, businessId, timeZone, from, to)}
      select local_day::text as day,
             count(*)::int as orders,
             coalesce(sum(total_centavos), 0)::bigint as gmv_centavos
      from paid
      group by local_day
      order by local_day
    `)

    const itemsResult = await tx.execute(sql`
      ${baseCte(tenantId, businessId, timeZone, from, to)}
      select ol.item_id::text as item_id,
             ol.name,
             sum(ol.quantity)::int as quantity,
             sum(ol.line_total_centavos)::bigint as revenue_centavos
      from order_lines ol
      join paid b on b.id = ol.order_id
      group by ol.item_id, ol.name
      order by revenue_centavos desc
      limit 8
    `)

    const hoursResult = await tx.execute(sql`
      ${baseCte(tenantId, businessId, timeZone, from, to)}
      select extract(hour from (placed_at at time zone ${timeZone}))::int as hour,
             count(*)::int as orders,
             coalesce(sum(total_centavos), 0)::bigint as gmv_centavos
      from paid
      group by 1
      order by 1
    `)

    const row = (totalsResult.rows[0] ?? {}) as Record<string, unknown>
    const completed = num(row.orders_completed)
    const netSales = num(row.net_sales_centavos)
    const accepted = num(row.accepted)
    const rejected = num(row.orders_rejected)
    const expired = num(row.orders_expired)

    const totals: AnalyticsTotals = {
      ordersPlaced: num(row.orders_placed),
      ordersCompleted: completed,
      activeOrders: num(row.active_orders),
      ordersCancelled: num(row.orders_cancelled),
      ordersRejected: rejected,
      ordersExpired: expired,
      gmvCentavos: num(row.gmv_centavos),
      netSalesCentavos: netSales,
      deliveryFeeCentavos: num(row.delivery_fee_centavos),
      aovCentavos: completed > 0 ? Math.round(netSales / completed) : 0,
      acceptanceRate:
        accepted + rejected + expired > 0
          ? Number((accepted / (accepted + rejected + expired)).toFixed(4))
          : null,
      prepP50Seconds: nullable(row.prep_p50),
      prepP90Seconds: nullable(row.prep_p90),
      fulfillmentP50Seconds: nullable(row.fulfillment_p50),
      fulfillmentP90Seconds: nullable(row.fulfillment_p90),
    }

    return {
      totals,
      series: seriesResult.rows.map((point) => ({
        day: String(point.day),
        orders: num(point.orders),
        gmvCentavos: num(point.gmv_centavos),
      })),
      topItems: itemsResult.rows.map((item) => ({
        itemId: item.item_id ? String(item.item_id) : null,
        name: String(item.name),
        quantity: num(item.quantity),
        revenueCentavos: num(item.revenue_centavos),
      })),
      hours: hoursResult.rows.map((hour) => ({
        hour: num(hour.hour),
        orders: num(hour.orders),
        gmvCentavos: num(hour.gmv_centavos),
      })),
    }
  })
}
