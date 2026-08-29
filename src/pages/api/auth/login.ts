import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { prisma } from "../../../lib/server/prisma";
import { verifyPassword } from "../../../lib/server/password";
import { verifyCaptcha } from "../../../lib/server/captcha";
import { createSession } from "../../../lib/server/session";
import { setSessionCookie, getGuestSessionId } from "../../../lib/api/cookies";
import { publicUser } from "../../../lib/server/serialize";
import { mergeGuestCartIntoUser } from "../../../lib/server/cart";
import { enforceRateLimit, clientIp } from "../../../lib/api/rateLimit";

const loginSchema = z.object({
  email: z.string(),
  password: z.string(),
  captchaToken: z.string().optional(),
  rememberMe: z.boolean().optional(),
});

// Direct port of POST /auth/login.
export const POST = apiHandler(async ({ request, cookies, clientAddress }) => {
  enforceRateLimit(`auth:login:${clientIp({ clientAddress })}`, 10, 60_000);

  const body = loginSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");
  const { email, password, captchaToken, rememberMe } = body.data;

  const rc = await verifyCaptcha(captchaToken);
  if (!rc.ok) return jsonError(400, "captcha_failed", { reason: rc.reason });

  const user = await prisma.user.findUnique({ where: { email } });
  // Same generic error whether the email is unknown or the password is
  // wrong — confirming which one it was lets an attacker enumerate
  // registered emails.
  if (!user || user.deletedAt || !(await verifyPassword(user.passwordHash, password))) {
    return jsonError(401, "invalid_credentials");
  }

  const guestSessionId = getGuestSessionId(cookies);
  if (guestSessionId) await mergeGuestCartIntoUser(guestSessionId, user.id);

  const { raw, expiresAt } = await createSession(user.id);
  setSessionCookie(cookies, raw, expiresAt, rememberMe === true);
  return json({ user: publicUser(user) });
});
