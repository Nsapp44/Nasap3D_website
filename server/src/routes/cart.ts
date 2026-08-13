import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { getSessionUser } from "../lib/session.js";
import { getOrCreateGuestSessionId } from "../lib/guestSession.js";
import { getCartSummary } from "../lib/cart.js";
import { deleteQuoteJobFileIfOrphaned } from "../lib/quoteCleanup.js";

async function identityFor(request: FastifyRequest, reply: FastifyReply) {
  const user = await getSessionUser(request);
  if (user) return { userId: user.id } as const;
  const sessionId = getOrCreateGuestSessionId(request, reply);
  return { sessionId } as const;
}

export async function cartRoutes(app: FastifyInstance) {
  app.get("/cart", async (request, reply) => {
    const identity = await identityFor(request, reply);
    const summary = await getCartSummary(identity);
    return reply.send(summary);
  });

  app.post("/cart", async (request, reply) => {
    const schema = z.object({ quoteJobId: z.string(), qty: z.number().int().positive().optional() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const user = await getSessionUser(request);
    const sessionId = user ? null : getOrCreateGuestSessionId(request, reply);

    const quoteJob = await prisma.quoteJob.findUnique({ where: { id: body.data.quoteJobId } });
    if (!quoteJob) return reply.code(404).send({ error: "quote_not_found" });
    const owns = (user && quoteJob.userId === user.id) || (!user && quoteJob.sessionId === sessionId);
    if (!owns) return reply.code(403).send({ error: "forbidden" });
    if (quoteJob.status !== "ANALYZED") return reply.code(409).send({ error: "quote_not_ready" });

    await prisma.cartItem.create({
      data: {
        userId: user?.id,
        sessionId: sessionId ?? undefined,
        quoteJobId: quoteJob.id,
        qty: body.data.qty ?? quoteJob.quantity,
      },
    });

    const identity = user ? { userId: user.id } as const : { sessionId: sessionId! } as const;
    const summary = await getCartSummary(identity);
    return reply.code(201).send(summary);
  });

  app.patch("/cart/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const schema = z.object({ qty: z.number().int().positive() });
    const body = schema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });

    const identity = await identityFor(request, reply);
    const item = await prisma.cartItem.findUnique({ where: { id } });
    if (!item) return reply.code(404).send({ error: "not_found" });
    const owns = ("userId" in identity && item.userId === identity.userId) ||
      ("sessionId" in identity && item.sessionId === identity.sessionId);
    if (!owns) return reply.code(404).send({ error: "not_found" });

    await prisma.cartItem.update({ where: { id }, data: { qty: body.data.qty } });
    const summary = await getCartSummary(identity);
    return reply.send(summary);
  });

  app.delete("/cart/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const identity = await identityFor(request, reply);
    const item = await prisma.cartItem.findUnique({ where: { id } });
    if (!item) return reply.code(404).send({ error: "not_found" });
    const owns = ("userId" in identity && item.userId === identity.userId) ||
      ("sessionId" in identity && item.sessionId === identity.sessionId);
    if (!owns) return reply.code(404).send({ error: "not_found" });

    await prisma.cartItem.delete({ where: { id } });
    await deleteQuoteJobFileIfOrphaned(item.quoteJobId);
    const summary = await getCartSummary(identity);
    return reply.send(summary);
  });
}
