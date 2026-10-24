#!/usr/bin/env bash
# Render build step: install -> build web -> build API -> create DB tables.
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL (Neon connection string) in Render env vars}"
: "${VITE_CLERK_PUBLISHABLE_KEY:?Set VITE_CLERK_PUBLISHABLE_KEY (Clerk pk_test_...) in Render env vars}"

# npx so we don't need a global pnpm install (works on Render's read-only global prefix)
PNPM="npx --yes pnpm@10"

# NODE_ENV=production would skip devDependencies (the whole frontend toolchain is in devDependencies)
$PNPM install --frozen-lockfile --prod=false \
  --filter @workspace/authscope... \
  --filter @workspace/api-server... \
  --filter @workspace/db...

# The Vite config requires PORT and BASE_PATH at build time
PORT=3000 BASE_PATH=/ $PNPM --filter @workspace/authscope run build
$PNPM --filter @workspace/api-server run build

# Create/update tables (Neon is reachable from the build container)
$PNPM --filter @workspace/db run push
