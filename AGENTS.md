# Iskina SME — project rules (all agents and teammates)

`iskina-sme` is the core for micro, small and medium business operations: MSME
onboarding, catalog, order/booking processing, storefront theming and merchant
analytics. It is a **separate service** from the HATOD consumer app, which
consumes it through a versioned channel API and renders its published themes.

## 1. Boundary (do not blur it)

| System         | Owns                                                                                      | Does **not** own                         |
| -------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| `iskina-sme`   | tenants, businesses, staff, catalog, vertical configs, orders/bookings, themes, analytics | ride dispatch, driver matching, rider UX |
| `iskina-hatod` | consumer app, rider/driver accounts, dispatch, delivery job execution, wallet movement    | merchant catalog, MSME operations        |

- `iskina-sme` is the **system of record** for merchant data and order state.
- HATOD calls `/api/v1`; it never writes merchant tables directly.
- HATOD's marketplace module is being re-pointed behind
  `MARKETPLACE_BACKEND=internal|iskina-sme`; no table is dropped until a full
  delivery and booking cycle runs through the new path in staging.
- One Flutter merchant app (`apps/merchant`) is runtime-branded per business.
  There are **no per-SME app binaries** in v1.

## 2. Stack and ports

| Layer     | Choice                                                                  |
| --------- | ----------------------------------------------------------------------- |
| Web + API | Next.js 16 App Router, React 19, Tailwind 4                             |
| Database  | PostgreSQL 16 + Drizzle ORM                                             |
| Domain    | `@iskina/core` — framework-free rules (state machines, pricing, themes) |
| Contracts | `@iskina/contracts` — zod schemas shared by web and the Flutter client  |
| Monorepo  | pnpm workspaces + Turborepo                                             |
| Mobile    | Flutter (Android-first) + Kotlin platform layer                         |
| Lint/fmt  | Biome                                                                   |

Local ports: web `:3008`, Postgres `:5437`. Do not reuse HATOD's `3000–3007` or
the suite's `5432/5434/5436`.

## 3. Commands

```bash
pnpm install
cp .env.example .env
pnpm db:up            # Postgres on :5437
pnpm db:generate      # drizzle-kit generate after schema changes
pnpm db:migrate
pnpm db:seed
pnpm dev              # web on :3008
pnpm lint && pnpm typecheck && pnpm test

cd apps/merchant
flutter pub get
flutter analyze && flutter test
```

Android builds need a JDK 17 + Android SDK; analyze/test do not.

## 4. Non-negotiable rules

1. **Tenant isolation is a security boundary.** Every tenant-owned query goes
   through the repository layer with a tenant context. No raw table access from
   route handlers. RLS is the second wall, never the only one. A test that
   proves one tenant cannot read another's rows is required for every new
   tenant-scoped table.
2. **Money is integer centavos.** No floats, no formatted strings in the
   database or API. Totals are always computed server-side; a client total is
   never trusted.
3. **State machines are server-side and data-driven.** `FOOD` and `AIRCON`/`LPG`
   transitions live in `@iskina/core`. An invalid transition is a `409`, never a
   silent write. `updateMany({ where: { id, status } })` guards races.
4. **The theme manifest is an allowlist, not CSS.** Only the documented tokens
   may be published. Contrast is validated (WCAG AA) on publish. Published
   versions are immutable; edits create a new version.
5. **Every mutating API is idempotent** where a retry is plausible (order
   placement, transitions, cash confirmation) via `Idempotency-Key`.
6. **TDD for logic.** Write the failing test first, then the minimal code. Break
   the guard once and watch the test fail before restoring it.
7. **Analytics are tenant-scoped aggregates.** No PII in rollups. Day boundaries
   use the business timezone (`Asia/Manila` default), never UTC. Rollups are
   idempotent and recomputable.
8. **Secrets never enter the repo.** `.env*` is gitignored; use
   `{env:...}`-style indirection in config. Never log keys, tokens or codes.
