import { VERTICAL_FULFILLMENT, VERTICAL_LABELS, VERTICALS } from '@iskina/contracts'
import { contrastRatio, listPresets } from '@iskina/core'
import { getDb } from '@iskina/db'
import { sql } from 'drizzle-orm'
import Link from 'next/link'
import { currentSession } from '@/lib/auth/session'
import { buildHealthResponse } from '@/lib/health'

export const dynamic = 'force-dynamic'

const MILESTONES = [
  { id: 'M0', title: 'Scaffold, health, migrations, CI', state: 'shipped' },
  { id: 'M1', title: 'Tenancy, OTP sessions, API keys, audit', state: 'shipped' },
  { id: 'M1b', title: 'RLS policies + non-superuser app role', state: 'shipped' },
  { id: 'M2', title: 'Catalog + vertical configs', state: 'shipped' },
  { id: 'M3', title: 'Order/booking ops + merchant board', state: 'shipped' },
  { id: 'M3b', title: 'Analytics API + merchant insights', state: 'shipped' },
  { id: 'M3c', title: 'SSE + push notifications', state: 'shipped' },
  { id: 'M4', title: 'Theme editor + versioned publish', state: 'next' },
  { id: 'M4b', title: 'Flutter merchant app', state: 'planned' },
  { id: 'M5', title: 'HATOD channel integration', state: 'planned' },
  { id: 'M6', title: 'Analytics dashboard + billing', state: 'planned' },
] as const

async function databaseStatus(): Promise<'ok' | 'error'> {
  try {
    await getDb().execute(sql`select 1`)
    return 'ok'
  } catch {
    return 'error'
  }
}

