import type Stripe from "stripe";
import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { requireAuth } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";
import { stripe } from "../../../../lib/server/stripeClient";
import { decideStoredSession } from "../../../../lib/server/checkoutSession";

// Direct port of POST /orders/:id/pay — triggered by the "Payer avec
// Stripe" button that appears on the customer's account once their order
// has been accepted (AWAITING_PAYMENT). The Stripe session is built
// straight from the already-stored Order/OrderItem rows, not the cart
// (which is long since empty by this point). The Checkout Session already
// stored on the order is reused while it is still open, so repeated clicks
// never produce two payable sessions (409 payment_in_progress if it is paid).
export const POST = apiHandler(async (context) => {
  const user = await requireAuth(context);
  const { id } = context.params;

  const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
  if (!order || order.userId !== user.id) return jsonError(404, "not_found");
  if (order.status !== "AWAITING_PAYMENT") return jsonError(409, "not_awaiting_payment");

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = order.items.map((it) => ({
    quantity: 1,
    price_data: {
      currency: "eur",
      unit_amount: it.lineTotalCents,
      product_data: {
        name: it.materialSnapshot
          ? `${it.nameSnapshot} — ${it.materialSnapshot}, ${it.qualitySnapshot} (×${it.qty})`
          : it.nameSnapshot,
      },
    },
  }));
  if (order.shippingCents > 0) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: order.shippingCents,
        product_data: { name: `Livraison — ${order.shippingLabel || ""}` },
      },
    });
  }

  // Defensive check: the stored session must still match what we'd bill now.
  const expectedTotal = lineItems.reduce(
    (sum, li) => sum + (li.price_data?.unit_amount ?? 0) * (li.quantity ?? 1),
    0,
  );

  // A session may already exist for this order (double click, second tab,
  // browser back): reuse it, or refuse if it is already paid / being paid,
  // instead of handing out a second payable session.
  let existing: Stripe.Checkout.Session | null = null;
  if (order.stripeCheckoutSessionId) {
    try {
      existing = await stripe().checkout.sessions.retrieve(order.stripeCheckoutSessionId);
    } catch (err) {
      // Deleted session, test-mode ID in live mode, etc.: we just create a new one.
      console.warn(`[pay] cannot retrieve Stripe session ${order.stripeCheckoutSessionId} for order ${order.id}`, err);
      existing = null;
    }
  }

  if (existing) {
    const decision = decideStoredSession(existing, expectedTotal, order.id);
    if (decision === "reuse") return json({ url: existing.url });
    if (decision === "in_progress") return jsonError(409, "payment_in_progress");
    if (decision === "expire_and_create") {
      try {
        await stripe().checkout.sessions.expire(existing.id);
      } catch (err) {
        console.warn(`[pay] cannot expire Stripe session ${existing.id} for order ${order.id}`, err);
      }
    }
  }

  // Two simultaneous requests (double click) get the same session thanks to the
  // idempotency key; the key changes as soon as a session has been stored, so
  // an expired session is properly replaced by a new one.
  const session = await stripe().checkout.sessions.create(
    {
      mode: "payment",
      line_items: lineItems,
      customer_email: user.email,
      success_url: `${process.env.FRONT_URL}/compte?paid=1`,
      cancel_url: `${process.env.FRONT_URL}/compte?canceled=1`,
      metadata: { orderId: order.id },
    },
    { idempotencyKey: `pay-${order.id}-${order.stripeCheckoutSessionId ?? "first"}` },
  );

  // Stored for support/reconciliation purposes (looking a payment up in the
  // Stripe dashboard from an order) — no longer needed for the invoice
  // itself, which is generated from our own Order/OrderItem rows regardless
  // of Stripe (see invoiceGenerator.ts), but harmless and cheap to keep.
  await prisma.order.update({ where: { id: order.id }, data: { stripeCheckoutSessionId: session.id } });

  return json({ url: session.url });
});
