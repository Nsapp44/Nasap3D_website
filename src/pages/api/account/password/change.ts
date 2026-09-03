import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { requireAuth } from "../../../../lib/api/auth";
import { verifyPassword, isValidPassword, hashPassword } from "../../../../lib/server/password";
import { prisma } from "../../../../lib/server/prisma";
import { revokeAllSessions, createSession } from "../../../../lib/server/session";
import { setSessionCookie } from "../../../../lib/api/cookies";

// Replaces the old request-change/confirm-change pair (an emailed 6-digit
// code in between) — removed on request: unlike an email change, which
// proves ownership of an inbox the account doesn't yet trust, a password
// change is already gated on the CURRENT password, checked below — that's
// already proof of ownership, so a second round-trip through email added
// friction without adding real security. Logs out every other session and
// re-issues this one, same as the old confirm step did.
export const POST = apiHandler(async (context) => {
  const user = await requireAuth(context);

  const schema = z.object({ currentPassword: z.string(), newPassword: z.string() });
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  if (!(await verifyPassword(user.passwordHash, body.data.currentPassword))) {
    return jsonError(401, "wrong_password");
  }
  if (!isValidPassword(body.data.newPassword)) return jsonError(400, "weak_password");
  if (body.data.newPassword === body.data.currentPassword) return jsonError(400, "same_password");

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(body.data.newPassword) },
  });
  await revokeAllSessions(user.id);
  const { raw, expiresAt } = await createSession(user.id);
  setSessionCookie(context.cookies, raw, expiresAt);
  return json({ ok: true });
});
