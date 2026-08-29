import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { prisma } from "../../../lib/server/prisma";
import { hashPassword, isValidEmail, isValidPassword } from "../../../lib/server/password";
import { verifyCaptcha } from "../../../lib/server/captcha";
import { createPendingSignupCode } from "../../../lib/server/verification";
import { enforceRateLimit, clientIp } from "../../../lib/api/rateLimit";

const credentialsSchema = z.object({
  email: z.string(),
  password: z.string(),
  captchaToken: z.string().optional(),
});

interface PendingSignupPayload {
  email: string;
  passwordHash: string;
}

// Direct port of server/src/routes/auth.ts's POST /auth/signup — step 1/2:
// validates the credentials and mails a 6-digit code, but does NOT create
// the account yet (stashed in VerificationCode's payload until confirmed by
// POST /api/auth/signup/confirm). Closing the popup or letting the 3-minute
// code expire leaves no account behind, only an unused, self-expiring row.
export const POST = apiHandler(async ({ request, clientAddress }) => {
  enforceRateLimit(`auth:signup:${clientIp({ clientAddress })}`, 5, 60_000);

  const body = credentialsSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");
  const { email, password, captchaToken } = body.data;

  const rc = await verifyCaptcha(captchaToken);
  if (!rc.ok) return jsonError(400, "captcha_failed", { reason: rc.reason });

  if (!isValidEmail(email)) return jsonError(400, "invalid_email");
  if (!isValidPassword(password)) return jsonError(400, "weak_password");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return jsonError(409, "email_taken");

  const passwordHash = await hashPassword(password);
  const { id, expiresAt, mailSent } = await createPendingSignupCode(email, {
    email,
    passwordHash,
  } satisfies PendingSignupPayload);
  // The pending code row exists either way, but there's no point handing
  // the client a pendingId for a code that never actually reached their
  // mailbox — they'd be stuck on the "enter your code" popup with nothing
  // to enter. Submitting the form again creates a fresh attempt instead.
  if (!mailSent) return jsonError(502, "mail_send_failed");
  return json({ pendingId: id, expiresAt }, { status: 201 });
});