9. **Migrations are forward-only** and committed under `packages/db/drizzle`.
   Never edit an applied migration.
10. **Conventional commits**, `feature/*` branches. Do not commit unless asked.

## 5. Repository map

```
apps/
  web/          dashboard + /api/v1 (channel + merchant) + webhooks + worker
  merchant/     Flutter app + android Kotlin platform layer (M4b)
packages/
  core/         state machines, pricing, theme presets/validation, analytics defs
  db/           Drizzle schema, migrations, tenant context, seeds
  contracts/    zod request/response schemas and shared types
  config/       shared tsconfig
```

## 6. API contracts

- Channel (HATOD): bearer `sk_test_`/`sk_live_`, scoped per business.
- Platform channel: `CHANNEL_PLATFORM_KEY` (server env, constant-time compare)
  unlocks `/api/v1/channel/storefronts*` and cross-business quotes/orders. It is
  never stored or returned. Business keys cannot list storefronts.
- Merchant app: staff session (OTP delegated to `iskina-otp`).
- Mobile auth: `POST /api/v1/auth/verify` with `client: "mobile"` returns a
  `sessionToken`; the Flutter app sends it as `Authorization: Bearer`. The web
  keeps the HttpOnly cookie, and a channel `sk_` key is never a session.
- Catalog: `/api/v1/catalog*`; owners and managers write, staff read. Prices are
  integer centavos and a category must belong to the same business as the item.
- Orders: `/api/v1/channel/quotes` (`catalog:read`) and `/channel/orders`
  (`orders:write`), plus `/api/v1/merchant/orders*` for the board. Totals are
  computed server-side; placement is idempotent per business key.
- Errors: `{ error: { code, message, requestId } }`.
- Writes accept `Idempotency-Key`; webhooks are HMAC-signed and retried.
- OpenAPI at `/api/openapi`.
- Versioning: `/api/v1`, additive changes only; a breaking change is `/api/v2`.

## 7. Themes

- Presets: `ferrari` (Rosso, default), `alibaba` (Ember), `ocean`, `forest`,
  `mono`. IDs are internal; UI labels are neutral ("Rosso"), never a third-party
  trademark.
- Tokens: `primary`, `onPrimary`, `accent`, `onAccent`, `surface`,
  `surfaceMuted`, `onSurface`, `outline`, `success`, `warning`, `danger`.
- `layout`: `grid | list | compact`; `radius`: `sm | md | lg | full`;
  `font`: `sans | serif | rounded`.
- HATOD and the merchant app render the same manifest natively. No webview, no
  remote code, no arbitrary CSS.
- Publishing never mutates an old row: the server assigns the next version under
  a business row lock, and HATOD reads the latest via `/api/v1/channel/theme`.
- Button text (`onPrimary`, `onAccent`) is derived server-side for contrast; the
  client cannot choose an unreadable pairing.

## 8. Analytics

Analytics are computed from `orders` and `order_events`, grouped by the
business's local day (never UTC). The merchant summary API and insights page are
live. **Rollups and 12-month materialization are not built yet** — that is M6, so
do not describe the pipeline as a 5-minute rollup until it exists. No PII in
aggregates, and every query runs in tenant context.

## 9. Current milestone

M5a shipped — platform channel key, storefront discovery, storefront payload
(catalog + theme), and cross-business quotes/orders. See
`docs/hatod-channel.md`. Next: M5b, the HATOD adapter behind
`MARKETPLACE_BACKEND`, then parity in staging.

## 10. Coolify

`Dockerfile` targets: `web` (standalone server on `:3000`) and `migrate`
(one-shot). `docker-compose.coolify.yml` runs `postgres → migrate → web`.
Keep `SEED_DEMO_DATA=false` in production and read `COOLIFY.md` before changing
the stack. Never bake secrets into images or compose defaults.
