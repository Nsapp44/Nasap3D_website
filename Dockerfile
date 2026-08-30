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

# --- PrusaSlicer CLI (real slicing happens here, server-side — never on the
# customer's machine) — reproduced unchanged from the pre-migration
# Dockerfile. PrusaSlicer stopped shipping an official AppImage/tarball for
# Linux from 2.8.1 onward ("PrusaSlicer now depends on WebKit library, which
# greatly complicates its distribution" — see prusa3d/PrusaSlicer release
# notes and issue #13653), so there is no official prebuilt binary to just
# download. probonopd/PrusaSlicer.AppImage is a community-maintained, fully
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
# Set by the publish workflow to the real commit SHA (docker-publish.yml's
# build-args); stays "dev" for a plain local `docker build`/`docker compose
# up --build`. Surfaced on GET /api/health so it's possible to confirm which
# exact build is actually running on the server without guessing.
ARG GIT_SHA=dev
ENV GIT_SHA=$GIT_SHA

# PrusaSlicer's CLI mode (--info / --export-gcode, see src/lib/server/
# slicer.ts) needs xvfb-run despite never opening a real window — confirmed
# by building and running this image end-to-end. xauth is xvfb-run's own
# dependency (fails with "xauth command not found" without it). openssl is
# for Prisma's engine detection at runtime — see the build stage above for
# why it's needed in both places.
RUN apt-get update && apt-get install -y --no-install-recommends xvfb xauth openssl && rm -rf /var/lib/apt/lists/*
# /app itself needs to be node-owned so the local-disk storage fallback can
# create ./uploads on demand (src/lib/server/storage.ts) — chowning it here,
# while it's still empty, is metadata-only (nothing to duplicate).
# Everything COPY'd into it below stays root-owned on purpose: the app only
# ever reads dist/prisma/node_modules at runtime, never writes to them, so
# root ownership (world-readable by default) is enough.
RUN chown node:node /app
# --chown here (metadata baked directly into this layer's content) instead
# of a later `RUN chown -R /opt/prusaslicer` — chowning *after* copying
# ~987MB of already-written files doesn't modify them in place, the overlay
# filesystem duplicates every touched file into a new layer, nearly doubling
# the image for zero behavior change. xvfb-run still needs to write its own
# lock/socket files next to where it runs from, which is the actual reason
# this directory (unlike the ones above) needs to be node-owned at all.
COPY --from=prusaslicer --chown=node:node /opt/prusaslicer/squashfs-root /opt/prusaslicer/squashfs-root
RUN printf '#!/bin/sh\nexec xvfb-run --auto-servernum -- /opt/prusaslicer/squashfs-root/AppRun "$@"\n' > /usr/local/bin/prusa-slicer \
    && chmod +x /usr/local/bin/prusa-slicer
ENV PRUSASLICER_BIN=/usr/local/bin/prusa-slicer

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

# Run as the non-root `node` user the base image already ships (uid 1000) —
# least privilege: a compromised process shouldn't have root inside its own
# container.
USER node

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
