import { apiHandler, json, jsonError } from "../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../lib/api/auth";
import { prisma } from "../../../../../lib/server/prisma";
import { sendOrderRejectedEmail } from "../../../../../lib/server/orderEmails";

// Direct port of POST /admin/orders/:id/reject — "Refuser" une commande à
// l'étape expertise (pièce infaisable, etc.) — seulement possible tant
// qu'elle est encore EXPERTISE (jamais payée, donc pas de remboursement à
// gérer). Passe en REJECTED, reste visible côté client (message poli) 72h
// (voir sweepRejectedOrders) puis disparaît toute seule.
export const POST = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const order = await prisma.order.findUnique({ where: { id }, include: { user: true } });
  if (!order) return jsonError(404, "not_found");
  if (order.status !== "EXPERTISE") return jsonError(409, "not_expertise");

  const updated = await prisma.order.update({
    where: { id },
    data: { status: "REJECTED", rejectedAt: new Date() },
  });
  await sendOrderRejectedEmail(order.user.email, order.ref);
  return json({ order: updated });
});
