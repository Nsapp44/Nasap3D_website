# Build context is the repo root (see docker-compose.yml / the publish
# workflow) — not just server/ — because this image now serves the built
# Astro site too (see the web-build stage and the final COPY into ./public),
# and the Astro project lives at the repo root, a sibling of server/, not
# inside it. Every COPY below is written relative to that root accordingly.
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
COPY server/package.json server/package-lock.json* ./
RUN npm install
COPY server/ .
RUN npx prisma generate
RUN npm run build

# --- Front-end (Astro, static output) — merged into this same image so one
# Fastify process serves both the API and the site; Caddy (a separate
# container previously) is gone entirely, see Caddy.Dockerfile's git history
# and the migration plan's "Pipeline de déploiement" section. Node 22+ is
# required here (see the root package.json's engines field) — same major as
# the API's own stages below, kept in sync on purpose rather than by
# coincidence, though this stage's output is just static files discarded
# after this build, so there's no strict runtime requirement to match.
FROM node:22-alpine AS web-build
WORKDIR /web
COPY package.json package-lock.json* ./
RUN npm ci
COPY astro.config.mjs tsconfig.json ./
COPY src/ src/
COPY public/ public/
RUN npm run build

# --- PrusaSlicer CLI (real slicing happens here, server-side — never on the
# customer's machine, see server/README.md and PRICING.md) ---
# PrusaSlicer stopped shipping an official AppImage/tarball for Linux from
# 2.8.1 onward ("PrusaSlicer now depends on WebKit library, which greatly
# complicates its distribution" — see prusa3d/PrusaSlicer release notes and
# issue #13653), so there is no official prebuilt binary to just download.
# probonopd/PrusaSlicer.AppImage is a community-maintained, fully
# self-contained AppImage (bundles glibc/WebKit/GTK — explicitly documented
# to need neither libfuse nor the target system's own libraries) that keeps
# tracking the 2.9.x line. Bump the version/URL below if a newer one is
# needed; check https://github.com/probonopd/PrusaSlicer.AppImage/releases.
FROM node:22-bookworm-slim AS prusaslicer
WORKDIR /opt/prusaslicer
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN curl -fL -o PrusaSlicer.AppImage \
      https://github.com/probonopd/PrusaSlicer.AppImage/releases/download/2.9.1/PrusaSlicer-2.9.1-x86_64.AppImage \
    && chmod +x PrusaSlicer.AppImage \
    && ./PrusaSlicer.AppImage --appimage-extract \
    && rm PrusaSlicer.AppImage

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

# PrusaSlicer's CLI mode (--info / --export-gcode, see slicer.ts) needs
# xvfb-run despite never opening a real window — confirmed by building and
# running this image end-to-end (see server/README.md). xauth is xvfb-run's
# own dependency (fails with "xauth command not found" without it). openssl
# is for Prisma's engine detection at runtime — see the build stage above
# for why it's needed in both places.
RUN apt-get update && apt-get install -y --no-install-recommends xvfb xauth openssl && rm -rf /var/lib/apt/lists/*
# /app itself needs to be node-owned so the local-disk storage fallback can
# create ./uploads on demand (storage.ts) — chowning it here, while it's
# still empty, is metadata-only (nothing to duplicate). Everything COPY'd
# into it below stays root-owned on purpose: the app only ever reads
# dist/prisma/node_modules at runtime, never writes to them, so root
# ownership (world-readable by default) is enough — no need to chown any of
# that, which is what used to cost ~1.4GB (see the prusaslicer COPY below).
RUN chown node:node /app
# --chown here (metadata baked directly into this layer's content) instead
# of a later `RUN chown -R /opt/prusaslicer` — chowning *after* copying
# ~987MB of already-written files doesn't modify them in place, the overlay
# filesystem duplicates every touched file into a new layer. That duplicate
# (plus node_modules, chowned the same way in a previous version of this
# file) was nearly doubling the image for zero behavior change; xvfb-run
# still needs to write its own lock/socket files next to where it runs from,
# which is the actual reason this directory (unlike the ones above) needs to
# be node-owned at all.
COPY --from=prusaslicer --chown=node:node /opt/prusaslicer/squashfs-root /opt/prusaslicer/squashfs-root
RUN printf '#!/bin/sh\nexec xvfb-run --auto-servernum -- /opt/prusaslicer/squashfs-root/AppRun "$@"\n' > /usr/local/bin/prusa-slicer \
    && chmod +x /usr/local/bin/prusa-slicer
ENV PRUSASLICER_BIN=/usr/local/bin/prusa-slicer

COPY server/package.json server/package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/slicer-profiles ./slicer-profiles
# prisma/seed.ts imports straight from src/ (tsx runs it directly, same as
# `npm run seed` in dev) rather than the compiled dist/ output — so src/
# has to ship too, not just dist/.
COPY --from=build /app/src ./src
RUN npx prisma generate
# The Astro build's static output — served by @fastify/static as a fallback
# for any request that doesn't match a real API route (see app.ts). This is
# what used to be the separate Caddy container's whole job.
COPY --from=web-build /web/dist ./public
COPY server/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Run as the non-root `node` user the base image already ships (uid 1000) —
# least privilege: a compromised API process shouldn't have root inside its
# own container.
USER node

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
