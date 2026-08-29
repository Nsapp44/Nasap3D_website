import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { requireAuth } from "../../../../lib/api/auth";
import { verifyPassword, isValidPassword, hashPassword } from "../../../../lib/server/password";
import { createAndSendVerificationCode, canResend } from "../../../../lib/server/verification";

interface PasswordChangePayload {
  newPasswordHash: string;
}

// Direct port of POST /account/password/request-change.
export const POST = apiHandler(async (context) => {
  const user = await requireAuth(context);

  const schema = z.object({ currentPassword: z.string(), newPassword: z.string() });
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  if (!(await verifyPassword(user.passwordHash, body.data.currentPassword))) {
    return jsonError(401, "wrong_password");
  }
  if (!isValidPassword(body.data.newPassword)) return jsonError(400, "weak_password");
  if (!(await canResend(user.id, "PASSWORD_CHANGE"))) return jsonError(429, "too_soon");

  const { expiresAt, mailSent } = await createAndSendVerificationCode(
    user.id,
    "PASSWORD_CHANGE",
    user.email,
    "Confirmez le changement de mot de passe — Nasap3D",
    "Une demande de changement de mot de passe a été faite sur votre compte Nasap3D. Saisissez ce code pour la confirmer.",
    { newPasswordHash: await hashPassword(body.data.newPassword) } satisfies PasswordChangePayload,
  );
  if (!mailSent) return jsonError(502, "mail_send_failed");
  return json({ ok: true, expiresAt });
});
