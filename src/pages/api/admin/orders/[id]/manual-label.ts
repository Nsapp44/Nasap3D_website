import { apiHandler, json, jsonError } from "../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../lib/api/auth";
import { prisma } from "../../../../../lib/server/prisma";
import { resolveAlerts } from "../../../../../lib/server/adminAlerts";

const UNPAID = ["EXPERTISE", "AWAITING_PAYMENT", "REJECTED"];

// Étiquette faite à la main hors du site (ex. sur Boxtal) : on enregistre le numéro de suivi
// et on note que l'étiquette est faite pour que le site ne propose plus de l'acheter.
export const POST = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const body = (await context.request.json().catch(() => null)) as { trackingNumber?: unknown } | null;
  const raw = body?.trackingNumber;
  const trackingNumber = typeof raw === "string" ? raw.trim() : "";
  if (!trackingNumber || trackingNumber.length > 100) return jsonError(400, "invalid_body");

  const order = await prisma.order.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!order) return jsonError(404, "not_found");
  if (UNPAID.includes(order.status)) return jsonError(409, "order_not_paid");

  await prisma.order.update({ where: { id }, data: { trackingNumber, labelManualAt: new Date() } });
  await resolveAlerts("LABEL_REFUSED", order.id);
  return json({ ok: true, trackingNumber });
});
