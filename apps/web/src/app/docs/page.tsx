import type { Metadata } from 'next'
import Link from 'next/link'
import { openApiDocument } from '@/lib/openapi'

export const metadata: Metadata = {
  title: 'Iskina SME — API reference',
  description: 'Endpoints, authentication and schemas for the Iskina SME API.',
}

interface Operation {
  tags?: readonly string[]
  summary?: string
  description?: string
  security?: readonly Record<string, readonly string[]>[]
  parameters?: readonly {
    name?: string
    in?: string
    required?: boolean
    schema?: unknown
  }[]
  requestBody?: {
    required?: boolean
    content?: Record<string, { schema?: unknown }>
  }
  responses?: Record<string, { description?: string }>
}

const METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const

const METHOD_STYLE: Record<string, string> = {
  GET: 'bg-[var(--success)] text-white',
  POST: 'bg-[var(--primary)] text-[var(--on-primary)]',
  PATCH: 'bg-[var(--accent)] text-[#1a1a1a]',
  PUT: 'bg-[var(--accent)] text-[#1a1a1a]',
  DELETE: 'bg-[var(--danger)] text-white',
}

const SCHEME_LABELS: Record<string, string> = {
  sessionCookie: 'session cookie',
  mobileBearer: 'mobile bearer',
  channelKey: 'channel key',
  platformKey: 'platform key',
}

const paths = openApiDocument.paths as unknown as Record<string, Record<string, Operation>>

const groups = (openApiDocument.tags as readonly { name: string; description?: string }[]).map(
  (tag) => ({
    ...tag,
    operations: Object.entries(paths).flatMap(([path, methods]) =>
      METHODS.flatMap((method) => {
        const operation = methods[method]
        if (!operation || operation.tags?.[0] !== tag.name) return []
        return [{ method: method.toUpperCase(), path, operation }]
      }),
    ),
  }),
)

const schemes = openApiDocument.components.securitySchemes as Record<
  string,
  { description?: string }
>

function securityLabel(operation: Operation): string {
  if (!operation.security || operation.security.length === 0) return 'Public'
  const names = new Set<string>()
  for (const option of operation.security) {
    for (const name of Object.keys(option)) names.add(name)
  }
  return [...names].map((name) => SCHEME_LABELS[name] ?? name).join(' or ')
}

function schemaBlock(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

export default function DocsPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-6xl flex-col gap-10 px-6 py-10 md:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--muted-text)]">
            Iskina SME
          </p>
          <h1 className="mt-2 text-4xl font-black tracking-tight">API reference</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted-text)]">
            Version {openApiDocument.info.version}. The JSON document below is the source of truth
            and can be imported into Postman or Insomnia.
          </p>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href="/api/openapi"
            className="rounded-lg bg-[var(--primary)] px-3 py-2 font-semibold text-[var(--on-primary)]"
          >
            OpenAPI JSON
          </Link>
          <Link href="/" className="rounded-lg border border-[var(--outline)] px-3 py-2">
            Home
          </Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5">
          <h2 className="font-semibold">Base URLs</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {openApiDocument.servers.map((server) => (
              <li key={server.url} className="flex flex-wrap items-baseline gap-2">
                <code className="rounded bg-[var(--surface-muted)] px-2 py-0.5 text-xs">
                  {server.url}
                </code>
                <span className="text-[var(--muted-text)]">{server.description}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-5">
          <h2 className="font-semibold">Authentication</h2>
          <dl className="mt-3 space-y-3 text-sm">
            {Object.entries(schemes).map(([name, scheme]) => (
              <div key={name}>
                <dt className="font-medium">{SCHEME_LABELS[name] ?? name}</dt>
                <dd className="text-[var(--muted-text)]">{scheme.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <nav aria-label="Sections" className="flex flex-wrap gap-2">
        {groups.map((group) => (
          <a
            key={group.name}
            href={`#${group.name.toLowerCase()}`}
            className="rounded-full border border-[var(--outline)] px-3 py-1 text-sm hover:border-[var(--primary)]"
          >
            {group.name}
          </a>
        ))}
      </nav>

      <div className="space-y-12">
        {groups.map((group) => (
          <section key={group.name} id={group.name.toLowerCase()} className="scroll-mt-6">
            <h2 className="text-2xl font-bold tracking-tight">{group.name}</h2>
            {group.description ? (
              <p className="mt-1 text-sm text-[var(--muted-text)]">{group.description}</p>
            ) : null}

            <ul className="mt-4 space-y-3">
              {group.operations.map((entry) => (
                <li
                  key={`${entry.method}-${entry.path}`}
                  className="rounded-2xl border border-[var(--outline)] bg-[var(--surface-raised)] p-4"
                >
                  <details>
                    <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-xs font-bold ${METHOD_STYLE[entry.method] ?? ''}`}
                      >
                        {entry.method}
                      </span>
                      <code className="text-sm font-semibold">{entry.path}</code>
                      <span className="flex-1 text-sm text-[var(--muted-text)]">
                        {entry.operation.summary}
                      </span>
                      <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px]">
                        {securityLabel(entry.operation)}
                      </span>
                    </summary>

                    <div className="mt-4 space-y-4 border-t border-[var(--outline)] pt-4 text-sm">
                      {entry.operation.description ? (
                        <p className="leading-relaxed text-[var(--muted-text)]">
                          {entry.operation.description}
                        </p>
                      ) : null}

                      {entry.operation.parameters && entry.operation.parameters.length > 0 ? (
                        <div>
                          <h4 className="font-semibold">Parameters</h4>
                          <ul className="mt-2 space-y-1">
                            {entry.operation.parameters.map((parameter) => (
                              <li key={`${parameter.in}-${parameter.name}`} className="text-xs">
                                <code className="font-mono">{parameter.name}</code>{' '}
                                <span className="text-[var(--muted-text)]">
                                  ({parameter.in}
                                  {parameter.required ? ', required' : ''})
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {entry.operation.requestBody ? (
                        <div>
                          <h4 className="font-semibold">
                            Request body{entry.operation.requestBody.required ? ' (required)' : ''}
                          </h4>
                          {Object.entries(entry.operation.requestBody.content ?? {}).map(
                            ([contentType, media]) => (
                              <div key={contentType} className="mt-2">
                                <p className="font-mono text-xs text-[var(--muted-text)]">
                                  {contentType}
                                </p>
                                <pre className="mt-1 overflow-x-auto rounded-lg bg-[var(--surface-muted)] p-3 text-xs">
                                  {schemaBlock(media.schema)}
                                </pre>
                              </div>
                            ),
                          )}
                        </div>
                      ) : null}

                      <div>
                        <h4 className="font-semibold">Responses</h4>
                        <ul className="mt-2 space-y-1 text-xs">
                          {Object.entries(entry.operation.responses ?? {}).map(
                            ([status, response]) => (
                              <li key={status}>
                                <code className="font-mono font-semibold">{status}</code>{' '}
                                <span className="text-[var(--muted-text)]">
                                  {response.description}
                                </span>
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="border-t border-[var(--outline)] pt-6 text-sm text-[var(--muted-text)]">
        Errors use{' '}
        <code className="rounded bg-[var(--surface-muted)] px-1.5 py-0.5 text-xs">
          {'{ error: { code, message, requestId } }'}
        </code>
        . Writes accept an idempotency key where a retry is plausible. See the implementation guide
        in the repository for operational details.
      </footer>
    </main>
  )
}
