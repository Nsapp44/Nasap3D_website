import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { requireAuth } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";
import { verifyPassword, isValidEmail } from "../../../../lib/server/password";
import { createAndSendVerificationCode, canResend } from "../../../../lib/server/verification";

interface EmailChangePayload {
  newEmail: string;
}

// Direct port of POST /account/email/request-change — doubles as "resend":
// the front-end just calls this again (with the same fields, still on
// screen in the popup) if the customer needs a new code.
export const POST = apiHandler(async (context) => {
  const user = await requireAuth(context);

  const schema = z.object({ newEmail: z.string(), currentPassword: z.string() });
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");
  if (!isValidEmail(body.data.newEmail)) return jsonError(400, "invalid_email");

  if (!(await verifyPassword(user.passwordHash, body.data.currentPassword))) {
    return jsonError(401, "wrong_password");
  }

  const taken = await prisma.user.findUnique({ where: { email: body.data.newEmail } });
  if (taken && taken.id !== user.id) return jsonError(409, "email_taken");

  if (!(await canResend(user.id, "EMAIL_CHANGE"))) return jsonError(429, "too_soon");

  const { expiresAt, mailSent } = await createAndSendVerificationCode(
    user.id,
    "EMAIL_CHANGE",
    body.data.newEmail,
    "Confirmez votre nouvelle adresse email — Nasap3D",
    `Saisissez ce code sur nasap3d.com pour confirmer que ${body.data.newEmail} est bien votre nouvelle adresse.`,
    { newEmail: body.data.newEmail } satisfies EmailChangePayload,
  );
  if (!mailSent) return jsonError(502, "mail_send_failed");
  return json({ ok: true, expiresAt });
});
