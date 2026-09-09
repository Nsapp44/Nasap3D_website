import { defineMiddleware } from "astro:middleware";
import { sweepAbandonedCarts } from "./lib/server/cartCleanup";
import { sweepExpiredQuoteFiles } from "./lib/server/quoteCleanup";
import { sweepRejectedOrders } from "./lib/server/orders";
import { sweepOrderTracking } from "./lib/server/orderTracking";

// Replaces two of Fastify's global hooks (server/src/app.ts) that every
// route implicitly relied on:
//
// 1. onSend forcing `Cache-Control: private, no-store` on every response —
//    fixes a confirmed real production bug where a reverse proxy/CDN in
//    front of the API cached one visitor's response (their cart) and served
//    it to a different visitor. Applied here unconditionally to every
//    /api/* response, not opt-in per route (the whole point is that it
//    can't be forgotten).
// 2. setErrorHandler as a backstop — src/lib/api/handler.ts's apiHandler()
//    is what routes actually use day-to-day for precise error-code mapping,
//    but this try/catch is the unconditional net underneath it, in case a
//    route is ever added without going through apiHandler().
//
// Background sweep jobs — direct port of server/src/index.ts's four
// setInterval calls (started unconditionally after app.listen() there).
// "Single in-process instance, no separate cron needed" is the same
// assumption that file made explicitly; still true for a plain
// @astrojs/node standalone server on a VPS, but would break under any
// horizontally-scaled/multi-instance deploy (each instance would run its
// own copy of every sweep) or a genuinely serverless target (no long-lived
// process to host a setInterval at all) — neither applies to the current
// deployment target.
const SWEEP_INTERVAL_MS = 15 * 60 * 1000; // 15 min
const TRACKING_SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h

async function runSweep() {
  try {
    await sweepAbandonedCarts();
  } catch (err) {
    console.error("[sweep] sweepAbandonedCarts failed", err);
  }
  try {
    await sweepExpiredQuoteFiles();
  } catch (err) {
    console.error("[sweep] sweepExpiredQuoteFiles failed", err);
  }
  try {
    await sweepRejectedOrders();
  } catch (err) {
    console.error("[sweep] sweepRejectedOrders failed", err);
  }
}

async function runTrackingSweep() {
  try {
    await sweepOrderTracking();
  } catch (err) {
    console.error("[sweep] sweepOrderTracking failed", err);
  }
}

let sweepsStarted = false;
function startBackgroundSweepsOnce() {
  if (sweepsStarted) return;
  sweepsStarted = true;
  runSweep();
  setInterval(runSweep, SWEEP_INTERVAL_MS);
  runTrackingSweep();
  setInterval(runTrackingSweep, TRACKING_SWEEP_INTERVAL_MS);
}

// Reimplements Astro's own security.checkOrigin (disabled in astro.config.mjs
// — see its comment for why the built-in version is broken behind Caddy),
// but computes the request's origin from X-Forwarded-Proto/-Host when
// present instead of the raw socket, matching what the reverse proxy
// actually terminates. Mirrors node_modules/astro/dist/core/app/origin-check.js.
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const FORM_CONTENT_TYPES = ["application/x-www-form-urlencoded", "multipart/form-data", "text/plain"];

function isFormLike(contentType: string | null): boolean {
  if (!contentType) return false;
  const lower = contentType.toLowerCase();
  return FORM_CONTENT_TYPES.some((t) => lower.includes(t));
}

function isForbiddenCrossOrigin(context: { request: Request; url: URL }): boolean {
  const { request, url } = context;
  if (SAFE_METHODS.has(request.method)) return false;

  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || url.host;
  const effectiveOrigin = `${proto}://${host}`;
  const isSameOrigin = request.headers.get("origin") === effectiveOrigin;

  const contentType = request.headers.get("content-type");
  if (contentType) return isFormLike(contentType) && !isSameOrigin;
  return !isSameOrigin;
}

// Cross-origin isolation (COOP/COEP — Cross-Origin-Opener-Policy/-Embedder-
// Policy). Re-enabled after a more careful live comparison against grid.
// space's own official Kiri:Moto app (the upstream project this engine is
// vendored from) — confirmed they run with COOP/COEP too (curl -I grid.
// space/kiri: both headers present), and `page.workers()` (which sees
// nested workers a plain `window.Worker` proxy patch cannot, since each
// Worker has its own isolated global scope) shows their own minion pool
// count matches ours exactly (9 minions + 1 main worker, both machines
// reporting navigator.hardwareConcurrency=12) — so the earlier "no
// measured difference" conclusion wasn't about isolation being pointless,
// it was measured on too small/fast a file (grip.stl, ~100k triangles,
// same-order wall time either way) to expose what isolation actually
// changes: SharedArrayBuffer lets the worker pool share WASM linear memory
// directly instead of round-tripping geometry through postMessage's
// structured-clone copy on every handoff — a cost that scales with model
// size/complexity, invisible on a small file. geometryWorker.js and the
// vendored kiri worker/minion/engine/manifold.wasm files already moved out
// of public/ into worker-assets/ + real Astro routes specifically so they
// can carry the Cross-Origin-Resource-Policy header `new Worker(url,
// {type: "module"})` requires under COEP:require-corp even for same-origin
// scripts (see src/lib/server/serveWorkerScript.ts) — that fix stays in
// place regardless. Scoped to /devis-instantane only (not sitewide, not
// even /api/*): COEP:require-corp blocks any OTHER cross-origin subresource
// that doesn't explicitly opt in via CORP/CORS — a real risk on pages this
// project can't afford to break silently (Stripe Elements/Checkout, real
// payments; hCaptcha, account auth — both load cross-origin iframes
// elsewhere on the site). Scoping means nothing outside this one route
// ever sees these headers.
const CROSS_ORIGIN_ISOLATED_PATHS = new Set<string>([]); // TEMP AB test

export const onRequest = defineMiddleware(async (context, next) => {
  startBackgroundSweepsOnce();

  if (CROSS_ORIGIN_ISOLATED_PATHS.has(context.url.pathname)) {
    const response = await next();
    response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
    response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");
    return response;
  }

  if (!context.url.pathname.startsWith("/api/")) {
    return next();
  }

  if (isForbiddenCrossOrigin(context)) {
    return new Response(`Cross-site ${context.request.method} form submissions are forbidden`, {
      status: 403,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  try {
    const response = await next();
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    });
  }
});
