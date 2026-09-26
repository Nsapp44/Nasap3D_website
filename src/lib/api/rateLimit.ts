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

// Real, confirmed unbounded leak without this: every distinct key this was
// ever called with (route + IP, so effectively every unique visitor × every
// rate-limited route they touched) stayed in this Map forever — nothing
// ever deleted an entry, even long after its own timestamps had all aged
// out of any realistic window. Measured live: 500 unique visitors/day × 5
// routes grew this to 75,000 entries / +32MB heap over a simulated 30 days,
// monotonically, with real traffic (especially once ad traffic brings in
// mostly new/unique IPs) this only gets worse over time, never recovering
// short of a restart. PRUNE_INTERVAL_MS trades a little precision (an
// entry can survive up to this long after its last real hit) for doing the
// full-Map sweep rarely — cheap enough that once an hour is already very
// conservative for how little memory this actually saves per pass.
const PRUNE_INTERVAL_MS = 60 * 60 * 1000; // 1h
const STALE_AFTER_MS = 60 * 60 * 1000; // drop a key once its last hit is this old
let lastPruneAt = Date.now();

function pruneStaleKeys(now: number) {
  lastPruneAt = now;
  for (const [key, timestamps] of hits) {
    const newest = timestamps[timestamps.length - 1];
    if (newest === undefined || now - newest > STALE_AFTER_MS) hits.delete(key);
  }
}

export function checkRateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  if (now - lastPruneAt > PRUNE_INTERVAL_MS) pruneStaleKeys(now);
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
