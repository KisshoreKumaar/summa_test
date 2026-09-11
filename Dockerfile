# syntax=docker/dockerfile:1

# =============================================================================
# Base — pinned Node version shared by every stage.
# =============================================================================
# Node 22+ is required: @supabase/supabase-js needs a native WebSocket, which
# Node 20 does not provide. Next.js polyfills it for the app, but plain-Node
# scripts (scripts/seed.ts) crash on startup without it.
FROM node:22-alpine AS base
WORKDIR /app
# Next's SWC binaries need libc compatibility on Alpine.
RUN apk add --no-cache libc6-compat

# =============================================================================
# deps — install node_modules once, cached on the lockfile alone.
# =============================================================================
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# =============================================================================
# dev — hot-reloading dev server. Source arrives via a bind mount at runtime.
# =============================================================================
FROM base AS dev
ENV NODE_ENV=development
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
EXPOSE 3000
# Bind to 0.0.0.0 so the port is reachable from outside the container.
CMD ["npm", "run", "dev", "--", "--hostname", "0.0.0.0"]

# =============================================================================
# builder — production build.
# =============================================================================
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next build inlines NEXT_PUBLIC_* values, so they must exist at build time.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN=$NEXT_PUBLIC_COLLEGE_EMAIL_DOMAIN

RUN npm run build

# =============================================================================
# runner — minimal production image running as a non-root user.
# =============================================================================
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["npm", "run", "start"]

# =============================================================================
# ci — typecheck, lint, and build verification. Not a long-running service.
# =============================================================================
FROM base AS ci
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["sh", "-c", "npm run typecheck && npm run lint"]
