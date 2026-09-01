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

# Runs as root at this point (Dockerfile no longer sets USER node — see its
# comment) specifically so this chown can happen: /app/uploads is now a
# named Docker volume (docker-compose.yml's nasap3d_uploads_data, so
# quote/contact/invoice files survive redeploys instead of vanishing with
# the old container's writable layer), and a freshly created named volume
# is root-owned regardless of what the image itself chowned at build time.
# Everything from here on drops to the node user via gosu — nothing else
# needs root.
mkdir -p /app/uploads
chown -R node:node /app/uploads

exec gosu node sh -c '
set -e

echo "[entrypoint] Applying database migrations..."
npx prisma migrate deploy

echo "[entrypoint] Syncing catalogue + seed accounts..."
npx tsx prisma/seed.ts

echo "[entrypoint] Starting server..."
exec node server-entry.mjs
'
