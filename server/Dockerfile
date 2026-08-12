FROM node:20-bookworm-slim AS build
WORKDIR /app
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
# own dependency (fails with "xauth command not found" without it).
RUN apt-get update && apt-get install -y --no-install-recommends xvfb xauth && rm -rf /var/lib/apt/lists/*
COPY --from=prusaslicer /opt/prusaslicer/squashfs-root /opt/prusaslicer/squashfs-root
RUN printf '#!/bin/sh\nexec xvfb-run --auto-servernum -- /opt/prusaslicer/squashfs-root/AppRun "$@"\n' > /usr/local/bin/prusa-slicer \
    && chmod +x /usr/local/bin/prusa-slicer
ENV PRUSASLICER_BIN=/usr/local/bin/prusa-slicer

COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/slicer-profiles ./slicer-profiles
RUN npx prisma generate
EXPOSE 3000
CMD ["node", "dist/index.js"]
