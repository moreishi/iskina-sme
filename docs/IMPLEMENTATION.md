# Iskina SME — Implementation Guide

This document describes how the service is built, operated and tested. The
HATOD integration contract lives separately in
[`hatod-channel.md`](./hatod-channel.md).

## 1. Purpose and boundaries

`iskina-sme` is the operations core for micro, small and medium businesses.
HATOD remains the consumer app; merchants use the web dashboard and the Flutter
“Iskina Business” app.

| System | Owns | Does not own |
| --- | --- | --- |
| iskina-sme | tenants, businesses, staff, catalog, vertical configs, orders/bookings, themes, analytics, channel API | rider dispatch, driver matching, consumer UX |
| iskina-hatod | consumer app, rider/driver identity, dispatch, delivery execution, wallet | merchant catalog, MSME operations |

HATOD reaches this service only through `/api/v1/channel/*`. Order state lives
here; delivery execution stays in HATOD.

## 2. Architecture

```text
web dashboard ─┐
Flutter app ───┼── /api/v1 ── Next.js route handlers ── repositories ── Postgres (RLS)
HATOD ─────────┘                                   ├── object storage (images)
simulator ─────┘                                   └── FCM seam (push)
```

A modular monolith: one Next.js app, framework-free domain rules in
`@iskina/core`, Drizzle repositories in `@iskina/db`.

## 3. Stack and ports

| Layer | Choice |
| --- | --- |
| Web/API | Next.js 16 App Router, React 19, Tailwind 4 |
| Database | PostgreSQL 16 + Drizzle ORM (`:5437` locally) |
| Domain | `@iskina/core` |
| Contracts | `@iskina/contracts` (zod) |
| Monorepo | pnpm workspaces + Turborepo, Biome |
| Web port | `:3008` |
| Mobile | Flutter 3.47, Kotlin platform layer |
| Simulator | TypeScript + tsx |

## 4. Repository layout

```text
apps/
  web/          dashboard, /api/v1, channel + merchant routes
  merchant/     Flutter app + Kotlin bridge
  simulator/    virtual consumer/merchant agents
packages/
  core/         state machines, pricing, themes, analytics time
  db/           schema, migrations, RLS context, repositories
  contracts/    shared zod schemas and enums
  config/       shared tsconfig
docs/           HATOD channel contract, this guide
```

## 5. Data model

| Table | Purpose |
| --- | --- |
| `tenants`, `users`, `memberships` | tenancy root, identities, roles (`owner`, `manager`, `staff`) |
| `sessions`, `otp_challenges` | hashed sessions and OTP state |
| `api_keys` | business-scoped channel credentials |
| `businesses` | store, vertical, timezone, lat/lng, theme/vertical overrides |
| `catalog_categories`, `catalog_items` | menu with integer-centavo prices and `image_url` |
| `customers`, `orders`, `order_lines`, `order_events` | order lifecycle, snapshots, append-only history |
| `theme_versions` | immutable published manifests |
| `device_tokens` | merchant push tokens |
| `audit_logs` | user/API-key actions |

RLS is enabled and forced on every tenant table. Each request opens
`withTenant()` or `withUser()`, which sets `app.tenant_id` / `app.user_id` /
`app.api_key_hash` for the transaction. The app connects as the non-superuser
`iskina_app`; `iskina` is the admin/init role.

Platform discovery is the one controlled cross-tenant read:
`storefront_directory`, `storefront_by_slug` and `storefront_by_id` are
`SECURITY DEFINER` functions gated by a transaction-local `app.platform` GUC,
exposing only public columns.

## 6. Authentication and authorization

- **Web:** phone OTP → hashed session token in an HttpOnly cookie.
- **Mobile:** `POST /auth/verify` with `client: "mobile"` returns
  `sessionToken`; sent as `Authorization: Bearer`. Web cookies are not required.
