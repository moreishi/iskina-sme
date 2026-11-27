import { VERTICAL_LABELS } from '@iskina/contracts'
import { getBusinessForTenant, listOrders } from '@iskina/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { OrdersBoard } from '@/components/orders-board'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function OrdersPage({ params }: { params: Promise<{ businessId: string }> }) {
  const session = await currentSession()
  if (!session) redirect('/login')

  const { businessId } = await params
  const membership = businessMembership(session, businessId, ['owner', 'manager', 'staff'])
  if (!membership) notFound()

  const business = await getBusinessForTenant(membership.tenantId, businessId)
  if (!business) notFound()

  const rows = await listOrders(membership.tenantId, businessId)
  const initial = rows.map(({ order, lines }) => ({
    id: order.id,
    number: order.number,
    status: order.status,
    kind: order.kind,
    contactName: order.contactName,
    contactPhone: order.contactPhone,
    totalCentavos: order.totalCentavos,
    address: order.address,
    scheduledAt: order.scheduledAt?.toISOString() ?? null,
    placedAt: order.placedAt.toISOString(),
    cashReceivedAt: order.cashReceivedAt?.toISOString() ?? null,
    lines: lines.map((line) => ({
      id: line.id,
      name: line.name,
      quantity: line.quantity,
      unitPriceCentavos: line.unitPriceCentavos,
      lineTotalCentavos: line.lineTotalCentavos,
    })),
  }))

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
      <nav className="text-sm text-[var(--muted-text)]">
        <Link href="/dashboard" className="underline-offset-4 hover:underline">
          Dashboard
        </Link>
        <span aria-hidden> / </span>
        <span>Orders</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{business.name}</h1>
          <p className="mt-1 font-mono text-xs text-[var(--muted-text)]">/{business.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/businesses/${businessId}/catalog`}
            className="rounded-lg border border-[var(--outline)] px-3 py-1.5 text-sm hover:border-[var(--primary)]"
          >
            Catalog
          </Link>
          <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-sm font-semibold">
            {VERTICAL_LABELS[business.vertical]}
          </span>
        </div>
      </header>

      <OrdersBoard businessId={businessId} initial={initial} />
    </main>
  )
}