export default async function HomePage() {
  const health = buildHealthResponse({ database: await databaseStatus() })
  const presets = listPresets()
  const session = await currentSession()
  const accountHref = session ? '/dashboard' : '/login'
  const accountLabel = session ? 'Dashboard' : 'Sign in'

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-16 px-6 py-10 md:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="grid size-10 place-items-center rounded-xl bg-[var(--primary)] font-black text-[var(--on-primary)]"
          >
            is
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">Iskina SME</p>
            <p className="text-sm text-[var(--muted-text)]">MSME operations core</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Link
            href={accountHref}
            className="rounded-full border border-[var(--outline)] px-3 py-1 font-medium hover:border-[var(--primary)]"
          >
            {accountLabel}
          </Link>
          <span className="rounded-full border border-[var(--outline)] px-3 py-1 font-medium">
            M0
          </span>
          <span
            className="inline-flex items-center gap-2 rounded-full border border-[var(--outline)] px-3 py-1"
            title={`checked ${health.checkedAt}`}
          >
            <span
              aria-hidden
              className="size-2 rounded-full"
              style={{
                background: health.database === 'ok' ? 'var(--success)' : 'var(--danger)',
              }}
            />
            DB {health.database}
          </span>
        </div>
      </header>

      <section className="grid gap-8 md:grid-cols-[1.4fr_1fr] md:items-end">
        <div className="space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--muted-text)]">
            Built for the businesses behind every delivery
          </p>
          <h1 className="text-balance text-4xl font-black tracking-tight md:text-6xl">
            One core for food, aircon and LPG —{' '}
            <span className="text-[var(--primary)]">branded for every shop.</span>
          </h1>
          <p className="max-w-xl text-pretty text-lg leading-relaxed text-[var(--muted-text)]">
            Tenants, catalogs, order processing, bookings, storefront themes and merchant analytics.
            HATOD stays the consumer app; it calls this core and renders what the business
            published.
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <a
              href="/api/health"
              className="rounded-lg bg-[var(--primary)] px-4 py-2.5 font-semibold text-[var(--on-primary)] transition-opacity hover:opacity-90"
            >
              API health
            </a>
            <span className="rounded-lg border border-[var(--outline)] px-4 py-2.5 text-sm text-[var(--muted-text)]">
              web :3008 · db :5437
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-text)]">
            Service
          </p>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--muted-text)]">Version</dt>
              <dd className="font-mono">{health.version}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--muted-text)]">Status</dt>
              <dd className="font-mono">{health.status}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--muted-text)]">Database</dt>
              <dd className="font-mono">{health.database}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4">
              <dt className="text-[var(--muted-text)]">Uptime</dt>
              <dd className="font-mono">{health.uptimeSeconds}s</dd>
            </div>
          </dl>
          <p className="mt-5 border-t border-[var(--outline)] pt-4 text-xs leading-relaxed text-[var(--muted-text)]">
            Health never leaks the DSN. A database failure degrades the response to 503 instead of
            crashing the page.
          </p>
        </div>
      </section>

      <section aria-labelledby="verticals" className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <h2 id="verticals" className="text-2xl font-bold tracking-tight">
            Verticals
          </h2>
          <p className="text-sm text-[var(--muted-text)]">Config-driven, one schema</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {VERTICALS.map((vertical) => (
            <article
              key={vertical}
              className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-muted)] p-5"
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{VERTICAL_LABELS[vertical]}</h3>
                <span className="rounded-full bg-[var(--accent)] px-2.5 py-0.5 text-xs font-semibold text-[#1a1a1a]">
                  {VERTICAL_FULFILLMENT[vertical]}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted-text)]">
                {vertical === 'food'
                  ? 'Cart, prep, ready, dispatch handoff. First vertical end-to-end.'
                  : vertical === 'aircon'
                    ? 'Slot booking, unit intake, on-site quote, technician assignment.'
                    : 'Refill vs new tank, deposits, delivery windows.'}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="themes" className="space-y-5">
        <div className="flex items-end justify-between gap-4">
          <h2 id="themes" className="text-2xl font-bold tracking-tight">
            Theme presets
          </h2>
          <p className="text-sm text-[var(--muted-text)]">WCAG AA checked on publish</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {presets.map((preset) => {
            const light = preset.tokens.light
            const ratio = contrastRatio(light.onPrimary, light.primary)
            return (
              <article
                key={preset.id}
                className="overflow-hidden rounded-2xl border border-[var(--outline)]"
              >
                <div
                  className="flex h-24 items-end gap-1 p-3"
                  style={{ background: light.surface }}
                >
                  {[light.primary, light.accent, light.onSurface, light.surfaceMuted].map(
                    (colour) => (
                      <span
                        key={colour}
                        className="h-10 flex-1 rounded-md border border-black/10"
                        style={{ background: colour }}
                        title={colour}
                      />
                    ),
                  )}
                </div>
                <div className="space-y-1 bg-[var(--surface-raised)] p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold">{preset.label}</h3>
                    {preset.id === 'alibaba' ? (
                      <span className="rounded-full bg-[var(--primary)] px-2 py-0.5 text-[11px] font-bold text-[var(--on-primary)]">
                        default
                      </span>
                    ) : null}
                  </div>
                  <p className="font-mono text-xs text-[var(--muted-text)]">{light.primary}</p>
                  <p className="text-xs text-[var(--muted-text)]">
                    text {ratio.toFixed(2)}:1 · {preset.layout}
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="roadmap" className="space-y-5">
        <h2 id="roadmap" className="text-2xl font-bold tracking-tight">
          Milestones
        </h2>
        <ol className="grid gap-2">
          {MILESTONES.map((milestone) => (
            <li
              key={milestone.id}
              className="flex items-center gap-4 rounded-xl border border-[var(--outline)] px-4 py-3"
            >
              <span className="w-12 font-mono text-sm text-[var(--muted-text)]">
                {milestone.id}
              </span>
              <span className="flex-1 text-sm">{milestone.title}</span>
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-semibold"
                style={
                  milestone.state === 'shipped'
                    ? { background: 'var(--success)', color: '#fff' }
                    : milestone.state === 'next'
                      ? { background: 'var(--accent)', color: '#1a1a1a' }
                      : {
                          border: '1px solid var(--outline)',
                          color: 'var(--muted-text)',
                        }
                }
              >
                {milestone.state}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-[var(--outline)] pt-6 text-sm text-[var(--muted-text)]">
        <p>Iskina SME · separate core for the HATOD app</p>
        <p className="font-mono text-xs">v{health.version}</p>
      </footer>
    </main>
  )
}
