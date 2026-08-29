import { RateLimitError } from "./errors";

// Replaces both @fastify/rate-limit's per-route config option AND the
// separate custom checkLongWindowLimit (server/src/lib/longWindowLimit.ts,
// which existed only because the installed @fastify/rate-limit version
// supported a single window per route) — one Map-based utility covers both
// use cases now, since a route can just call this twice with different
// windows if it needs both a short and a long ceiling.
//
// In-memory, single-process — same property @fastify/rate-limit's own
// default store had: no need to survive a container restart to be useful.
// This assumes one long-lived Node process (true for the @astrojs/node
// standalone deploy target); it would silently under- or over-limit under
// any horizontally-scaled/multi-instance deployment.
const hits = new Map<string, number[]>();

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) || []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length <= max;
}

// Throwing variant for the common case (route wants a 429 on failure) — mirrors
// how @fastify/rate-limit's config.rateLimit failed a route automatically,
// so call sites don't each need their own if/throw.
export function enforceRateLimit(key: string, max: number, windowMs: number): void {
  if (!checkRateLimit(key, max, windowMs)) throw new RateLimitError();
}

// Best-effort caller IP for rate-limit keys — matches @fastify/rate-limit's
// default IP-based keying. clientAddress is Astro's own equivalent of
// Fastify's request.ip.
export function clientIp(context: { clientAddress?: string }): string {
  return context.clientAddress || "unknown";
}
