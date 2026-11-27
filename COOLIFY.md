# Deploying on Coolify

The repo ships one Dockerfile with two targets and a compose stack:

| Target    | Purpose                                       |
| --------- | --------------------------------------------- |
| `web`     | Next.js standalone server on `:3000`          |
| `migrate` | One-shot Drizzle migrations (optionally seed) |

`docker-compose.coolify.yml` wires `postgres → migrate → web` with health checks
and a persistent `pgdata` volume.

## 1. Create the resource

In Coolify: **New Resource → Docker Compose**.

- Repository: your `iskina-sme` remote
- Branch: `main` (or `develop`)
- Compose file: `docker-compose.coolify.yml`
- Base directory: `/`

## 2. Environment variables

Copy [`.env.coolify.example`](./.env.coolify.example) into the resource.

Required:

```dotenv
POSTGRES_PASSWORD=...            # alphanumeric
APP_URL=https://your-domain      # domain attached to the web service
AUTH_SECRET=...                  # openssl rand -hex 32
```

Optional:

```dotenv
THEME_DEFAULT_PRESET=alibaba     # Ember default
ISKINA_OTP_BASE_URL=...
ISKINA_OTP_API_KEY=...
SEED_DEMO_DATA=false             # keep false in production
```

`NEXT_PUBLIC_APP_URL` is derived from `APP_URL`; do not set both.

## 3. Domain and port

- Attach the public domain to the **web** service.
- Container port: `3000`.
- Health check path: `/api/health` (returns `503` when Postgres is unreachable).
- **postgres** and **migrate** need no domain.

Coolify detects `expose: 3000`. If it asks for a port mapping, use `3000`.

## 4. First deploy

1. Deploy. `migrate` must finish successfully before `web` starts.
2. Confirm the health endpoint:

   ```bash
   curl -fsS https://your-domain/api/health
   # {"service":"iskina-sme","version":"0.1.0","status":"ok","database":"ok",...}
   ```

3. Open `https://your-domain/` — the status page should show `DB ok`.

`migrate` is idempotent. It never drops data and never seeds demo tenants unless
`SEED_DEMO_DATA=true`. Do not run `pnpm db:seed` against production.

## 5. Using a managed Postgres

The stack includes its own Postgres for one-click deploys. To use Coolify's
database resource instead:

1. Remove the `postgres` service and the `depends_on` / `pgdata` references.
2. Set `DATABASE_URL` in the `web` and `migrate` services to the managed
   connection string.

## 6. Backups and updates

- Back up the `pgdata` volume (or the managed database) before upgrades.
- Migrations are forward-only. A rollback of the app image is safe as long as
  the schema change was additive; otherwise restore the database backup.
- Redeploying rebuilds only the changed layers; the dependency layer is cached
  on `package.json` / `pnpm-lock.yaml`.

## 7. Local smoke test of the production stack

```bash
AUTH_SECRET=dev-only-secret APP_URL=http://localhost:3008 POSTGRES_PASSWORD=iskina \
  docker compose -f docker-compose.coolify.yml -f docker-compose.coolify.local.yml up --build
```

Then `curl -fsS http://localhost:3008/api/health`. Tear down with `down -v` to
remove the throwaway database.

## 8. Troubleshooting

| Symptom                   | Check                                                                  |
| ------------------------- | ---------------------------------------------------------------------- |
| `web` never starts        | `migrate` logs — it may be waiting on Postgres                         |
| `/api/health` returns 503 | `DATABASE_URL`, Postgres health, password escaping                     |
| 502 from Coolify          | domain attached to `web`, container port `3000`, `HOSTNAME=0.0.0.0`    |
| Build fails on lockfile   | commit `pnpm-lock.yaml`; CI and Docker use `--frozen-lockfile`         |
| Old assets after deploy   | confirm the `web` image rebuilt; static files come from `.next/static` |
