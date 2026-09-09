// Docker CMD / production entrypoint — replaces server/src/index.ts's boot
// sequence. Deliberately a plain script at the repo root, outside src/ (not
// part of the Astro/Vite build graph), because the ordering below can't be
// guaranteed by Vite's own module bundling/chunking behavior:
//
//   1. dotenv, loaded first, so every subsequent step sees the real .env.
//   2. sanitizeEnv() — strips stray quotes Docker Compose's env_file: can
//      leave on values (see bootstrap/sanitizeEnv.mjs) — must run before
//      anything reads process.env, including the Astro bundle's own modules
//      (many read SMTP_*/S3_*/etc. at import time). This is why step 3 is a
//      dynamic import rather than a static one at the top of this file: a
//      static import is hoisted by the JS spec and would execute before
//      steps 1-2 regardless of source order.
//   3. The built Astro SSR server (@astrojs/node, standalone mode). Autostart
//      is disabled (ASTRO_NODE_AUTOSTART below) so we can start it ourselves
//      and reach into the raw Node http.Server it creates — see the
//      requestTimeout comment below for why.
import "dotenv/config";
import { sanitizeEnv } from "./bootstrap/sanitizeEnv.mjs";

sanitizeEnv();

process.env.ASTRO_NODE_AUTOSTART = "disabled";
const { startServer } = await import("./dist/server/entry.mjs");
const { server } = startServer();

// Real, reproduced bug: @astrojs/node's standalone adapter creates its
// http.Server with no options (`http.createServer(listener)`,
// node_modules/@astrojs/node/dist/standalone.js), so Node's own default
// `requestTimeout` (300_000ms / 5 min since Node 18) applies unmodified.
// That timeout guards the whole request — headers AND body — and fires
// below the application layer: no route handler ever runs, nothing gets
// logged, the raw socket is just destroyed. Confirmed live (large STL
// upload, ~57MB): the client saw a bare `ERR_CONNECTION_ABORTED` at almost
// exactly 5 minutes, with zero server-side log output — not the OOM crash
// this looked like at first (docker inspect confirmed no OOM-kill, no
// restart), and not any of our own, more graceful timeouts (the 300s
// server-side slice-fallback subprocess timeout in kiriSlicer.ts, the 6min
// client-side AbortController in api-client.ts) — this one fires first and
// pre-empts all of them, before they get a chance to produce a real error
// response. 480s gives comfortable margin past both of those so OUR
// timeouts win the race and the visitor gets an actual error message
// instead of a silent connection drop — this stays a bounded value (not
// disabled/Infinity) to keep Node's own slow-loris protection intact.
server.server.requestTimeout = 480_000;
