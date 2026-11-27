# iskina-sme

Core for micro, small and medium business operations — MSME onboarding, catalog,
order and booking processing, storefront theming, and merchant analytics.

It is a **separate service** from the HATOD consumer app. HATOD calls the
versioned channel API, renders the published theme manifests, and hands delivery
execution to its own dispatch.

## Status

**M5a — HATOD channel surface.** OTP auth, RLS tenancy, catalog, keys, orders,
analytics, SSE/push, themes, the Flutter merchant app, and a platform-key channel
API for HATOD: storefront discovery, storefront payload with catalog + theme,
quotes and idempotent orders.

See [`AGENTS.md`](./AGENTS.md) for the boundary, rules and roadmap.

## Stack

| Layer     | Choice                                          |
| --------- | ----------------------------------------------- |
| Web + API | Next.js 16 App Router, React 19, Tailwind 4     |
| Database  | PostgreSQL 16 + Drizzle ORM                     |
| Domain    | `@iskina/core` — framework-free rules           |
| Contracts | `@iskina/contracts` — zod schemas               |
| Monorepo  | pnpm workspaces + Turborepo                     |
| Mobile    | Flutter (Android-first) + Kotlin platform layer |
| Lint/fmt  | Biome                                           |

## Quickstart

Requirements: Node 24+, pnpm 12+, Docker.

```bash
pnpm install
cp .env.example .env
pnpm db:up            # Postgres on localhost:5437 + non-superuser app role
pnpm db:migrate
pnpm db:seed          # demo tenant: Aling Nena's
pnpm dev              # http://localhost:3008
```

The database is only initialised once per volume. If you are coming from an
older checkout, reset the local volume so `db/init` can create `iskina_app`:

```bash
docker compose down -v && pnpm db:up
```

Check the service:

```bash
curl -s http://localhost:3008/api/health
```

Quality gates (also run in CI):

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Deployment (Coolify)

The repo ships a multi-target `Dockerfile` (`web`, `migrate`),
`docker-compose.coolify.yml`, and `.env.coolify.example`. Coolify deploys the
compose stack as `postgres → migrate → web`, with the web container exposed on
`3000` and health-checked at `/api/health`.

See [`COOLIFY.md`](./COOLIFY.md) for the resource setup, environment variables,
domain, backups and troubleshooting.

Local smoke test of the production stack:

```bash
AUTH_SECRET=dev-only-secret APP_URL=http://localhost:3008 POSTGRES_PASSWORD=iskina \
  DB_APP_PASSWORD=iskina_app \
  docker compose -f docker-compose.coolify.yml -f docker-compose.coolify.local.yml up --build
```

## Layout

```
apps/
  web/          dashboard + /api/v1 (channel + merchant) + webhooks + worker
  merchant/     Flutter merchant app (M4b)
packages/
  core/         state machines, pricing, theme presets/validation, analytics defs
  db/           Drizzle schema, migrations, tenant context, seeds
  contracts/    zod schemas shared by web and the Flutter client
  config/       shared tsconfig
```

## Default theme

Every business starts on the **Rosso** preset (internal id `ferrari`): racing red
`#D40000` with white button text, a Giallo accent and near-black surfaces.
Businesses override it in the theme editor; every publish creates an immutable
version. Ember, Ocean, Forest and Mono remain available.

## Milestones

| #   | Deliverable                                                       |
| --- | ----------------------------------------------------------------- |
| M0  | Scaffold, AGENTS.md, Docker, migrations, CI, `/api/health`        |
| M1  | Tenancy, owners/staff, OTP sessions, API keys + scopes, audit     |
| M1b | RLS policies + non-superuser app role                             |
| M2  | Catalog + vertical configs (food, aircon, LPG)                    |
| M3  | Order/booking ops: state machines, board API, SSE, push, webhooks |
| M3b | Analytics API + merchant insights (live queries)                  |
| M4  | Theme manifest, editor, presets, versioned publish                |
| M4b | Flutter merchant app: auth, board, Insights, Kotlin services      |
| M5  | HATOD channel: discovery, theme, quote, checkout, status sync     |
| M5b | HATOD adapter behind `MARKETPLACE_BACKEND` + staging parity       |
| M6  | Full analytics dashboard, CSV, commission/billing                 |
| M7  | Hardening, iOS parity                                             |
