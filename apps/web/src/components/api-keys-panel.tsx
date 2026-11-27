'use client'

import { useCallback, useEffect, useState } from 'react'

interface ApiKeyView {
  id: string
  name: string
  prefix: string
  env: 'test' | 'live'
  scopes: string[]
  createdAt: string
  lastUsedAt: string | null
  revokedAt: string | null
}

function formatDate(value: string | null): string {
  if (!value) return '—'
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function ApiKeysPanel({ tenantId }: { tenantId: string }) {
  const [keys, setKeys] = useState<ApiKeyView[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('HATOD production')
  const [env, setEnv] = useState<'test' | 'live'>('test')
  const [plaintext, setPlaintext] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/v1/api-keys?tenantId=${encodeURIComponent(tenantId)}`)
      const data = (await response.json()) as {
        keys?: ApiKeyView[]
        error?: { message?: string }
      }
      if (!response.ok) {
        setError(data.error?.message ?? 'Could not load keys')
        return
      }
      setKeys(data.keys ?? [])
      setError(null)
    } catch {
      setError('Could not reach the server')
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    void load()
  }, [load])

  async function createKey(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    setPlaintext(null)
    try {
      const response = await fetch('/api/v1/api-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId, name, env }),
      })
      const data = (await response.json()) as {
        plaintext?: string
        error?: { message?: string }
      }
      if (!response.ok) {
        setError(data.error?.message ?? 'Could not create the key')
        return
      }
      setPlaintext(data.plaintext ?? null)
      await load()
    } catch {
      setError('Could not reach the server')
    } finally {
      setBusy(false)
    }
  }

  async function revokeKey(id: string) {
    if (!window.confirm('Revoke this key? HATOD will stop working with it.')) return
    setBusy(true)
    try {
      const response = await fetch(`/api/v1/api-keys/${id}/revoke`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      })
      if (!response.ok) {
        const data = (await response.json()) as { error?: { message?: string } }
        setError(data.error?.message ?? 'Could not revoke the key')
        return
      }
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">HATOD channel keys</h2>
          <p className="mt-1 text-sm text-[var(--muted-text)]">
            Bearer keys for the channel API. The plaintext is shown once.
          </p>
        </div>
        <span className="text-xs text-[var(--muted-text)]">
          {keys.filter((key) => !key.revokedAt).length} active
        </span>
      </div>

      <form onSubmit={createKey} className="mt-5 grid gap-3 sm:grid-cols-[1fr_120px_auto]">
        <input
          required
          minLength={2}
          maxLength={40}
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Key name"
          className="rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        />
        <select
          value={env}
          onChange={(event) => setEnv(event.target.value === 'live' ? 'live' : 'test')}
          className="rounded-lg border border-[var(--outline)] bg-[var(--surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--primary)]"
        >
          <option value="test">test</option>
          <option value="live">live</option>
        </select>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[var(--primary)] px-4 py-2.5 text-sm font-semibold text-[var(--on-primary)] disabled:opacity-60"
        >
          Create key
        </button>
      </form>

      {plaintext ? (
        <div className="mt-4 rounded-xl border border-[var(--primary)] bg-[var(--surface-muted)] p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-text)]">
            Copy now — it will not be shown again
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-[var(--surface)] px-2 py-1 text-sm">
              {plaintext}
            </code>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(plaintext)}
              className="rounded border border-[var(--outline)] px-2 py-1 text-xs"
            >
              Copy
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="mt-4 text-sm font-medium text-[var(--danger)]">
          {error}
        </p>
      ) : null}

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[var(--muted-text)]">
            <tr className="border-b border-[var(--outline)]">
              <th className="py-2 pr-3 font-medium">Name</th>
              <th className="py-2 pr-3 font-medium">Key</th>
              <th className="py-2 pr-3 font-medium">Env</th>
              <th className="py-2 pr-3 font-medium">Last used</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 font-medium" />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-4 text-[var(--muted-text)]">
                  Loading…
                </td>
              </tr>
            ) : keys.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-[var(--muted-text)]">
                  No keys yet. Create one for HATOD when you are ready.
                </td>
              </tr>
            ) : (
              keys.map((key) => (
                <tr key={key.id} className="border-b border-[var(--outline)] last:border-0">
                  <td className="py-3 pr-3 font-medium">{key.name}</td>
                  <td className="py-3 pr-3 font-mono text-xs">{key.prefix}…</td>
                  <td className="py-3 pr-3">{key.env}</td>
                  <td className="py-3 pr-3 text-[var(--muted-text)]">
                    {formatDate(key.lastUsedAt)}
                  </td>
                  <td className="py-3 pr-3">
                    {key.revokedAt ? (
                      <span className="text-[var(--danger)]">revoked</span>
                    ) : (
                      <span className="text-[var(--success)]">active</span>
                    )}
                  </td>
                  <td className="py-3 text-right">
                    {key.revokedAt ? null : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void revokeKey(key.id)}
                        className="rounded border border-[var(--outline)] px-2 py-1 text-xs text-[var(--danger)] disabled:opacity-60"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
