import { useEffect, useState } from "react";
import { api } from "../lib/api-client";

// Client-side-only guard (the real protection is requireAdmin on every
// admin API route) — this just avoids flashing the admin UI to a
// non-admin visitor while waiting for that check. Ported from
// Admin.dc.html's authStatus state.
export function useAdminAuth() {
  const [status, setStatus] = useState<"checking" | "denied" | "ok">("checking");

  useEffect(() => {
    let cancelled = false;
    api.me().then((res) => {
      if (cancelled) return;
      const user = res.ok ? res.data?.user : null;
      setStatus(user && user.role === "ADMIN" ? "ok" : "denied");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return status;
}
