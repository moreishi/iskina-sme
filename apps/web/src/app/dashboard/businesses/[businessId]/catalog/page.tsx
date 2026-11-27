import { VERTICAL_LABELS } from '@iskina/contracts'
import { mergeVerticalConfig } from '@iskina/core'
import { getBusinessForTenant, getCatalog } from '@iskina/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CatalogManager } from '@/components/catalog-manager'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

function cents(value: number): string {
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value / 100)
}

export default async function CatalogPage({ params }: { params: Promise<{ businessId: string }> }) {
  const session = await currentSession()
  if (!session) redirect('/login')

  const { businessId } = await params
  const membership = businessMembership(session, businessId, ['owner', 'manager', 'staff'])
  if (!membership) notFound()

  const business = await getBusinessForTenant(membership.tenantId, businessId)
  if (!business) notFound()

  const catalog = await getCatalog(membership.tenantId, businessId)
  const config = mergeVerticalConfig(business.vertical, business.verticalConfig)
  const canEdit = membership.role === 'owner' || membership.role === 'manager'

  const initial = {
    categories: catalog.categories.map((category) => ({
      id: category.id,
      name: category.name,
      sortOrder: category.sortOrder,
      active: category.active,
      items: category.items.map((item) => ({
        id: item.id,
        categoryId: item.categoryId,
        name: item.name,
        description: item.description,
        priceCentavos: item.priceCentavos,
        unit: item.unit,
        available: item.available,
        stockCount: item.stockCount,
      })),
    })),
    uncategorized: catalog.uncategorized.map((item) => ({
      id: item.id,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      priceCentavos: item.priceCentavos,
      unit: item.unit,
      available: item.available,
      stockCount: item.stockCount,
    })),
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
      <nav className="text-sm text-[var(--muted-text)]">
        <Link href="/dashboard" className="underline-offset-4 hover:underline">
          Dashboard
        </Link>
        <span aria-hidden> / </span>
        <span>Catalog</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{business.name}</h1>
          <p className="mt-1 font-mono text-xs text-[var(--muted-text)]">/{business.slug}</p>
        </div>
        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-sm font-semibold">
          {VERTICAL_LABELS[business.vertical]}
        </span>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Fulfillment', value: config.fulfillment },
          { label: 'Prep', value: `${config.prepMinutes} min` },
          {
            label: 'Delivery fee',
            value: cents(config.deliveryFeeCentavos),
          },
          {
            label: 'Per km',
            value: cents(config.deliveryFeePerKmCentavos),
          },
          { label: 'Min order', value: cents(config.minOrderCentavos) },
          { label: 'Max distance', value: `${config.maxDeliveryKm} km` },
          {
            label: 'Slot',
            value: config.slotMinutes ? `${config.slotMinutes} min` : 'not scheduled',
          },
          { label: 'Order flow', value: config.orderFlow },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-[var(--outline)] bg-[var(--surface-raised)] p-4"
          >
            <p className="text-xs uppercase tracking-wide text-[var(--muted-text)]">{stat.label}</p>
            <p className="mt-1 text-sm font-semibold">{stat.value}</p>
          </div>
        ))}
      </section>

      <CatalogManager businessId={business.id} initial={initial} canEdit={canEdit} />
    </main>
  )
}
