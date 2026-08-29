import type { AstroCookies } from "astro";
import { randomBytes } from "node:crypto";
import { SESSION_COOKIE } from "../server/session";

// Centralizes the exact cookie semantics that used to live scattered across
// server/src/lib/session.ts + guestSession.ts (reply.setCookie calls) — kept
// here as the single place so the secure-flag conditional and the
// persistent/session-cookie distinction can't drift between call sites.
const COMMON_FLAGS = {
  httpOnly: true,
  sameSite: "lax" as const,
  // Local HTTP dev needs secure:false or the browser silently drops the
  // cookie entirely — this must stay env-driven, never hardcoded.
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

// `persistent` controls the COOKIE only, never the server-side session
// record — the DB row always lives for SESSION_DAYS regardless (see
// session.ts), so revocation/cleanup logic doesn't need two code paths.
// When not persistent (remember-me left unchecked), the cookie is issued
// with no `expires`, so the browser itself deletes it on close — the
// standard "remember me" meaning without a second, shorter-lived token type.
export function setSessionCookie(cookies: AstroCookies, raw: string, expiresAt: Date, persistent = true) {
  cookies.set(SESSION_COOKIE, raw, {
    ...COMMON_FLAGS,
    ...(persistent ? { expires: expiresAt } : {}),
  });
}

export function clearSessionCookie(cookies: AstroCookies) {
  cookies.delete(SESSION_COOKIE, { path: "/" });
}

export function getSessionCookie(cookies: AstroCookies): string | undefined {
  return cookies.get(SESSION_COOKIE)?.value;
}

const GUEST_COOKIE = "n3d_guest";

// Opaque id grouping an anonymous visitor's quotes/cart before they have an
// account — merged into their user id once they sign in (see
// src/lib/server/cart.ts's mergeGuestCartIntoUser). Ported from
// guestSession.ts's getOrCreateGuestSessionId, split into a plain getter
// (needed by routes that must NOT create one just by being called, e.g. a
// read-only check) and this creator.
export function getGuestSessionId(cookies: AstroCookies): string | undefined {
  return cookies.get(GUEST_COOKIE)?.value;
}

export function getOrCreateGuestSessionId(cookies: AstroCookies): string {
  const existing = getGuestSessionId(cookies);
  if (existing) return existing;
  const id = randomBytes(16).toString("hex");
  cookies.set(GUEST_COOKIE, id, {
    ...COMMON_FLAGS,
    maxAge: 60 * 60 * 24 * 30,
  });
  return id;
}
