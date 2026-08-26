import { useEffect, useState } from "react";
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
// Set synchronously by the inline script in BaseLayout.astro's <head> when
// the cached value says paused, to hide .n3d-quote-gate elements before
// first paint (see that script's own comment). Must be kept in sync here
// too: if the cache was stale (said paused, but the real fetch below comes
// back enabled, or vice versa), the class has to be corrected once the real
// answer is known — otherwise a stale "paused" class would keep hiding
// content this hook has since determined should actually be visible.
const HTML_CLASS = "n3d-quote-paused";

function cachedValue(): boolean {
  if (typeof sessionStorage === "undefined") return true;
  const raw = sessionStorage.getItem(CACHE_KEY);
  return raw === null ? true : raw === "true";
}

export function useQuoteEnabled() {
  // Always true on the very first render, matching astro dev's per-request
  // SSR and the production static build alike — both render this component
  // with no access to sessionStorage, so they always assume enabled. Using
  // the cached value here instead (this hook's first version) made the
  // client's initial render disagree with that server-rendered markup
  // whenever the cache said paused, which is a real React hydration-mismatch
  // error (confirmed live), not just a cosmetic flash — React then discards
  // and re-renders the whole subtree, losing the CSS-gate's whole point.
  // The cached value is applied a moment later instead, in the effect below
  // — safe once mounted, and invisible either way since the inline script
  // in BaseLayout.astro's <head> already hid .n3d-quote-gate via CSS before
  // any of this ever ran.
  const [quoteEnabled, setQuoteEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = cachedValue();
    if (!cached) setQuoteEnabled(false);

    let cancelled = false;
    api.getQuoteEnabled().then((res) => {
      if (cancelled) return;
      const value = res.ok && res.data ? res.data.quoteEnabled : false;
      setQuoteEnabled(value);
      setLoading(false);
      document.documentElement.classList.toggle(HTML_CLASS, !value);
      try {
        sessionStorage.setItem(CACHE_KEY, String(value));
      } catch {
        // Private browsing / storage disabled — the flag just re-fetches
        // fresh (and can flash) on every page instead, no functional loss.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { quoteEnabled, loading };
}
