import type { APIRoute } from "astro";

// First-party proxy for Plausible's tracking script (served from nasap3d.com
// instead of plausible.io) so ad blockers that filter the plausible.io domain
// don't hide real visits. The path is deliberately neutral (/m/s.js).
// The script is cached in memory for 6h; on an upstream failure the last good
// copy is served, and a 502 is returned only if there never was one.
const UPSTREAM = "https://plausible.io/js/script.js";
const TTL_MS = 6 * 60 * 60 * 1000;
let cached: { body: string; at: number } | null = null;

export const GET: APIRoute = async () => {
  if (!cached || Date.now() - cached.at > TTL_MS) {
    try {
      const res = await fetch(UPSTREAM, { signal: AbortSignal.timeout(5000) });
      if (res.ok) cached = { body: await res.text(), at: Date.now() };
    } catch (err) {
      console.error("[plausible] script fetch failed", err);
    }
  }
  if (!cached) return new Response("", { status: 502 });
  return new Response(cached.body, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
