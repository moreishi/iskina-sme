import Link from 'next/link'
import { redirect } from 'next/navigation'
import { OnboardingForm } from '@/components/onboarding-form'
import { currentSession } from '@/lib/auth/session'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  const session = await currentSession()
  if (!session) redirect('/login')

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-6 py-10">
      <Link href="/" className="mb-8 flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-10 place-items-center rounded-xl bg-[var(--primary)] font-black text-[var(--on-primary)]"
        >
          is
        </span>
        <span className="font-semibold tracking-tight">Iskina SME</span>
      </Link>

      <div className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-6">
        <h1 className="text-2xl font-bold tracking-tight">Set up your business</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-text)]">
          This creates your tenant, storefront and owner membership in one step.
        </p>
        <div className="mt-6">
          <OnboardingForm ownerName={session.user.name} />
        </div>
      </div>
    </main>
  )
}
