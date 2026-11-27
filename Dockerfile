# syntax=docker/dockerfile:1

# Coolify targets:
#   web     — Next.js standalone server on :3000
#   migrate — one-shot migrations (optionally seeds demo tenants)
#
# Build context is the repository root; see docker-compose.coolify.yml.

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@12.14.0 --activate
WORKDIR /app

# Install dependencies from manifests only, so source edits do not bust the cache.
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/core/package.json packages/core/package.json
COPY packages/db/package.json packages/db/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
# Build-time placeholder: every DB read is force-dynamic, so no connection is made.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
COPY . .
RUN pnpm build

# ---------------------------------------------------------------------------
# Web: Next.js standalone server
# ---------------------------------------------------------------------------
FROM node:24-bookworm-slim AS web
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.js"]

# ---------------------------------------------------------------------------
# Migrations: one-shot job, exits 0 when the schema is current
# ---------------------------------------------------------------------------
FROM base AS migrate
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=builder /app/packages ./packages
CMD ["pnpm", "--filter", "@iskina/db", "migrate"]
