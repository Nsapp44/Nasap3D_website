import type { APIContext } from "astro";
import type { User } from "@prisma/client";
import { getSessionUserByToken } from "../server/session";
import { getSessionCookie } from "./cookies";
import { UnauthorizedError, ForbiddenError } from "./errors";

// Replaces Fastify's requireAuth/requireAdmin preHandlers (server/src/lib/
// session.ts), which decorated `request.user` as a side effect that every
// route then implicitly relied on. Astro has no equivalent ambient
// mutation, so every route that needs the current user calls one of these
// explicitly and uses the return value — this is the single most invasive
// mechanical change carried over from the old Fastify routes.

// Optional auth — never throws, returns null if not logged in. Use for
// routes where being logged in changes behavior but isn't required (e.g.
// the mixed user-or-guest cart identity, or GET /api/auth/me which must
// always return 200 with user:null rather than a 401).
export async function getSessionUser(context: APIContext): Promise<User | null> {
  return getSessionUserByToken(getSessionCookie(context.cookies));
}

// Required auth — throws UnauthorizedError (apiHandler() turns this into a
// 401 {error:"unauthenticated"}, exactly matching the old Fastify response)
// if not logged in.
export async function requireAuth(context: APIContext): Promise<User> {
  const user = await getSessionUser(context);
  if (!user) throw new UnauthorizedError();
  return user;
}

export async function requireAdmin(context: APIContext): Promise<User> {
  const user = await requireAuth(context);
  if (user.role !== "ADMIN") throw new ForbiddenError();
  return user;
}
