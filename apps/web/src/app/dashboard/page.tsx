import { VERTICAL_LABELS } from '@iskina/contracts'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ApiKeysPanel } from '@/components/api-keys-panel'
import { LogoutButton } from '@/components/logout-button'
import { currentSession, ownerMembership } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await currentSession()
  if (!session) redirect('/login')
  if (session.memberships.length === 0) redirect('/onboarding')

  const owner = ownerMembership(session)

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-8 px-6 py-10 md:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-10 place-items-center rounded-xl bg-[var(--primary)] font-black text-[var(--on-primary)]"
          >
            is
          </span>
          <span>
            <span className="block font-semibold tracking-tight">Iskina SME</span>
            <span className="block text-xs text-[var(--muted-text)]">{session.user.phone}</span>
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/onboarding"
            className="rounded-lg border border-[var(--outline)] px-3 py-1.5 text-sm hover:border-[var(--primary)]"
          >
            Add business
          </Link>
          <LogoutButton />
        </div>
      </header>

      <section>
        <h1 className="text-3xl font-black tracking-tight">Your businesses</h1>
        <p className="mt-2 text-sm text-[var(--muted-text)]">
          Each business is a storefront with its own vertical, theme and channel keys.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {session.memberships.map((membership) => (
            <article
              key={`${membership.tenantId}:${membership.businessId ?? 'tenant'}`}
              className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">
                    {membership.businessName ?? membership.tenantName}
                  </h2>
                  <p className="mt-1 font-mono text-xs text-[var(--muted-text)]">
                    /{membership.businessSlug ?? membership.tenantSlug}
                  </p>
                </div>
                <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 text-xs font-semibold">
                  {membership.role}
                </span>
              </div>
              <p className="mt-4 text-sm text-[var(--muted-text)]">
                {membership.vertical ? VERTICAL_LABELS[membership.vertical] : 'Tenant-wide'}
              </p>
            </article>
          ))}
        </div>
      </section>

      {owner ? (
        <ApiKeysPanel tenantId={owner.tenantId} />
      ) : (
        <section className="rounded-2xl border border-[var(--outline)] p-6 text-sm text-[var(--muted-text)]">
          Only the business owner can manage channel keys.
        </section>
      )}

      <footer className="mt-auto border-t border-[var(--outline)] pt-6 text-xs text-[var(--muted-text)]">
        M1 — tenancy, OTP sessions, channel keys and audit are live.
      </footer>
    </main>
  )
}
