import { dayRange, percentChange } from '@iskina/core'
import { analyticsBucket, getBusinessForTenant } from '@iskina/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

const peso = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0,
})

function duration(seconds: number | null): string {
  if (seconds === null) return '—'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

function delta(value: number | null): string {
  if (value === null) return 'new'
  return `${value > 0 ? '+' : ''}${value}%`
}

export default async function InsightsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ days?: string }>
}) {
  const session = await currentSession()
  if (!session) redirect('/login')

  const { businessId } = await params
  const membership = businessMembership(session, businessId, ['owner', 'manager', 'staff'])
  if (!membership) notFound()

  const business = await getBusinessForTenant(membership.tenantId, businessId)
  if (!business) notFound()

  const requested = Number((await searchParams).days ?? 7)
  const days = [7, 30, 90].includes(requested) ? requested : 7
  const range = dayRange(days, new Date(), business.timezone)

  const current = await analyticsBucket({
    tenantId: membership.tenantId,
    businessId,
    timeZone: business.timezone,
    from: range.from,
    to: range.to,
  })
  const previous = await analyticsBucket({
    tenantId: membership.tenantId,
    businessId,
    timeZone: business.timezone,
    from: range.previousFrom,
    to: range.previousTo,
  })

  const kpis = [
    {
      label: 'GMV',
      value: peso.format(current.totals.gmvCentavos / 100),
      change: percentChange(current.totals.gmvCentavos, previous.totals.gmvCentavos),
    },
    {
      label: 'Orders',
      value: String(current.totals.ordersPlaced),
      change: percentChange(current.totals.ordersPlaced, previous.totals.ordersPlaced),
    },
    {
      label: 'AOV',
      value: peso.format(current.totals.aovCentavos / 100),
      change: percentChange(current.totals.aovCentavos, previous.totals.aovCentavos),
    },
    {
      label: 'Net sales',
      value: peso.format(current.totals.netSalesCentavos / 100),
      change: percentChange(current.totals.netSalesCentavos, previous.totals.netSalesCentavos),
    },
    {
      label: 'Acceptance',
      value:
        current.totals.acceptanceRate === null
          ? '—'
          : `${Math.round(current.totals.acceptanceRate * 100)}%`,
      change: null,
    },
    {
      label: 'Prep p50',
      value: duration(current.totals.prepP50Seconds),
      change: null,
    },
    {
      label: 'Prep p90',
      value: duration(current.totals.prepP90Seconds),
      change: null,
    },
    {
      label: 'Fulfillment p90',
      value: duration(current.totals.fulfillmentP90Seconds),
      change: null,
    },
  ]

  const maxGmv = Math.max(1, ...current.series.map((point) => point.gmvCentavos))
  const peakHour = [...current.hours].sort((a, b) => b.orders - a.orders)[0]

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
      <nav className="text-sm text-[var(--muted-text)]">
        <Link href="/dashboard" className="underline-offset-4 hover:underline">
          Dashboard
        </Link>
        <span aria-hidden> / </span>
        <span>Insights</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Insights</h1>
          <p className="mt-1 text-sm text-[var(--muted-text)]">
            {business.name} · {range.from} → {range.to} ({business.timezone})
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-[var(--outline)] p-1">
          {[7, 30, 90].map((value) => (
            <Link
              key={value}
              href={`/dashboard/businesses/${businessId}/insights?days=${value}`}
              className={`rounded-md px-3 py-1.5 text-sm ${
                days === value
                  ? 'bg-[var(--primary)] font-semibold text-[var(--on-primary)]'
                  : 'text-[var(--muted-text)]'
              }`}
            >
              {value}d
            </Link>
          ))}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-[var(--outline)] bg-[var(--surface-raised)] p-4"
          >
            <p className="text-xs uppercase tracking-wide text-[var(--muted-text)]">{kpi.label}</p>
            <p className="mt-1 text-xl font-bold">{kpi.value}</p>
            {kpi.change !== null ? (
              <p
                className={`mt-1 text-xs font-medium ${
                  kpi.change < 0 ? 'text-[var(--danger)]' : 'text-[var(--success)]'
                }`}
              >
                {delta(kpi.change)} vs previous
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5">
        <div className="flex items-end justify-between gap-3">
          <h2 className="font-semibold">Daily GMV</h2>
          <p className="text-xs text-[var(--muted-text)]">
            Peak hour: {peakHour ? `${peakHour.hour}:00` : '—'}
          </p>
        </div>
        {current.series.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--muted-text)]">No orders in this window.</p>
        ) : (
          <ul className="mt-4 flex h-40 items-end gap-1 overflow-x-auto">
            {current.series.map((point) => (
              <li key={point.day} className="flex min-w-6 flex-1 flex-col items-center gap-1">
                <div
                  className="w-full rounded-t bg-[var(--primary)]"
                  style={{ height: `${Math.max(3, (point.gmvCentavos / maxGmv) * 130)}px` }}
                  title={`${point.day}: ${peso.format(point.gmvCentavos / 100)}`}
                />
                <span className="text-[10px] text-[var(--muted-text)]">{point.day.slice(5)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5">
          <h2 className="font-semibold">Top items</h2>
          {current.topItems.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--muted-text)]">No sold items yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {current.topItems.map((item) => (
                <li key={`${item.itemId ?? item.name}`} className="flex justify-between gap-3">
                  <span>
                    {item.name} <span className="text-[var(--muted-text)]">×{item.quantity}</span>
                  </span>
                  <span className="font-mono text-xs">
                    {peso.format(item.revenueCentavos / 100)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5">
          <h2 className="font-semibold">Ops</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-[var(--muted-text)]">Active</dt>
              <dd className="font-semibold">{current.totals.activeOrders}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-text)]">Completed</dt>
              <dd className="font-semibold">{current.totals.ordersCompleted}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-text)]">Cancelled</dt>
              <dd className="font-semibold">{current.totals.ordersCancelled}</dd>
            </div>
            <div>
              <dt className="text-[var(--muted-text)]">Rejected / expired</dt>
              <dd className="font-semibold">
                {current.totals.ordersRejected} / {current.totals.ordersExpired}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted-text)]">Delivery fees</dt>
              <dd className="font-semibold">
                {peso.format(current.totals.deliveryFeeCentavos / 100)}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--muted-text)]">Fulfillment p50</dt>
              <dd className="font-semibold">{duration(current.totals.fulfillmentP50Seconds)}</dd>
            </div>
          </dl>
        </section>
      </div>

      <p className="text-xs text-[var(--muted-text)]">
        Computed from orders and order events. Day boundaries use {business.timezone}. Rollups and a
        12-month history land with the M6 dashboard.
      </p>
    </main>
  )
}
