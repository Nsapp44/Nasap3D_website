import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/session.js";
import { readFileByKey } from "../lib/storage.js";

export async function customerOrderRoutes(app: FastifyInstance) {
  app.get("/orders", { preHandler: requireAuth }, async (request, reply) => {
    const orders = await prisma.order.findMany({
      where: { userId: request.user!.id },
      orderBy: { createdAt: "desc" },
      include: { items: true },
    });
    return reply.send({
      orders: orders.map((o) => ({
        id: o.id,
        ref: o.ref,
        status: o.status,
        totalCents: o.totalCents,
        createdAt: o.createdAt,
        items: o.items.map((i) => ({
          nameSnapshot: i.nameSnapshot,
          materialSnapshot: i.materialSnapshot,
          qualitySnapshot: i.qualitySnapshot,
          qty: i.qty,
        })),
      })),
    });
  });

  app.get("/invoices", { preHandler: requireAuth }, async (request, reply) => {
    const invoices = await prisma.invoice.findMany({
      where: { userId: request.user!.id },
      orderBy: { issuedAt: "desc" },
      include: { order: { select: { ref: true } } },
    });
    return reply.send({
      invoices: invoices.map((inv) => ({
        id: inv.id,
        ref: inv.ref,
        orderRef: inv.order.ref,
        amountCents: inv.amountCents,
        issuedAt: inv.issuedAt,
      })),
    });
  });

  app.get("/invoices/:id/pdf", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice || invoice.userId !== request.user!.id) {
      return reply.code(404).send({ error: "not_found" });
    }
    const pdf = await readFileByKey(invoice.pdfKey);
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="${invoice.ref}.pdf"`);
    return reply.send(pdf);
  });
}
