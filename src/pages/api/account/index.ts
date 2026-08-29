import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { requireAuth } from "../../../lib/api/auth";
import { prisma } from "../../../lib/server/prisma";
import { verifyPassword } from "../../../lib/server/password";
import { revokeAllSessions } from "../../../lib/server/session";
import { clearSessionCookie } from "../../../lib/api/cookies";

// Direct port of DELETE /account — soft delete: keeps historical
// orders/invoices intact (they still reference this row) while the account
// itself can no longer log in.
export const DELETE = apiHandler(async (context) => {
  const user = await requireAuth(context);

  const schema = z.object({ currentPassword: z.string() });
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  if (!(await verifyPassword(user.passwordHash, body.data.currentPassword))) {
    return jsonError(401, "wrong_password");
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { deletedAt: new Date() },
  });
  await revokeAllSessions(user.id);
  clearSessionCookie(context.cookies);
  return json({ ok: true });
});
