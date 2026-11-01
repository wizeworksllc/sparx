# syntax=docker/dockerfile:1.7
#
# Multi-stage Next.js build for the @sparx/web marketing site (sparx.works).
# A standalone bundle on Node 24 alpine, built from the repository root:
#
#   docker build -f apps/web/Dockerfile \
#     --secret id=github_packages_token,env=GITHUB_PACKAGES_TOKEN \
#     --secret id=fontawesome_npm_token,env=FONTAWESOME_NPM_TOKEN \
#     -t sparx-web:tag .
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
COPY apps/web/package.json apps/web/
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
    pnpm install --frozen-lockfile --filter @sparx/web...

COPY packages/brand packages/brand
COPY apps/web apps/web

# PostHog analytics — NEXT_PUBLIC_* is inlined at build time, so the key must be
# present during `next build`; runtime env can't reach an already-bundled client
# JS. Passed as a build-arg from release.yml. Absent ⇒ the provider no-ops
# (`if (!key) return`), so a build without the arg simply ships PostHog disabled.
# HOST carries the canonical default so a plain `docker build` needs no arg.
ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# next.config.ts must have `output: 'standalone'` and outputFileTracingRoot
# pointing at the monorepo root for this to work.
# Stable server-action ids across builds (SI-2). No secret = Next picks a random key, as before.
RUN --mount=type=secret,id=next_actions_key \
    key="$(cat /run/secrets/next_actions_key 2>/dev/null || true)"; \
    if [ -n "$key" ]; then export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$key"; fi; \
    pnpm --filter @sparx/web build

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
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/.next/static ./apps/web/.next/static
# public/ is NOT bundled into standalone output — copy it explicitly so the
# manifest icons (android-chrome-*.png) and schema logo (icon.png) serve.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

# The commit this image was built from; WizeLens reports it as the release (SI-2).
ARG WIZELENS_RELEASE=local
ENV WIZELENS_RELEASE=$WIZELENS_RELEASE

CMD ["node", "apps/web/server.js"]
