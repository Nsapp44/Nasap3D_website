import type { APIRoute } from "astro";

// First-party proxy for Plausible's event endpoint (see s.js.ts). Forwards the
// visitor's real IP and User-Agent so Plausible's unique-visitor, country and
// device stats stay correct. Always answers 202 so a Plausible outage can
// never surface as an error on the site.
const UPSTREAM = "https://plausible.io/api/event";
const MAX_BODY = 4096;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await request.text();
  if (body.length > MAX_BODY) return new Response("", { status: 413 });

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const headers: Record<string, string> = {
    "Content-Type": "text/plain",
    "User-Agent": request.headers.get("user-agent") ?? "",
    "X-Forwarded-For": forwarded || clientAddress || "",
  };

  try {
    await fetch(UPSTREAM, { method: "POST", headers, body, signal: AbortSignal.timeout(5000) });
  } catch (err) {
    console.error("[plausible] event forward failed", err);
  }
  return new Response("ok", { status: 202, headers: { "Cache-Control": "no-store" } });
};
