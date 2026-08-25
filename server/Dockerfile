FROM node:20-bookworm-slim AS build
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
COPY . .
RUN npx prisma generate
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
FROM node:20-bookworm-slim AS prusaslicer
WORKDIR /opt/prusaslicer
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && rm -rf /var/lib/apt/lists/*
RUN curl -fL -o PrusaSlicer.AppImage \
      https://github.com/probonopd/PrusaSlicer.AppImage/releases/download/2.9.1/PrusaSlicer-2.9.1-x86_64.AppImage \
    && chmod +x PrusaSlicer.AppImage \
    && ./PrusaSlicer.AppImage --appimage-extract \
    && rm PrusaSlicer.AppImage

FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

# PrusaSlicer's CLI mode (--info / --export-gcode, see slicer.ts) needs
# xvfb-run despite never opening a real window — confirmed by building and
# running this image end-to-end (see server/README.md). xauth is xvfb-run's
# own dependency (fails with "xauth command not found" without it). openssl
# is for Prisma's engine detection at runtime — see the build stage above
# for why it's needed in both places.
RUN apt-get update && apt-get install -y --no-install-recommends xvfb xauth openssl && rm -rf /var/lib/apt/lists/*
COPY --from=prusaslicer /opt/prusaslicer/squashfs-root /opt/prusaslicer/squashfs-root
RUN printf '#!/bin/sh\nexec xvfb-run --auto-servernum -- /opt/prusaslicer/squashfs-root/AppRun "$@"\n' > /usr/local/bin/prusa-slicer \
    && chmod +x /usr/local/bin/prusa-slicer
ENV PRUSASLICER_BIN=/usr/local/bin/prusa-slicer

COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/slicer-profiles ./slicer-profiles
# prisma/seed.ts imports straight from src/ (tsx runs it directly, same as
# `npm run seed` in dev) rather than the compiled dist/ output — so src/
# has to ship too, not just dist/.
COPY --from=build /app/src ./src
RUN npx prisma generate
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Run as the non-root `node` user the base image already ships (uid 1000) —
# least privilege: a compromised API process shouldn't have root inside its
# own container. Needs write access to /app itself (the local-disk storage
# fallback creates ./uploads on demand, see storage.ts) and to the
# PrusaSlicer install (xvfb-run writes its own lock/socket files next to
# where it runs from).
RUN chown -R node:node /app /opt/prusaslicer
USER node

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
