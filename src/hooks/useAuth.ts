import { useLayoutEffect, useState } from "react";
import { api } from "../lib/api-client";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

const CACHE_KEY = "nasap3d-auth-user";

function cachedUser(): AuthUser | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(CACHE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

// Replaces the _checkAuth()/state.isLoggedIn boilerplate duplicated by hand
// across every .dc.html page (see e.g. About.dc.html's Component class) —
// one round-trip to GET /auth/me, shared by every page/component that needs
// to know whether a visitor is logged in.
//
// Cached in sessionStorage, applied synchronously before paint (useLayoutEffect,
// not useEffect) — real report: NavAuthIcon (the settings-cog next to
// "Compte", shown only while logged in) popped in and out on every single
// page navigation, since this hook used to always start from `user: null`
// and only learn the real answer after a fresh network round-trip, every
// time, even for a visitor who was already logged in on the previous page.
// A cached value is only ever a same-tab, same-session optimistic guess,
// always corrected the moment the real fetch below resolves (e.g. a logout
// in another tab still shows the cached logged-in state here for one
// render, then corrects) — never wrong for more than one request.
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useLayoutEffect(() => {
    const cached = cachedUser();
    if (cached) {
      setUser(cached);
      setLoading(false);
    }

    let cancelled = false;
    api.me().then((res) => {
      if (cancelled) return;
      const real = res.ok && res.data ? res.data.user : null;
      setUser(real);
      setLoading(false);
      try {
        if (real) sessionStorage.setItem(CACHE_KEY, JSON.stringify(real));
        else sessionStorage.removeItem(CACHE_KEY);
      } catch {
        // Private browsing / storage disabled — just re-fetches (with the
        // brief flash this cache exists to avoid) on every page instead, no
        // functional loss.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isLoggedIn: !!user, loading };
}
