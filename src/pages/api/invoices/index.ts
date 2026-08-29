import { apiHandler, json } from "../../../lib/api/handler";
import { requireAuth } from "../../../lib/api/auth";
import { prisma } from "../../../lib/server/prisma";

// Direct port of GET /invoices.
export const GET = apiHandler(async (context) => {
  const user = await requireAuth(context);
  const invoices = await prisma.invoice.findMany({
    where: { userId: user.id },
    orderBy: { issuedAt: "desc" },
    include: { order: { select: { ref: true } } },
  });
  return json({
    invoices: invoices.map((inv) => ({
      id: inv.id,
      ref: inv.ref,
      orderRef: inv.order.ref,
      amountCents: inv.amountCents,
      issuedAt: inv.issuedAt,
    })),
  });
});
