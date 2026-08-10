import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword, isValidEmail, isValidPassword } from "../lib/password.js";
import { requireAuth, revokeAllSessions, createSession, setSessionCookie, clearSessionCookie } from "../lib/session.js";
import { publicUser } from "../lib/serialize.js";

export async function accountRoutes(app: FastifyInstance) {
  app.patch("/account/email", { preHandler: requireAuth }, async (request, reply) => {
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

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { email: body.data.newEmail },
    });
    return reply.send({ user: publicUser(updated) });
  });

  app.patch("/account/password", { preHandler: requireAuth }, async (request, reply) => {
    const schema = z.object({ currentPassword: z.string(), newPassword: z.string() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const user = request.user!;
    if (!(await verifyPassword(user.passwordHash, body.data.currentPassword))) {
      return reply.code(401).send({ error: "wrong_password" });
    }
    if (!isValidPassword(body.data.newPassword)) return reply.code(400).send({ error: "weak_password" });

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(body.data.newPassword) },
    });
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
