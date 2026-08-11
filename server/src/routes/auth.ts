import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword, isValidEmail, isValidPassword } from "../lib/password.js";
import { nextCustomerNo } from "../lib/counter.js";
import { verifyRecaptcha } from "../lib/recaptcha.js";
import {
  createSession,
  revokeSession,
  revokeAllSessions,
  setSessionCookie,
  clearSessionCookie,
  getSessionUser,
  SESSION_COOKIE,
} from "../lib/session.js";
import { publicUser } from "../lib/serialize.js";
import { generateToken, hashToken } from "../lib/tokens.js";
import { sendMail } from "../lib/mailer.js";
import { mergeGuestCartIntoUser } from "../lib/cart.js";

const GUEST_COOKIE = "n3d_guest";

const credentialsSchema = z.object({
  email: z.string(),
  password: z.string(),
  recaptchaToken: z.string().optional(),
});

async function currentRecaptchaMinScore() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return settings?.recaptchaMinScore ?? 0.5;
}

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/signup", async (request, reply) => {
    const body = credentialsSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { email, password, recaptchaToken } = body.data;

    const rc = await verifyRecaptcha(recaptchaToken, "signup", await currentRecaptchaMinScore());
    if (!rc.ok) return reply.code(400).send({ error: "recaptcha_failed", reason: rc.reason });

    if (!isValidEmail(email)) return reply.code(400).send({ error: "invalid_email" });
    if (!isValidPassword(password)) return reply.code(400).send({ error: "weak_password" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(409).send({ error: "email_taken" });

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        customerNo: await nextCustomerNo(),
        role: "CLIENT",
      },
    });

    const guestSessionId = request.cookies[GUEST_COOKIE];
    if (guestSessionId) await mergeGuestCartIntoUser(guestSessionId, user.id);

    const { raw, expiresAt } = await createSession(user.id);
    setSessionCookie(reply, raw, expiresAt);
    return reply.code(201).send({ user: publicUser(user) });
  });

  app.post("/auth/login", async (request, reply) => {
    const body = credentialsSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { email, password, recaptchaToken } = body.data;

    const rc = await verifyRecaptcha(recaptchaToken, "login", await currentRecaptchaMinScore());
    if (!rc.ok) return reply.code(400).send({ error: "recaptcha_failed", reason: rc.reason });

    const user = await prisma.user.findUnique({ where: { email } });
    // Same generic error whether the email is unknown or the password is
    // wrong — confirming which one it was lets an attacker enumerate
    // registered emails.
    if (!user || user.deletedAt || !(await verifyPassword(user.passwordHash, password))) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }

    const guestSessionId = request.cookies[GUEST_COOKIE];
    if (guestSessionId) await mergeGuestCartIntoUser(guestSessionId, user.id);

    const { raw, expiresAt } = await createSession(user.id);
    setSessionCookie(reply, raw, expiresAt);
    return reply.send({ user: publicUser(user) });
  });

  app.post("/auth/logout", async (request, reply) => {
    const raw = request.cookies[SESSION_COOKIE];
    if (raw) await revokeSession(raw);
    clearSessionCookie(reply);
    return reply.code(204).send();
  });

  app.get("/auth/me", async (request, reply) => {
    const user = await getSessionUser(request);
    return reply.send({ user: user ? publicUser(user) : null });
  });

  app.post("/auth/forgot-password", async (request, reply) => {
    const schema = z.object({ email: z.string(), recaptchaToken: z.string().optional() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const rc = await verifyRecaptcha(body.data.recaptchaToken, "forgot_password", await currentRecaptchaMinScore());
    if (!rc.ok) return reply.code(400).send({ error: "recaptcha_failed", reason: rc.reason });

    const user = await prisma.user.findUnique({ where: { email: body.data.email } });
    // Always the same response — do not reveal whether the address exists.
    if (user && !user.deletedAt) {
      const raw = generateToken();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: hashToken(raw),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      const resetUrl = `${process.env.FRONT_URL || "http://localhost:8080"}/Account.dc.html?resetToken=${raw}`;
      await sendMail(
        user.email,
        "Réinitialisation de votre mot de passe Nasap3D",
        `Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 1h) : ${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
      );
    }
    return reply.send({ ok: true });
  });

  app.post("/auth/reset-password", async (request, reply) => {
    const schema = z.object({ token: z.string(), newPassword: z.string() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    if (!isValidPassword(body.data.newPassword)) return reply.code(400).send({ error: "weak_password" });

    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(body.data.token) },
    });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return reply.code(400).send({ error: "invalid_or_expired_token" });
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

    return reply.send({ ok: true });
  });
}
