import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { requireAuth } from "../../../lib/api/auth";
import { prisma } from "../../../lib/server/prisma";

// Direct port of DELETE /orders/:id — customer-initiated cancellation, only
// while the order hasn't been reviewed yet (EXPERTISE): no payment has been
// taken at this point, so there's nothing to refund, and a hard delete is
// safe (no Invoice can exist yet — only ever created from the Stripe
// webhook after payment). Cascades to OrderItem via onDelete: Cascade in
// the schema, so the order disappears everywhere, admin included, as if it
// had never been placed.
export const DELETE = apiHandler(async (context) => {
  const user = await requireAuth(context);
  const { id } = context.params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order || order.userId !== user.id) return jsonError(404, "not_found");
  if (order.status !== "EXPERTISE") return jsonError(409, "not_cancellable");

  await prisma.order.delete({ where: { id } });
  return json({ ok: true });
});
