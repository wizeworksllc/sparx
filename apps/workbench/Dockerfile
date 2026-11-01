# syntax=docker/dockerfile:1.7
#
# Multi-stage Next.js build for @sparx/workbench, the operator console (app.sparx.works).
# A standalone bundle on Node 24 alpine, built from the repository root:
#
#   docker build -f apps/workbench/Dockerfile \
#     --secret id=github_packages_token,env=GITHUB_PACKAGES_TOKEN \
#     --secret id=fontawesome_npm_token,env=FONTAWESOME_NPM_TOKEN \
#     -t sparx-workbench:tag .
#
# The platform libraries (@wizeworksllc/*) install from GitHub Packages at the
# version package.json pins; none installs the database or an auth server. The
# only workspace package is @sparx/brand, which is copied in below.

ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS base
RUN apk add --no-cache libc6-compat openssl
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ----- Install + build -----
FROM base AS builder

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json .npmrc ./
COPY apps/workbench/package.json apps/workbench/
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
    pnpm install --frozen-lockfile --filter @sparx/workbench...

COPY packages/brand packages/brand
COPY apps/workbench apps/workbench

# Stamp the release version into the client bundle. NEXT_PUBLIC_* is inlined at
# build time, so the JS a browser tab is running carries the version it was built
# from; the runner stage exposes the same value at runtime for /api/version to
# compare against (mismatch ⇒ a new release shipped ⇒ "reload" prompt). Declared
# right before the build so a version bump never busts the cached dependency /
# source layers above it.
ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$APP_VERSION

# PostHog product analytics — browser-side only (NEXT_PUBLIC_*), so it's inlined
# into the client bundle at build time. CI passes these to every image
# (release.yml); a build without the key simply ships PostHog disabled (the
# provider bails on `if (!key) return`). HOST defaults to PostHog US cloud.
ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
ENV NEXT_PUBLIC_POSTHOG_HOST=$NEXT_PUBLIC_POSTHOG_HOST

# NODE_OPTIONS on the RUN line, NOT an ENV: the runner stage below is a separate
# FROM and sets its own cap to match the pod's memory limit, which must never be
# shadowed by a build-time value.
#
# `next build` runs TypeScript over the whole surface layer, and at 306 surfaces
# that program no longer fits V8's DEFAULT old-space ceiling (~4 GB). It does not
# fail as a type error — the build worker dies with `Ineffective mark-compacts
# near heap limit` and `SIGABRT`, which reads as a broken build rather than a
# box that ran short. The same wall has already been hit by `@wizeworks/api-rest`
# (pre-push, CI) and `@wizeworks/api-mcp` (CI at 6144); this is the third.
#
# Each image builds on its own runner (release.yml's matrix), so 8192 is one
# build against the runner's memory rather than three sharing it. This is the
# image build on a CI runner only; never set it on a laptop.
# Stable server-action ids across builds (SI-2). No secret = Next picks a random key, as before.
RUN --mount=type=secret,id=next_actions_key \
    key="$(cat /run/secrets/next_actions_key 2>/dev/null || true)"; \
    if [ -n "$key" ]; then export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$key"; fi; \
    NODE_OPTIONS=--max-old-space-size=8192 pnpm --filter @sparx/workbench build

# ----- Production runner -----
FROM node:${NODE_VERSION} AS runner
RUN apk add --no-cache openssl
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1

# Same release version as the client bundle above, exposed at runtime so the
# /api/version route can report what this pod is serving. During a rolling deploy
# an old tab (built from APP_VERSION=A) polls a new pod (serving B) → mismatch.
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /repo/apps/workbench/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /repo/apps/workbench/.next/static ./apps/workbench/.next/static
# public/ is NOT bundled into standalone output — copy it explicitly.
COPY --from=builder --chown=nextjs:nodejs /repo/apps/workbench/public ./apps/workbench/public

USER nextjs

EXPOSE 3000

# The commit this image was built from; WizeLens reports it as the release (SI-2).
ARG WIZELENS_RELEASE=local
ENV WIZELENS_RELEASE=$WIZELENS_RELEASE

CMD ["node", "apps/workbench/server.js"]
