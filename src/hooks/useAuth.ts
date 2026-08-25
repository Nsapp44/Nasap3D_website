import { useEffect, useState } from "react";
import { api } from "../lib/api-client";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

// Replaces the _checkAuth()/state.isLoggedIn boilerplate duplicated by hand
// across every .dc.html page (see e.g. About.dc.html's Component class) —
// one round-trip to GET /auth/me, shared by every page/component that needs
// to know whether a visitor is logged in.
export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.me().then((res) => {
      if (cancelled) return;
      setUser(res.ok && res.data ? res.data.user : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return { user, isLoggedIn: !!user, loading };
}
