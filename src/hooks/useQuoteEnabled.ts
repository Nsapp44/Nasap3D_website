import { useLayoutEffect, useState } from "react";
import { api } from "../lib/api-client";

// Broadcasts a fresh real result (from useQuoteEnabled, below) to every
// currently-mounted useQuoteEnabledCached() consumer on the same page — the
// sessionStorage write alone doesn't do this (the "storage" event only
// fires in *other* tabs, never the tab that made the change). Without this,
// landing on a page other than Home/devis-instantane first (so the cache is
// still empty/stale), then navigating to one of those two: the nav link
// there reads its one-time cache snapshot at mount (the optimistic
// default), and never learns the real answer that QuoteWizardSection (a
// separate island, same page) fetches moments later — confirmed live, the
// link stayed up regardless of the real paused state.
const listeners = new Set<(value: boolean) => void>();

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
// Grace period before a loader is shown at all — a fetch that resolves
// faster than this is imperceptible anyway, so nothing is rendered for it
// (better than a one-frame flash of a spinner). Only applies to a genuine
// first-ever page this session (see cachedValue below); a cached page has
// its answer applied before first paint, no waiting involved.
const GRACE_MS = 200;
// Once the loader actually appears (past the grace period above), it stays
// up at least this long — a spinner that vanishes 40ms after showing up
// reads as a glitch, not a real loading state.
const MIN_LOADING_MS = 2000;

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
  // Distinct from quoteEnabled === null: that covers both "still inside the
  // GRACE_MS window, rendering nothing yet" and "past it, show the loader"
  // — this flag is only true for the latter, see the consumers of this hook.
  const [showLoader, setShowLoader] = useState(false);

  // useLayoutEffect, not useEffect: applies a cached value synchronously
  // after the DOM commits but *before* the browser paints, so a visitor on
  // their second+ page this session never actually sees anything loading —
  // it only ever shows for real on a visitor's first-ever page, while the
  // network round-trip is still genuinely in flight past GRACE_MS.
  useLayoutEffect(() => {
    const cached = cachedValue();
    if (cached !== null) setQuoteEnabled(cached);

    let cancelled = false;
    let loaderShownAt: number | null = null;
    const graceTimer =
      cached === null
        ? setTimeout(() => {
            if (cancelled) return;
            loaderShownAt = Date.now();
            setShowLoader(true);
          }, GRACE_MS)
        : null;

    const commit = (value: boolean) => {
      if (cancelled) return;
      setQuoteEnabled(value);
      setShowLoader(false);
      try {
        sessionStorage.setItem(CACHE_KEY, String(value));
      } catch {
        // Private browsing / storage disabled — the flag just re-fetches
        // fresh (and shows the loading state) on every page instead, no
        // functional loss.
      }
      listeners.forEach((fn) => fn(value));
    };

    api.getQuoteEnabled().then((res) => {
      if (cancelled) return;
      const value = res.ok && res.data ? res.data.quoteEnabled : false;
      // A cached page already has something on screen (no loader visible),
      // so the real answer applies the instant it arrives — no reason to
      // hold it back.
      if (cached !== null) {
        commit(value);
        return;
      }
      if (graceTimer) clearTimeout(graceTimer);
      if (loaderShownAt === null) {
        // Resolved inside the grace period — no loader was ever shown, so
        // there's nothing to hold onscreen for a minimum duration either.
        commit(value);
        return;
      }
      const remaining = MIN_LOADING_MS - (Date.now() - loaderShownAt);
      if (remaining <= 0) commit(value);
      else setTimeout(() => commit(value), remaining);
    });

    return () => {
      cancelled = true;
      if (graceTimer) clearTimeout(graceTimer);
    };
  }, []);

  return { quoteEnabled, loading: showLoader };
}

// Lighter variant for anywhere the flag is only a convenience link, not the
// actual configurator (the nav link on every page except Home, the various
// QuoteCta buttons on Services/local-SEO/cart) — never fetches, never shows
// a loader, just trusts whatever the last real check (useQuoteEnabled, on
// Home or /devis-instantane) already wrote to the cache. A visitor who
// hasn't been on either of those pages yet this session sees the
// optimistic default below instead — this is a plain nav link, not worth a
// network round-trip or a loading state of its own.
export function useQuoteEnabledCached(): boolean {
  const [quoteEnabled, setQuoteEnabled] = useState(true);

  useLayoutEffect(() => {
    const cached = cachedValue();
    if (cached !== null) setQuoteEnabled(cached);

    // Catches the case above: no cache yet (or a stale one) at mount time,
    // corrected the moment a real check elsewhere on this same page (Home's
    // or devis-instantane's own useQuoteEnabled) resolves.
    listeners.add(setQuoteEnabled);
    return () => {
      listeners.delete(setQuoteEnabled);
    };
  }, []);

  return quoteEnabled;
}
