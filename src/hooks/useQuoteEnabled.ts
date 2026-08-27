import { useLayoutEffect, useState } from "react";
import { api } from "../lib/api-client";

// Replaces navguard.js + stock.js's isQuoteEnabled()/setQuoteEnabled()
// localStorage "vacation mode" flag — that flag was a second, client-only
// source of truth for Settings.quoteEnabled that could silently go stale
// (real bug this session: a visitor who never had the flag refreshed kept
// seeing "unavailable" even once quotes were re-enabled server-side). This
// hook has exactly one source of truth: GET /quote-enabled.
//
// If the API call fails (server down), quoteEnabled is treated as false
// (paused) rather than defaulting to true — a broken configurator is worse
// than a visible maintenance message.
const CACHE_KEY = "nasap3d-quote-enabled";

// null = not known yet (no cached value, and the real fetch hasn't resolved
// this page load). Every consumer renders an explicit loading state for
// that case instead of guessing — output:'static' means the server-rendered
// markup can never know the real flag (no per-request rendering, and
// sessionStorage doesn't exist server-side either way), so guessing
// optimistically used to show working content for a moment on a page that
// was actually paused, then yank it away once the real answer arrived. A
// loading state is never wrong, just brief — see PrinterLoaderIcon usage in
// the consumers of this hook.
function cachedValue(): boolean | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(CACHE_KEY);
  return raw === null ? null : raw === "true";
}

export function useQuoteEnabled() {
  // Always null on the very first render, matching astro dev's per-request
  // SSR and the production static build alike (both have zero access to
  // sessionStorage) — no hydration mismatch risk, since server and client
  // agree on "unknown" before anything client-only runs.
  const [quoteEnabled, setQuoteEnabled] = useState<boolean | null>(null);

  // useLayoutEffect, not useEffect: applies a cached value synchronously
  // after the DOM commits but *before* the browser paints, so a visitor on
  // their second+ page this session never actually sees the loading state
  // flash in — it only shows for real on a visitor's first-ever page,
  // while the network round-trip is still genuinely in flight.
  useLayoutEffect(() => {
    const cached = cachedValue();
    if (cached !== null) setQuoteEnabled(cached);

    let cancelled = false;
    api.getQuoteEnabled().then((res) => {
      if (cancelled) return;
      const value = res.ok && res.data ? res.data.quoteEnabled : false;
      setQuoteEnabled(value);
      try {
        sessionStorage.setItem(CACHE_KEY, String(value));
      } catch {
        // Private browsing / storage disabled — the flag just re-fetches
        // fresh (and shows the loading state) on every page instead, no
        // functional loss.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { quoteEnabled, loading: quoteEnabled === null };
}
