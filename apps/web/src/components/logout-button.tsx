'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

export function LogoutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function logout() {
    setBusy(true)
    await fetch('/api/v1/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="rounded-lg border border-[var(--outline)] px-3 py-1.5 text-sm text-[var(--muted-text)] hover:border-[var(--primary)] disabled:opacity-60"
    >
      {busy ? 'Signing out…' : 'Sign out'}
    </button>
  )
}
