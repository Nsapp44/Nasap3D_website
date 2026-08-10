import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@prisma/client";
import { prisma } from "./prisma.js";
import { generateToken, hashToken } from "./tokens.js";

export const SESSION_COOKIE = "n3d_session";
const SESSION_DAYS = 30;

// One cookie, one DB row per login ("session" == the front's "refresh
// token" from the handoff doc — kept as a single tier rather than
// access+refresh pairs, since every request already needs a DB round-trip
// for role checks; the important property (server-side, instant
// revocation) is the same either way). httpOnly so front-end JS never
// touches the raw value — immune to XSS token theft, unlike a
// localStorage-based token.
export async function createSession(userId: string) {
  const raw = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: { userId, tokenHash: hashToken(raw), expiresAt },
  });
  return { raw, expiresAt };
}

export async function revokeSession(raw: string) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashToken(raw), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

// Called on password change / account deletion: kills every other device's
// session too, since the credential that justified trusting them changed.
export async function revokeAllSessions(userId: string) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function setSessionCookie(reply: FastifyReply, raw: string, expiresAt: Date) {
  reply.setCookie(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(reply: FastifyReply) {
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
}

export async function getSessionUser(request: FastifyRequest): Promise<User | null> {
  const raw = request.cookies[SESSION_COOKIE];
  if (!raw) return null;
  const session = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.user.deletedAt) return null;
  return session.user;
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const user = await getSessionUser(request);
  if (!user) {
    reply.code(401).send({ error: "unauthenticated" });
    return;
  }
  request.user = user;
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  await requireAuth(request, reply);
  if (reply.sent) return;
  if (request.user!.role !== "ADMIN") {
    reply.code(403).send({ error: "forbidden" });
  }
}

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
}
