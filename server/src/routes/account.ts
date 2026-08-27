import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword, isValidEmail, isValidPassword } from "../lib/password.js";
import { requireAuth, revokeAllSessions, createSession, setSessionCookie, clearSessionCookie } from "../lib/session.js";
import { publicUser } from "../lib/serialize.js";
import {
  createAndSendVerificationCode,
  consumeVerificationCode,
  canResend,
  WrongCodeError,
  NoPendingCodeError,
  TooManyAttemptsError,
} from "../lib/verification.js";

interface EmailChangePayload {
  newEmail: string;
}
interface PasswordChangePayload {
  newPasswordHash: string;
}

export async function accountRoutes(app: FastifyInstance) {
  // Email and password changes are both two-step: request (validates
  // current credentials, computes what the change *would* be) then confirm
  // (a 6-digit code, proving control of the relevant mailbox, actually
  // applies it) — see server/src/lib/verification.ts. The code for an email
  // change goes to the NEW address (proves they can receive mail there);
  // the code for a password change goes to the CURRENT address (an
  // independent channel from "knows the current password").
  app.post("/account/email/request-change", { preHandler: requireAuth }, async (request, reply) => {
    const schema = z.object({ newEmail: z.string(), currentPassword: z.string() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    if (!isValidEmail(body.data.newEmail)) return reply.code(400).send({ error: "invalid_email" });

    const user = request.user!;
    if (!(await verifyPassword(user.passwordHash, body.data.currentPassword))) {
      return reply.code(401).send({ error: "wrong_password" });
    }

    const taken = await prisma.user.findUnique({ where: { email: body.data.newEmail } });
    if (taken && taken.id !== user.id) return reply.code(409).send({ error: "email_taken" });

    // Doubles as "resend": the front-end just calls this again (with the
    // same fields, still on screen in the popup) if the customer needs a
    // new code — no separate resend endpoint needed.
    if (!(await canResend(user.id, "EMAIL_CHANGE"))) return reply.code(429).send({ error: "too_soon" });

    const { expiresAt, mailSent } = await createAndSendVerificationCode(
      user.id,
      "EMAIL_CHANGE",
      body.data.newEmail,
      "Confirmez votre nouvelle adresse email — Nasap3D",
      `Saisissez ce code sur nasap3d.com pour confirmer que ${body.data.newEmail} est bien votre nouvelle adresse.`,
      { newEmail: body.data.newEmail } satisfies EmailChangePayload,
    );
    if (!mailSent) return reply.code(502).send({ error: "mail_send_failed" });
    return reply.send({ ok: true, expiresAt });
  });

  app.post("/account/email/confirm-change", { preHandler: requireAuth }, async (request, reply) => {
    const schema = z.object({ code: z.string().trim().length(6) });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const user = request.user!;
    let payload: EmailChangePayload | undefined;
    try {
      payload = await consumeVerificationCode<EmailChangePayload>(user.id, "EMAIL_CHANGE", body.data.code);
    } catch (err) {
      if (err instanceof NoPendingCodeError) return reply.code(400).send({ error: "no_pending_code" });
      if (err instanceof TooManyAttemptsError) return reply.code(429).send({ error: "too_many_attempts" });
      if (err instanceof WrongCodeError) return reply.code(400).send({ error: "wrong_code" });
      throw err;
    }
    if (!payload) return reply.code(400).send({ error: "no_pending_code" });

    const taken = await prisma.user.findUnique({ where: { email: payload.newEmail } });
    if (taken && taken.id !== user.id) return reply.code(409).send({ error: "email_taken" });

    const updated = await prisma.user.update({
      where: { id: user.id },
      // They just proved control of the mailbox — no separate SIGNUP-style
      // verification needed on top of that.
      data: { email: payload.newEmail, emailVerifiedAt: new Date() },
    });
    return reply.send({ user: publicUser(updated) });
  });

  app.post("/account/password/request-change", { preHandler: requireAuth }, async (request, reply) => {
    const schema = z.object({ currentPassword: z.string(), newPassword: z.string() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const user = request.user!;
    if (!(await verifyPassword(user.passwordHash, body.data.currentPassword))) {
      return reply.code(401).send({ error: "wrong_password" });
    }
    if (!isValidPassword(body.data.newPassword)) return reply.code(400).send({ error: "weak_password" });
    if (!(await canResend(user.id, "PASSWORD_CHANGE"))) return reply.code(429).send({ error: "too_soon" });

    const { expiresAt, mailSent } = await createAndSendVerificationCode(
      user.id,
      "PASSWORD_CHANGE",
      user.email,
      "Confirmez le changement de mot de passe — Nasap3D",
      "Une demande de changement de mot de passe a été faite sur votre compte Nasap3D. Saisissez ce code pour la confirmer.",
      { newPasswordHash: await hashPassword(body.data.newPassword) } satisfies PasswordChangePayload,
    );
    if (!mailSent) return reply.code(502).send({ error: "mail_send_failed" });
    return reply.send({ ok: true, expiresAt });
  });

  app.post("/account/password/confirm-change", { preHandler: requireAuth }, async (request, reply) => {
    const schema = z.object({ code: z.string().trim().length(6) });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const user = request.user!;
    let payload: PasswordChangePayload | undefined;
    try {
      payload = await consumeVerificationCode<PasswordChangePayload>(user.id, "PASSWORD_CHANGE", body.data.code);
    } catch (err) {
      if (err instanceof NoPendingCodeError) return reply.code(400).send({ error: "no_pending_code" });
      if (err instanceof TooManyAttemptsError) return reply.code(429).send({ error: "too_many_attempts" });
      if (err instanceof WrongCodeError) return reply.code(400).send({ error: "wrong_code" });
      throw err;
    }
    if (!payload) return reply.code(400).send({ error: "no_pending_code" });

    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: payload.newPasswordHash } });
    // Log out every other device, then re-issue a fresh session for this one.
    await revokeAllSessions(user.id);
    const { raw, expiresAt } = await createSession(user.id);
    setSessionCookie(reply, raw, expiresAt);
    return reply.send({ ok: true });
  });

  app.delete("/account", { preHandler: requireAuth }, async (request, reply) => {
    const schema = z.object({ currentPassword: z.string() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const user = request.user!;
    if (!(await verifyPassword(user.passwordHash, body.data.currentPassword))) {
      return reply.code(401).send({ error: "wrong_password" });
    }

    // Soft delete: keeps historical orders/invoices intact (they still
    // reference this row) while the account itself can no longer log in.
    await prisma.user.update({
      where: { id: user.id },
      data: { deletedAt: new Date() },
    });
    await revokeAllSessions(user.id);
    clearSessionCookie(reply);
    return reply.send({ ok: true });
  });
}
