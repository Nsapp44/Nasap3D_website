import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { prisma } from "../../../lib/server/prisma";
import { hashPassword, isValidPassword } from "../../../lib/server/password";
import { hashToken } from "../../../lib/server/tokens";
import { revokeAllSessions } from "../../../lib/server/session";
import { enforceRateLimit, clientIp } from "../../../lib/api/rateLimit";

const schema = z.object({ token: z.string(), newPassword: z.string() });

// Direct port of POST /auth/reset-password. Revokes every other session on
// success — the "credential change ⇒ revoke everything" invariant.
export const POST = apiHandler(async ({ request, clientAddress }) => {
  enforceRateLimit(`auth:reset-password:${clientIp({ clientAddress })}`, 10, 60_000);

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");
  if (!isValidPassword(body.data.newPassword)) return jsonError(400, "weak_password");

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(body.data.token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return jsonError(400, "invalid_or_expired_token");
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: record.userId },
      data: { passwordHash: await hashPassword(body.data.newPassword) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
  ]);
  await revokeAllSessions(record.userId);

  return json({ ok: true });
});