- **OTP:** delegated to `iskina-otp` when `ISKINA_OTP_API_KEY` is set; otherwise
  a dev code is generated and shown only when `AUTH_EXPOSE_DEV_OTP` is on.
- **Channel keys:** `sk_test_`/`sk_live_`, SHA-256 at rest, scoped
  (`storefront:read`, `catalog:read`, `themes:read`, `orders:read`,
  `orders:write`, `analytics:read`).
- **Platform key:** `CHANNEL_PLATFORM_KEY`, constant-time compare, never stored,
  unlocks discovery and cross-business orders.
- **Roles:** owners manage keys/themes/catalog; managers catalog/orders; staff
  orders and catalog reads.

## 7. Catalog and verticals

- Prices are integer centavos; totals are computed server-side only.
- Categories and items are tenant-scoped; an item’s category must belong to the
  same business.
- Vertical presets in `@iskina/core` merge with per-business overrides:
  - `food` — delivery, prep, base fee + per-km
  - `aircon` — booking, schedule required, 60-minute slots, no delivery fee
  - `lpg` — delivery with tank/refill intake
- Item images: multipart upload → magic-byte validation → sharp resize
  (≤1600px, EXIF stripped, WebP q82) → local disk (dev) or S3/R2 (prod). SVG is
  rejected.

## 8. Orders and bookings

Two state machines, selected by vertical:

```text
DELIVERY  PLACED → ACCEPTED → PREPARING → READY → OUT_FOR_DELIVERY → DELIVERED → COMPLETED
BOOKING   PLACED → ACCEPTED → SCHEDULED → IN_PROGRESS → COMPLETED
both      PLACED → REJECTED | CANCELLED | EXPIRED
```

- Terminal states never move.
- Merchant, customer, rider and system actors have different allowed targets.
- `applyTransition` updates with `where status = from`, so races return `409`,
  never a double write.
- Customer cancellation is allowed until work starts (`PREPARING` or
  `SCHEDULED`).
- Order numbers are human-readable; placement is idempotent per business key.
- Cash is confirmed explicitly after delivery.

## 9. Channel API (HATOD)

| Route | Auth | Purpose |
| --- | --- | --- |
| `GET /channel/storefronts` | platform | active storefronts |
| `GET /channel/storefronts/:slug` | platform | business + config + theme + available catalog |
| `POST /channel/quotes` | catalog:read | server-side price |
| `POST /channel/orders` | orders:write | place order/booking, idempotent |
| `GET /channel/orders/:id` | orders:read | status + lines + event timeline |
| `POST /channel/orders/:id/cancel` | orders:write | customer cancellation |
| `GET /channel/theme` | themes:read | published theme or default preset |

Only active businesses and available items appear. Order status changes are
polled today; webhooks are not built.

## 10. Themes

- Presets: `ferrari` (**Rosso**, default), `alibaba` (Ember), `ocean`, `forest`,
  `mono`.
- Manifest: version, layout (`grid|list|compact`), light + dark tokens,
  logo/banner assets.
- Tokens are an allowlist; contrast is validated on publish; `onPrimary` /
  `onAccent` are derived for AA.
- Publishing locks the business row and assigns the next immutable version.
- Unpublished businesses fall back to the default preset.

## 11. Analytics

Live SQL over `orders`, `order_events` and `order_lines`, grouped by the
business’s local day. Metrics: GMV, orders, AOV, net sales, delivery fees,
acceptance, cancellations/rejections/expiry, prep and fulfillment percentiles,
daily series, top items, peak hours, previous-period deltas.

Rollups and 12-month materialization are **not built**; they are an M6 item.

## 12. Realtime and push

- SSE: `GET /api/v1/merchant/events?businessId=` emits when the newest order’s
  `updatedAt` changes; the web board and Flutter app refetch on the event.
- Device tokens: `POST /api/v1/merchant/devices`, tenant-isolated.
- Push: FCM legacy seam on new orders. Without `FCM_SERVER_KEY` it logs and
  skips. Real device registration needs the Firebase project.

