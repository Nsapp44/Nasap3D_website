import { apiHandler, json, jsonError } from "../../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../../lib/api/auth";
import { prisma } from "../../../../../../lib/server/prisma";
import { createAndAttachInvoiceForOrder } from "../../../../../../lib/server/invoiceGenerator";

// Manual "just generate it" backdoor, next to the "Uploader une facture"
// fallback — for exactly the case the automatic generation (the webhook, or
// "Forcer → Payée"'s own call to this same function) silently failed for
// some reason (a transient subprocess timeout under real concurrent load,
// confirmed to happen for real this session) and the admin would rather
// retry the real generation than hand-upload a substitute PDF. Same
// function, same behavior as the automatic paths — this is not a separate
// code path to keep in sync, just a manual trigger for it.
export const POST = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const order = await prisma.order.findUnique({ where: { id }, include: { user: true, items: true } });
  if (!order) return jsonError(404, "not_found");

  const result = await createAndAttachInvoiceForOrder(order, order.user);
  console.warn(`ADMIN MANUAL INVOICE GENERATE: order ${order.ref} — ${result.attached ? "attached successfully" : `not attached (${result.reason})`}`);
  if (!result.attached) return jsonError(409, "generation_failed", { reason: result.reason });

  return json({ ok: true }, { status: 201 });
});
