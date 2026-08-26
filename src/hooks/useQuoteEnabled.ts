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

// Every full page navigation remounts this hook from scratch (Astro is
// static/MPA, not a client-routed SPA) — without a cache, each page load
// re-runs the true≈default→real-fetch flash the comments below describe,
// once per page instead of once per browsing session. Reading the last
// known value synchronously here means only the very first page a visitor
// ever lands on can flash; every page after that already has the real
// answer before the first render.
function cachedValue(): boolean {
  if (typeof sessionStorage === "undefined") return true;
  const raw = sessionStorage.getItem(CACHE_KEY);
  return raw === null ? true : raw === "true";
}

export function useQuoteEnabled() {
  const [quoteEnabled, setQuoteEnabled] = useState(cachedValue);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getQuoteEnabled().then((res) => {
      if (cancelled) return;
      const value = res.ok && res.data ? res.data.quoteEnabled : false;
      setQuoteEnabled(value);
      setLoading(false);
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
