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

export const onRequest = defineMiddleware(async (context, next) => {
  startBackgroundSweepsOnce();

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
