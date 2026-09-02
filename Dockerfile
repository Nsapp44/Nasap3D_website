# Build context is the repo root (see docker-compose.yml / the publish
# workflow). Single Astro SSR app now — the API and the site are the same
# build, not two separate stages merged together after the fact like the
# pre-migration Dockerfile (server/Dockerfile, now deleted) had to do.
FROM node:22-bookworm-slim AS build
WORKDIR /app
# Prisma's engine-selection at `generate` time (and again at runtime, see the
# final stage below) shells out to detect the installed OpenSSL version to
# pick the right query-engine binary — without the openssl package present,
# it can't detect anything and silently guesses "openssl-1.1.x" instead of
# actually checking, which may not match what's really on Debian Bookworm
# (OpenSSL 3.x by default). Installing it here makes `prisma generate` bake
# in the binary that actually matches the target OS instead of a guess.
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install
COPY astro.config.mjs tsconfig.json ./
COPY prisma/ prisma/
COPY bootstrap/ bootstrap/
COPY slicer-profiles/ slicer-profiles/
COPY server-entry.mjs ./
COPY src/ src/
COPY public/ public/
RUN npx prisma generate
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
# Set by the publish workflow to the real commit SHA (docker-publish.yml's
# build-args); stays "dev" for a plain local `docker build`/`docker compose
# up --build`. Surfaced on GET /api/health so it's possible to confirm which
# exact build is actually running on the server without guessing.
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA

# PrusaSlicer via Debian's own package instead of the community AppImage
# (probonopd/PrusaSlicer.AppImage) used until now. Switched after a real
# perf investigation: the AppImage needed xvfb-run for every single --info/
# --export-gcode call despite never opening a window (confirmed via
# LD_DEBUG=libs — it initializes the full GL/EGL/GLX stack even for --help),
# and separately, quote generation was measured 100x+ slower in production
# than on any dev machine with the CPU otherwise sitting near-idle — not
# explained by CPU throttling or xvfb overhead alone in side-by-side
# testing. The apt package needs no xvfb at all (verified: --info/
# --export-gcode both run directly, no display of any kind) and was ~16-30%
# faster in every local comparison against the AppImage, throttled or not.
# Trade-off: this is PrusaSlicer 2.5.0 (Debian bookworm's version), older
# than the AppImage's 2.9.1 — support_material_style=snug (the only
# non-default support option this project relies on, see
# src/lib/server/slicer.ts) already exists in 2.5.0, confirmed via
# --help-fff before switching.
# openssl is for Prisma's engine detection at runtime — see the build stage
# above for why it's needed in both places. gosu lets the entrypoint start
# as root (needed once, see below) and drop to the node user before running
# anything else — safer than sudo (no shell, no setuid bit, tiny binary
# purpose-built for exactly this).
RUN apt-get update && apt-get install -y --no-install-recommends prusa-slicer openssl gosu && rm -rf /var/lib/apt/lists/*
# /app itself needs to be node-owned so the local-disk storage fallback can
# create ./uploads on demand (src/lib/server/storage.ts) — chowning it here,
# while it's still empty, is metadata-only (nothing to duplicate).
# Everything COPY'd into it below stays root-owned on purpose: the app only
# ever reads dist/prisma/node_modules at runtime, never writes to them, so
# root ownership (world-readable by default) is enough.
RUN chown node:node /app
ENV PRUSASLICER_BIN=/usr/bin/prusa-slicer

COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/slicer-profiles ./slicer-profiles
COPY --from=build /app/bootstrap ./bootstrap
COPY --from=build /app/server-entry.mjs ./
# prisma/seed.ts imports straight from src/lib/server/ (tsx runs it
# directly, same as `npm run seed` in dev) rather than any compiled output
# — so src/lib/server/ has to ship too. The rest of src/ (Astro
# pages/components) is already baked into dist/ by the build stage and
# isn't needed at runtime.
COPY --from=build /app/src/lib/server ./src/lib/server
RUN npx prisma generate
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# No USER directive here (was `USER node`): the entrypoint now needs to
# start as root to chown the /app/uploads named volume (see
# docker-entrypoint.sh), then drops to the non-root `node` user itself via
# gosu before running anything else — same end state (nothing app-level
# ever runs as root), just root for one chown instead of for the whole
# process lifetime.

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
