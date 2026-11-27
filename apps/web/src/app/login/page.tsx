'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface ApiError {
  error?: { message?: string }
}

export default function LoginPage() {
  const router = useRouter()
  const [step, setStep] = useState<'phone' | 'code'>('phone')
  const [phone, setPhone] = useState('')
  const [challengeId, setChallengeId] = useState('')
  const [code, setCode] = useState('')
  const [devCode, setDevCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function requestCode(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/auth/otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      })
      const data = (await response.json()) as ApiError & {
        challengeId?: string
        devCode?: string | null
      }
      if (!response.ok) {
        setError(data.error?.message ?? 'Could not send a code')
        return
      }
      setChallengeId(data.challengeId ?? '')
      setDevCode(data.devCode ?? null)
      setStep('code')
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/v1/auth/verify', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeId, code }),
      })
      const data = (await response.json()) as ApiError & { needsOnboarding?: boolean }
      if (!response.ok) {
        setError(data.error?.message ?? 'Could not verify the code')
        return
      }
      router.push(data.needsOnboarding ? '/onboarding' : '/dashboard')
      router.refresh()
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
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
        <h1 className="text-2xl font-bold tracking-tight">
          {step === 'phone' ? 'Sign in' : 'Enter your code'}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--muted-text)]">
          {step === 'phone'
            ? 'We send a 6-digit code to your Philippine mobile number.'
            : `Sent to ${phone}. The code expires in 10 minutes.`}
        </p>

        {step === 'phone' ? (
          <form onSubmit={requestCode} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Mobile number</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                required
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="0917 123 4567"
                className="w-full rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
              />
            </label>
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 font-semibold text-[var(--on-primary)] disabled:opacity-60"
            >
              {busy ? 'Sending…' : 'Send code'}
            </button>
          </form>
        ) : (
          <form onSubmit={verifyCode} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">6-digit code</span>
              <input
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                pattern="\d{6}"
                maxLength={6}
                value={code}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                className="w-full rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2.5 text-center font-mono text-lg tracking-[0.4em] outline-none focus:border-[var(--primary)]"
              />
            </label>
            {devCode ? (
              <p className="rounded-lg border border-[var(--outline)] bg-[var(--surface-muted)] px-3 py-2 text-sm">
                Development code: <span className="font-mono font-semibold">{devCode}</span>
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 font-semibold text-[var(--on-primary)] disabled:opacity-60"
            >
              {busy ? 'Verifying…' : 'Verify and continue'}
            </button>
            <button
              type="button"
              onClick={() => {
                setStep('phone')
                setCode('')
                setError(null)
              }}
              className="w-full text-sm text-[var(--muted-text)] underline-offset-4 hover:underline"
            >
              Use a different number
            </button>
          </form>
        )}

        {error ? (
          <p role="alert" className="mt-4 text-sm font-medium text-[var(--danger)]">
            {error}
          </p>
        ) : null}
      </div>

      <p className="mt-6 text-center text-xs leading-relaxed text-[var(--muted-text)]">
        Staff and owners sign in with OTP. HATOD channel keys are managed per business.
      </p>
    </main>
  )
}
