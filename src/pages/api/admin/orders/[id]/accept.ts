import { apiHandler, json, jsonError } from "../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../lib/api/auth";
import { prisma } from "../../../../../lib/server/prisma";
import { sendOrderAcceptedEmail } from "../../../../../lib/server/orderEmails";

// Direct port of POST /admin/orders/:id/accept — "Accepter" une commande à
// l'étape expertise : passe en attente de paiement et prévient le client
// par email (avec le lien vers son compte, où le bouton "Payer avec
// Stripe" apparaît désormais). Seule façon d'atteindre AWAITING_PAYMENT —
// jamais via le PATCH générique.
export const POST = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const order = await prisma.order.findUnique({ where: { id }, include: { user: true } });
  if (!order) return jsonError(404, "not_found");
  if (order.status !== "EXPERTISE") return jsonError(409, "not_expertise");

  const updated = await prisma.order.update({
    where: { id },
    data: { status: "AWAITING_PAYMENT", acceptedAt: new Date() },
  });
  await sendOrderAcceptedEmail(order.user.email, order.ref, order.totalCents);
  return json({ order: updated });
});
