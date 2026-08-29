import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../lib/api/auth";
import { prisma } from "../../../../../lib/server/prisma";
import { ORDER_STATUSES } from "../../../../../lib/server/orderStatus";
import { SHIPPING_DATA_PURGE } from "../../../../../lib/server/orderTracking";

// Direct port of PATCH /admin/orders/:id — generic status update
// (PRINTING/READY/DELIVERED) and/or tracking number.
export const PATCH = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const schema = z.object({
    status: z.enum(ORDER_STATUSES).optional(),
    trackingNumber: z.string().trim().min(1).max(60).optional(),
  });
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");
  if (!body.data.status && !body.data.trackingNumber) return jsonError(400, "invalid_body");

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return jsonError(404, "not_found");
  // Terminal state — no going back once delivered, on purpose: the
  // shipping/recipient data needed to make sense of an earlier status is
  // wiped the moment this is reached (see SHIPPING_DATA_PURGE below), so
  // there'd be nothing left to revert *to* even if we allowed it. A
  // genuine mistake needs a direct DB fix, not a button here.
  if (order.status === "DELIVERED") return jsonError(409, "order_already_delivered");
  // Production status changes (impression/expédition/livré) only make
  // sense once the order is actually paid — before that it's still going
  // through expertise/acceptance/payment (see the accept/reject routes),
  // each with its own dedicated endpoint and side effects.
  if (order.status === "EXPERTISE" || order.status === "AWAITING_PAYMENT" || order.status === "REJECTED") {
    return jsonError(409, "order_not_paid_yet");
  }

  // A shipped order (not a workshop pickup) needs a tracking number before
  // it can be marked READY/"Expédié" — either already on file (auto-fetched
  // from Boxtal) or provided in this same request (manual label purchased
  // outside the system, e.g. the oversized-parcel case).
  const nextStatus = body.data.status ?? order.status;
  const trackingNumber = body.data.trackingNumber ?? order.trackingNumber;
  if (nextStatus === "READY" && order.shippingMode && order.shippingMode !== "PICKUP" && !trackingNumber) {
    return jsonError(409, "tracking_number_required");
  }

  const now = new Date();
  const updated = await prisma.order.update({
    where: { id },
    data: {
      status: nextStatus,
      trackingNumber: body.data.trackingNumber ?? undefined,
      printingAt: nextStatus === "PRINTING" && !order.printingAt ? now : undefined,
      readyAt: nextStatus === "READY" && !order.readyAt ? now : undefined,
      deliveredAt: nextStatus === "DELIVERED" && !order.deliveredAt ? now : undefined,
      ...(nextStatus === "DELIVERED" ? SHIPPING_DATA_PURGE : {}),
    },
  });
  return json({ order: updated });
});
