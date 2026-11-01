# syntax=docker/dockerfile:1.7
#
# Multi-stage Next.js build for @sparx/market, the template and app marketplace.
# A standalone bundle on Node 24 alpine, built from the repository root:
#
#   docker build -f apps/market/Dockerfile \
#     --secret id=github_packages_token,env=GITHUB_PACKAGES_TOKEN \
#     --secret id=fontawesome_npm_token,env=FONTAWESOME_NPM_TOKEN \
#     -t sparx-market:tag .
#
# The platform libraries (@wizeworksllc/*) install from GitHub Packages at the
# version package.json pins; none installs the database or an auth server. The
# only workspace package is @sparx/brand, which is copied in below.

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ----- Install + build -----
FROM base AS builder

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json .npmrc ./
COPY apps/market/package.json apps/market/
# The one workspace member the app declares. The filtered install resolves
# declarations, and a member left out leaves a dangling link the build cannot
# resolve.
COPY packages/brand/package.json packages/brand/

# Both tokens reach pnpm as env vars for this one command, read from BuildKit
# secret mounts, so neither is COPYed or lands in a layer. Font Awesome falls
# back to empty, which pnpm still counts as set: an UNSET variable makes pnpm
# drop the whole .npmrc, registry lines included.
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    --mount=type=secret,id=fontawesome_npm_token \
    --mount=type=secret,id=github_packages_token,required=true \
    FONTAWESOME_NPM_TOKEN="$(cat /run/secrets/fontawesome_npm_token 2>/dev/null || true)" \
    GITHUB_PACKAGES_TOKEN="$(cat /run/secrets/github_packages_token)" \
    pnpm install --frozen-lockfile --filter @sparx/market...

COPY packages/brand packages/brand
COPY apps/market apps/market

# Stripe.js publishable key — inlined into the client bundle at BUILD time, so it
# must arrive as a build-arg (a pod env var is too late). sparx.market is
# merchant-of-record: its charges are direct charges on sparx's own platform
# account, so the platform key is the correct one. The market-specific override
# exists for a separate market-facing Stripe account; it falls back to the shared
# platform key in apps/market/components/checkout/payment-step.tsx.
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_MARKET_STRIPE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_MARKET_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_MARKET_STRIPE_PUBLISHABLE_KEY

# next.config.mjs has `output: 'standalone'` and outputFileTracingRoot pointing
# at the monorepo root for this to work.
# Stable server-action ids across builds (SI-2). No secret = Next picks a random key, as before.
RUN --mount=type=secret,id=next_actions_key \
    key="$(cat /run/secrets/next_actions_key 2>/dev/null || true)"; \
    if [ -n "$key" ]; then export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$key"; fi; \
    pnpm --filter @sparx/market build

# ----- Production runner -----
FROM node:${NODE_VERSION} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

# Standalone bundle includes the minimal node_modules + server.js for the app.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/market/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/market/.next/static ./apps/market/.next/static
# public/ is NOT bundled into standalone output — copy it explicitly so the
# default favicon fallback (favicon.ico, sparx-icon.svg) serves.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/market/public ./apps/market/public

# Next's incremental data cache lives at <distDir>/cache (apps/market/.next/cache).
# The standalone output ships .next/{standalone,static} but NOT a cache dir, so at
# runtime the dir is absent — Next can't read/write the fetch Data Cache, which
# silently degrades `next: { revalidate }` fetches. Create it writable up front.
RUN mkdir -p ./apps/market/.next/cache \
 && chown -R nextjs:nodejs ./apps/market/.next

USER nextjs

EXPOSE 3000

# The commit this image was built from; WizeLens reports it as the release (SI-2).
ARG WIZELENS_RELEASE=local
ENV WIZELENS_RELEASE=$WIZELENS_RELEASE

CMD ["node", "apps/market/server.js"]
