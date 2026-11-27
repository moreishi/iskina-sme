import type { ThemeManifest } from '@iskina/contracts'
import { listPresets } from '@iskina/core'
import { getBusinessForTenant, getPublishedTheme } from '@iskina/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ThemeEditor } from '@/components/theme-editor'
import { businessMembership } from '@/lib/auth/business'
import { currentSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function ThemePage({ params }: { params: Promise<{ businessId: string }> }) {
  const session = await currentSession()
  if (!session) redirect('/login')

  const { businessId } = await params
  const membership = businessMembership(session, businessId, ['owner', 'manager', 'staff'])
  if (!membership) notFound()

  const business = await getBusinessForTenant(membership.tenantId, businessId)
  if (!business) notFound()

  const published = await getPublishedTheme(membership.tenantId, businessId)
  const presets = listPresets().map((preset) => ({
    id: preset.id,
    label: preset.label,
    layout: preset.layout,
    tokens: preset.tokens,
  }))

  const initial = published
    ? {
        version: published.version,
        manifest: published.manifest as ThemeManifest,
        publishedAt: published.publishedAt.toISOString(),
      }
    : null

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-8 px-6 py-10 md:px-10">
      <nav className="text-sm text-[var(--muted-text)]">
        <Link href="/dashboard" className="underline-offset-4 hover:underline">
          Dashboard
        </Link>
        <span aria-hidden> / </span>
        <span>Theme</span>
      </nav>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Storefront theme</h1>
          <p className="mt-1 text-sm text-[var(--muted-text)]">
            {business.name} · /{business.slug}
          </p>
        </div>
        <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-sm font-semibold">
          {published ? `v${published.version} live` : 'default preset'}
        </span>
      </header>

      <ThemeEditor
        businessId={businessId}
        businessName={business.name}
        presets={presets}
        initial={initial}
      />
    </main>
  )
}
