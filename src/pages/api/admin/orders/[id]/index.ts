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
    // Break-glass override for exactly the two SOFT guards below
    // (order_not_paid_yet, tracking_number_required) — added after a real
    // production incident: the Stripe webhook silently failed to mark a
    // paid order PENDING, and there was no way to unstick it from here
    // short of a direct DB edit. Deliberately does NOT bypass the
    // order_already_delivered guard just below — that one exists because
    // shipping/recipient data is unrecoverably wiped on delivery
    // (SHIPPING_DATA_PURGE), not because of a precondition that might be
    // wrong; forcing past it would destroy data with no way back.
    force: z.boolean().optional(),
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
  // each with its own dedicated endpoint and side effects. `force` exists
  // for exactly the case where that assumption is wrong (payment really
  // did happen, the webhook just failed to record it) — see the schema's
  // own comment above.
  if (!body.data.force && (order.status === "EXPERTISE" || order.status === "AWAITING_PAYMENT" || order.status === "REJECTED")) {
    return jsonError(409, "order_not_paid_yet");
  }

  // A shipped order (not a workshop pickup) needs a tracking number before
  // it can be marked READY/"Expédié" — either already on file (auto-fetched
  // from Boxtal) or provided in this same request (manual label purchased
  // outside the system, e.g. the oversized-parcel case).
  const nextStatus = body.data.status ?? order.status;
  const trackingNumber = body.data.trackingNumber ?? order.trackingNumber;
  if (!body.data.force && nextStatus === "READY" && order.shippingMode && order.shippingMode !== "PICKUP" && !trackingNumber) {
    return jsonError(409, "tracking_number_required");
  }

  if (body.data.force) {
    console.warn(`ADMIN EMERGENCY OVERRIDE: order ${order.ref} forced from ${order.status} to ${nextStatus}, bypassing normal guards`);
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

// Real request: no way to remove an order at all before this (a genuine
// error, a duplicate, or a refund handled outside the system) — every
// mistake was stuck visible in the list forever. OrderItem cascades
// automatically on Order delete (schema's onDelete: Cascade), but Invoice
// does NOT (no cascade set — deliberately: deleting a real invoice record
// is not something to do silently as a side effect), so it's deleted
// explicitly here first when present, or the Order delete would fail on
// that foreign key.
//
// Note this does NOT delete the invoice PDF file from storage — only the
// DB row that reference/UI access goes through — so the underlying
// document isn't destroyed even though the order disappears from the
// list. Worth flagging to whoever uses this for a refund: deleting the
// invoice record itself (as opposed to issuing a proper credit note/avoir)
// may have its own accounting implications — this button does what was
// asked (make the order go away), not a substitute for that process.
export const DELETE = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const order = await prisma.order.findUnique({ where: { id }, include: { invoice: true } });
  if (!order) return jsonError(404, "not_found");

  console.warn(`ADMIN DELETE: order ${order.ref} (status ${order.status}) deleted${order.invoice ? ` — had invoice ${order.invoice.ref}` : ""}`);

  if (order.invoice) {
    await prisma.invoice.delete({ where: { id: order.invoice.id } });
  }
  await prisma.order.delete({ where: { id } });

  return json({ ok: true });
});
