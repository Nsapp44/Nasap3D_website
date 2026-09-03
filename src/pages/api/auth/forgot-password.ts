import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { prisma } from "../../../lib/server/prisma";
import { verifyCaptcha } from "../../../lib/server/captcha";
import { generateToken, hashToken } from "../../../lib/server/tokens";
import { sendMail } from "../../../lib/server/mailer";
import { renderEmailHtml, passwordResetContentHtml } from "../../../lib/server/emailTemplate";
import { enforceRateLimit, clientIp } from "../../../lib/api/rateLimit";

const schema = z.object({ email: z.string(), captchaToken: z.string().optional() });

// Direct port of POST /auth/forgot-password.
export const POST = apiHandler(async ({ request, clientAddress }) => {
  enforceRateLimit(`auth:forgot-password:${clientIp({ clientAddress })}`, 5, 60_000);

  const body = schema.safeParse(await request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  const rc = await verifyCaptcha(body.data.captchaToken);
  if (!rc.ok) return jsonError(400, "captcha_failed", { reason: rc.reason });

  const user = await prisma.user.findUnique({ where: { email: body.data.email } });
  // Always the same response — do not reveal whether the address exists.
  if (user && !user.deletedAt) {
    const raw = generateToken();
    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + 3 * 60 * 1000),
      },
    });
    const resetUrl = `${process.env.FRONT_URL || "http://localhost:3000"}/compte?resetToken=${raw}`;
    await sendMail(
      user.email,
      "Réinitialisation de votre mot de passe Nasap3D",
      `Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 3 minutes) : ${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
      renderEmailHtml("Réinitialisation de votre mot de passe Nasap3D", passwordResetContentHtml(resetUrl)),
    );
  }
  return json({ ok: true });
});
