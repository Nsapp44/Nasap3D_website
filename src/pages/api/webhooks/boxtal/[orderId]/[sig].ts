import { apiHandler, json, jsonError } from "../../../../../lib/api/handler";
import { prisma } from "../../../../../lib/server/prisma";
import { verifyBoxtalWebhook } from "../../../../../lib/server/boxtalWebhook";
import { markOrderDelivered } from "../../../../../lib/server/orderTracking";

// Boxtal API v1 calls the `url_push` given at label purchase (GET, params in
// the query): type=tracking (etat CMD/ENV/LIV/ANN) or type=status
// (emc_reference, carrier_reference, label_url...). Expected answers: 200 ok,
// 422 unknown order, 500 error. The path signature is checked first.
const handle = apiHandler(async (context) => {
  const { orderId, sig } = context.params;
  if (!orderId || !sig || !verifyBoxtalWebhook(orderId, sig)) return jsonError(403, "invalid_signature");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return jsonError(422, "order_not_found");

  const q = new URL(context.request.url).searchParams;
  const type = q.get("type");

  if (type === "tracking") {
    const etat = q.get("etat");
    console.log(`[boxtal-webhook] ${orderId} etat=${etat} text=${q.get("text")}`);
    if (etat === "LIV") {
      if (order.status !== "DELIVERED" && order.boxtalOrderRef) await markOrderDelivered(orderId);
      return json({ ok: true });
    }
  }

  // Carrier tracking number: from type=status (carrier_reference) or ENV.
  const carrierRef = q.get("carrier_reference");
  if ((type === "status" || (type === "tracking" && q.get("etat") === "ENV")) && carrierRef && carrierRef !== order.trackingNumber) {
    if (order.status !== "DELIVERED") {
      await prisma.order.update({ where: { id: orderId }, data: { trackingNumber: carrierRef } });
    }
  }
  return json({ ok: true });
});

export const GET = handle;
export const POST = handle;
