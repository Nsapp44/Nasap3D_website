import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword, isValidEmail, isValidPassword } from "../lib/password.js";
import { nextCustomerNo } from "../lib/counter.js";
import { verifyCaptcha } from "../lib/captcha.js";
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
import { renderEmailHtml, passwordResetContentHtml } from "../lib/emailTemplate.js";
import { mergeGuestCartIntoUser } from "../lib/cart.js";
import {
  createPendingSignupCode,
  consumePendingSignupCode,
  resendPendingSignupCode,
  WrongCodeError,
  NoPendingCodeError,
  TooManyAttemptsError,
} from "../lib/verification.js";

const GUEST_COOKIE = "n3d_guest";

const credentialsSchema = z.object({
  email: z.string(),
  password: z.string(),
  captchaToken: z.string().optional(),
});
const loginSchema = credentialsSchema.extend({ rememberMe: z.boolean().optional() });

interface PendingSignupPayload {
  email: string;
  passwordHash: string;
}

export async function authRoutes(app: FastifyInstance) {
  // Step 1/2: validates the credentials and mails a 6-digit code, but does
  // NOT create the account yet — the email/password are stashed in the
  // VerificationCode's payload (see verification.ts) until the code is
  // confirmed below. Closing the popup or letting the 3-minute code expire
  // leaves no account behind, only an unused, self-expiring row.
  app.post("/auth/signup", { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = credentialsSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { email, password, captchaToken } = body.data;

    const rc = await verifyCaptcha(captchaToken);
    if (!rc.ok) return reply.code(400).send({ error: "captcha_failed", reason: rc.reason });

    if (!isValidEmail(email)) return reply.code(400).send({ error: "invalid_email" });
    if (!isValidPassword(password)) return reply.code(400).send({ error: "weak_password" });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(409).send({ error: "email_taken" });

    const passwordHash = await hashPassword(password);
    const { id, expiresAt, mailSent } = await createPendingSignupCode(email, {
      email,
      passwordHash,
    } satisfies PendingSignupPayload);
    // The pending code row exists either way, but there's no point handing
    // the client a pendingId for a code that never actually reached their
    // mailbox — they'd be stuck on the "enter your code" popup with nothing
    // to enter. Submitting the form again creates a fresh attempt instead.
    if (!mailSent) return reply.code(502).send({ error: "mail_send_failed" });
    return reply.code(201).send({ pendingId: id, expiresAt });
  });

  // Step 2/2: confirms the code and only THEN creates the account —
  // emailVerifiedAt is set immediately since control of the mailbox was
  // just proven, unlike the old create-first-verify-after flow.
  app.post(
    "/auth/signup/confirm",
    { config: { rateLimit: { max: 15, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const schema = z.object({ pendingId: z.string(), code: z.string().trim().length(6) });
      const body = schema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "invalid_body" });

      let payload: PendingSignupPayload;
      try {
        payload = await consumePendingSignupCode<PendingSignupPayload>(body.data.pendingId, body.data.code);
      } catch (err) {
        if (err instanceof NoPendingCodeError) return reply.code(400).send({ error: "no_pending_code" });
        if (err instanceof TooManyAttemptsError) return reply.code(429).send({ error: "too_many_attempts" });
        if (err instanceof WrongCodeError) return reply.code(400).send({ error: "wrong_code" });
        throw err;
      }

      // Re-check: someone else could have taken the email during the 3-minute
      // window between the request and this confirmation.
      const existing = await prisma.user.findUnique({ where: { email: payload.email } });
      if (existing) return reply.code(409).send({ error: "email_taken" });

      const user = await prisma.user.create({
        data: {
          email: payload.email,
          passwordHash: payload.passwordHash,
          customerNo: await nextCustomerNo(),
          role: "CLIENT",
          emailVerifiedAt: new Date(),
        },
      });

      const guestSessionId = request.cookies[GUEST_COOKIE];
      if (guestSessionId) await mergeGuestCartIntoUser(guestSessionId, user.id);

      const { raw, expiresAt } = await createSession(user.id);
      setSessionCookie(reply, raw, expiresAt);
      return reply.code(201).send({ user: publicUser(user) });
    },
  );

  app.post(
    "/auth/signup/resend",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const schema = z.object({ pendingId: z.string() });
      const body = schema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "invalid_body" });

      const record = await prisma.verificationCode.findUnique({ where: { id: body.data.pendingId } });
      if (!record || record.userId !== null || !record.payload)
        return reply.code(400).send({ error: "no_pending_code" });
      const { email } = JSON.parse(record.payload) as PendingSignupPayload;

      const result = await resendPendingSignupCode(body.data.pendingId, email);
      if (!result.ok) return reply.code(result.error === "too_soon" ? 429 : 400).send({ error: result.error });
      if (!result.mailSent) return reply.code(502).send({ error: "mail_send_failed" });
      return reply.send({ ok: true, expiresAt: result.expiresAt });
    },
  );

  app.post("/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { email, password, captchaToken, rememberMe } = body.data;

    const rc = await verifyCaptcha(captchaToken);
    if (!rc.ok) return reply.code(400).send({ error: "captcha_failed", reason: rc.reason });

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
    setSessionCookie(reply, raw, expiresAt, rememberMe === true);
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

  app.post(
    "/auth/forgot-password",
    { config: { rateLimit: { max: 5, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const schema = z.object({ email: z.string(), captchaToken: z.string().optional() });
      const body = schema.safeParse(request.body);
      if (!body.success) return reply.code(400).send({ error: "invalid_body" });

      const rc = await verifyCaptcha(body.data.captchaToken);
      if (!rc.ok) return reply.code(400).send({ error: "captcha_failed", reason: rc.reason });

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
        const resetUrl = `${process.env.FRONT_URL || "http://localhost:4321"}/compte?resetToken=${raw}`;
        await sendMail(
          user.email,
          "Réinitialisation de votre mot de passe Nasap3D",
          `Cliquez sur ce lien pour choisir un nouveau mot de passe (valable 1h) : ${resetUrl}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez cet email.`,
          renderEmailHtml("Réinitialisation de votre mot de passe Nasap3D", passwordResetContentHtml(resetUrl)),
        );
      }
      return reply.send({ ok: true });
    },
  );

  app.post("/auth/reset-password", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
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
