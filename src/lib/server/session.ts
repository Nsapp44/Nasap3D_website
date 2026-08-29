import type { User } from "@prisma/client";
import { prisma } from "./prisma";
import { generateToken, hashToken } from "./tokens";

export const SESSION_COOKIE = "n3d_session";
export const SESSION_DAYS = 30;

// One cookie, one DB row per login ("session" == the front's "refresh
// token" from the handoff doc — kept as a single tier rather than
// access+refresh pairs, since every request already needs a DB round-trip
// for role checks; the important property (server-side, instant
// revocation) is the same either way). httpOnly so front-end JS never
// touches the raw value — immune to XSS token theft, unlike a
// localStorage-based token.
//
// Framework-agnostic DB logic only — cookie reading/writing itself lives in
// src/lib/api/cookies.ts (Astro's AstroCookies API replaces Fastify's
// reply.setCookie/request.cookies).
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

export async function getSessionUserByToken(raw: string | undefined): Promise<User | null> {
  if (!raw) return null;
  const session = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashToken(raw) },
    include: { user: true },
  });
  if (!session || session.revokedAt || session.expiresAt < new Date()) return null;
  if (session.user.deletedAt) return null;
  return session.user;
}
