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
# curl is for the grid-apps tarball download below — ca-certificates has to
# be listed explicitly alongside it: Debian's curl package doesn't hard-depend
# on it, so `--no-install-recommends` silently drops it, and curl then fails
# every HTTPS request with "SSL CA cert" errors (exit 77) — confirmed live,
# this exact omission broke the grid-apps download below on the first try.
RUN apt-get update && apt-get install -y --no-install-recommends openssl curl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install
COPY astro.config.mjs tsconfig.json ./
COPY prisma/ prisma/
COPY bootstrap/ bootstrap/
COPY server-entry.mjs ./
COPY src/ src/
COPY public/ public/
RUN npx prisma generate
RUN npm run build

# Kiri:Moto (grid-apps) — the real slicing engine for the server-side rare
# full-slice fallback (kiriSlicer.ts's sliceModel(); the primary path runs
# client-side, served straight from the already-copied public/vendor/kiri/).
# Needs its own real source tree (its Node CLI eval-loads files directly by
# path, see src/kiri-run/cli.js) with real symlinks intact (src/ext/three.js
# etc. are symlinks in the upstream repo) — a tarball download preserves
# those correctly, confirmed by testing this exact approach in a real
# node:22-bookworm-slim container; `git clone` also works but adds a
# dependency on git at build time for no benefit. SimplyPrint/slicer is an
# actively maintained fork of GridSpace/grid-apps (same MIT license), used
# instead of the upstream repo directly per the plan's own investigation.
# npm install's postinstall (bin/npm-post) fetches manifold.wasm/manifold.js
# from static.grid.space — the only real reason npm install is needed here,
# since the CLI's own eval-loader doesn't touch node_modules for anything
# else, but running it in full (not hand-picking) matches exactly what was
# tested working this session.
RUN mkdir -p vendor && \
    curl --fail --retry 5 --retry-all-errors -sL https://github.com/SimplyPrint/slicer/archive/refs/heads/master.tar.gz -o vendor/grid-apps.tar.gz && \
    tar xzf vendor/grid-apps.tar.gz -C vendor && rm vendor/grid-apps.tar.gz && \
    mv vendor/slicer-master vendor/grid-apps && \
    cd vendor/grid-apps && npm install

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
# Set by the publish workflow to the real commit SHA (docker-publish.yml's
# build-args); stays "dev" for a plain local `docker build`/`docker compose
# up --build`. Surfaced on GET /api/health so it's possible to confirm which
# exact build is actually running on the server without guessing.
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA

# PrusaSlicer is gone entirely — replaced by Kiri:Moto, which needs no
# native binary at all (client-side: static files already under
# dist/client/vendor/kiri/, served like any other asset; server-side rare
# fallback: `node vendor/grid-apps/src/kiri-run/cli.js`, see the build stage
# above and kiriSlicer.ts). This also eliminates the whole xvfb/AVX2/Docker
# perf rabbit hole from the PrusaSlicer era — no subprocess-through-a-
# native-binary path left in the quote pipeline at all.
# openssl is for Prisma's engine detection at runtime — see the build stage
# above for why it's needed in both places. gosu lets the entrypoint start
# as root (needed once, see below) and drop to the node user before running
# anything else — safer than sudo (no shell, no setuid bit, tiny binary
# purpose-built for exactly this).
RUN apt-get update && apt-get install -y --no-install-recommends openssl gosu && rm -rf /var/lib/apt/lists/*
# /app itself needs to be node-owned so the local-disk storage fallback can
# create ./uploads on demand (src/lib/server/storage.ts) — chowning it here,
# while it's still empty, is metadata-only (nothing to duplicate).
# Everything COPY'd into it below stays root-owned on purpose: the app only
# ever reads dist/prisma/node_modules at runtime, never writes to them, so
# root ownership (world-readable by default) is enough.
RUN chown node:node /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/vendor/grid-apps ./vendor/grid-apps
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
