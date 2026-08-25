#!/bin/sh
# Runs on every container start (see Dockerfile ENTRYPOINT) so the host only
# ever needs `docker compose up` — no separate `npm install` / `prisma
# migrate deploy` / `npm run seed` step on the server. Safe to run every
# time: `migrate deploy` only applies migrations not yet applied, and
# prisma/seed.ts is upsert-based (never overwrites admin-edited pricing —
# see its own comments), so re-running it on every deploy just keeps the
# catalogue (materials/colors/quality profiles/discount tiers) in sync with
# the code without resetting anything an admin configured through the app.
set -e

echo "[entrypoint] Applying database migrations..."
npx prisma migrate deploy

echo "[entrypoint] Syncing catalogue + seed accounts..."
npx tsx prisma/seed.ts

echo "[entrypoint] Starting API..."
exec node dist/index.js
