'use client'

import { VERTICAL_LABELS, VERTICALS, type Vertical } from '@iskina/contracts'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

export function OnboardingForm({ ownerName }: { ownerName: string | null }) {
  const router = useRouter()
  const [businessName, setBusinessName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [vertical, setVertical] = useState<Vertical>('food')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const effectiveSlug = slugTouched ? slug : slugify(businessName)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ businessName, slug: effectiveSlug, vertical }),
      })
      const data = (await response.json()) as { error?: { message?: string } }
      if (!response.ok) {
        setError(data.error?.message ?? 'Could not create the business')
        return
      }
      router.push('/dashboard')
      router.refresh()
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="text-sm text-[var(--muted-text)]">
        Signed in{ownerName ? ` as ${ownerName}` : ''}. Set up the first business.
      </p>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Business name</span>
        <input
          required
          minLength={2}
          maxLength={80}
          value={businessName}
          onChange={(event) => setBusinessName(event.target.value)}
          placeholder="Aling Nena's Kitchen"
          className="w-full rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
      </label>

      <label className="block">
        <span className="mb-1.5 block text-sm font-medium">Storefront address</span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-[var(--muted-text)]">sme.iskina.ph/</span>
          <input
            required
            minLength={3}
            maxLength={40}
            value={effectiveSlug}
            onChange={(event) => {
              setSlugTouched(true)
              setSlug(event.target.value)
            }}
            className="w-full rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2.5 font-mono text-sm outline-none focus:border-[var(--primary)]"
          />
        </div>
        <span className="mt-1 block text-xs text-[var(--muted-text)]">
          Lowercase letters, numbers and hyphens.
        </span>
      </label>

      <fieldset>
        <legend className="mb-2 block text-sm font-medium">What do you sell?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {VERTICALS.map((option) => (
            <label
              key={option}
              className={`cursor-pointer rounded-xl border px-3 py-3 text-sm ${
                vertical === option
                  ? 'border-[var(--primary)] bg-[var(--surface-muted)] font-semibold'
                  : 'border-[var(--outline)]'
              }`}
            >
              <input
                type="radio"
                name="vertical"
                value={option}
                checked={vertical === option}
                onChange={() => setVertical(option)}
                className="sr-only"
              />
              {VERTICAL_LABELS[option]}
            </label>
          ))}
        </div>
      </fieldset>

      {error ? (
        <p role="alert" className="text-sm font-medium text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 font-semibold text-[var(--on-primary)] disabled:opacity-60"
      >
        {busy ? 'Creating…' : 'Create business'}
      </button>
    </form>
  )
}