## 13. Mobile app

- Package `com.iskinacc.sme`, label **Iskina Business**.
- Screens: login, business switcher, order board, insights, settings.
- Stores the bearer token in secure storage; restores the session on launch.
- Theme tokens from the selected business drive the Material theme.
- Kotlin: `OrderAlertService` foreground notification and a printer stub.
- Debug builds use `API_URL=http://127.0.0.1:3008` + `adb reverse`; release uses
  `https://sme.iskina.cc`.
- Signing: `android/key.properties` + `android/iskina-release.jks`, both
  gitignored. Back them up.

See [`apps/merchant/README.md`](../apps/merchant/README.md) for build and device
commands.

## 14. Simulator

```bash
pnpm sim:seed
pnpm sim:food | aircon | lpg | failures
pnpm sim:mixed --orders=20 --concurrency=5
pnpm sim:load  --orders=100 --concurrency=10
pnpm sim:traffic --duration=10m --rate=2 --failure-rate=0.1
pnpm sim:traffic --business=aling-nena --orders=10
pnpm sim:replay sim-reports/<file>.json
```

Black-box agents against the real API; no DB writes. Remote targets require
`SIM_ALLOW_REMOTE=1`, production adds `SIM_ALLOW_PRODUCTION=1`. Staging needs
`AUTH_ALLOW_DEV_OTP` + `AUTH_EXPOSE_DEV_OTP`. See
[`apps/simulator/README.md`](../apps/simulator/README.md).

## 15. Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL`, `DATABASE_ADMIN_URL` | app role / test-only superuser |
| `DB_APP_USER`, `DB_APP_PASSWORD` | init script role |
| `AUTH_SECRET`, `AUTH_EXPOSE_DEV_OTP`, `AUTH_ALLOW_DEV_OTP`, `SESSION_TTL_DAYS` | sessions and dev OTP |
| `ISKINA_OTP_BASE_URL`, `ISKINA_OTP_API_KEY` | OTP delegation |
| `CHANNEL_PLATFORM_KEY` | HATOD platform credential |
| `FCM_SERVER_KEY` | push seam |
| `S3_*`, `UPLOAD_MAX_BYTES` | item images |
| `THEME_DEFAULT_PRESET` | default storefront preset |

Secrets are never committed. `.env*` is gitignored except examples.

## 16. Local development

```bash
pnpm install
cp .env.example .env
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Quality gates:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cd apps/merchant && flutter analyze && flutter test
```

## 17. Deployment (Coolify)

- Docker targets: `web` (standalone, `:3000`) and `migrate` (one-shot).
- Compose: `postgres → migrate → web`, with `pgdata`.
- A fresh volume runs `db/init/01-app-role.sh`; existing volumes need the
  documented manual role/ownership fix.
- Set `APP_URL`, `AUTH_SECRET`, `DB_APP_PASSWORD`, `CHANNEL_PLATFORM_KEY`, and
  S3/R2 credentials.
- Health: `/api/health`; migrations are forward-only.

See [`COOLIFY.md`](../COOLIFY.md).

## 18. Security rules

1. Tenant isolation is a security boundary: repository filter + RLS.
2. Never trust client totals, transitions or content types.
3. Money is integer centavos.
4. Themes are an allowlist with AA validation.
5. API keys and OTP codes are hashed; the platform key is never persisted.
6. Images: magic bytes, size cap, re-encode, no SVG.
7. Every mutating route is idempotent where retry is plausible.
8. The simulator refuses production without explicit double opt-in.

## 19. Known gaps

- HATOD adapter/cutover and parity testing are not done.
- No status webhooks (polling only).
- No order-expiry sweep.
- Analytics rollups/12-month materialization missing.
- Commission/billing not implemented.
- FCM not wired; printer stub; iOS not built.
- Discovery has no city/radius filters.
- No browser/API end-to-end suite beyond unit, RLS and simulator runs.
