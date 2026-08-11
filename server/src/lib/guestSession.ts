import type { FastifyReply, FastifyRequest } from "fastify";
import { randomBytes } from "node:crypto";

const COOKIE = "n3d_guest";

// Opaque id grouping an anonymous visitor's quotes/cart before they have an
// account — merged into their user id once they sign in (cart phase).
export function getOrCreateGuestSessionId(request: FastifyRequest, reply: FastifyReply): string {
  const existing = request.cookies[COOKIE];
  if (existing) return existing;
  const id = randomBytes(16).toString("hex");
  reply.setCookie(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return id;
}
