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
export function useQuoteEnabled() {
  const [quoteEnabled, setQuoteEnabled] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.getQuoteEnabled().then((res) => {
      if (cancelled) return;
      setQuoteEnabled(res.ok && res.data ? res.data.quoteEnabled : false);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { quoteEnabled, loading };
}
