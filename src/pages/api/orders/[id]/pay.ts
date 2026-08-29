import type Stripe from "stripe";
import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { requireAuth } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";
import { stripe } from "../../../../lib/server/stripeClient";

// Direct port of POST /orders/:id/pay — triggered by the "Payer avec
// Stripe" button that appears on the customer's account once their order
// has been accepted (AWAITING_PAYMENT). The Stripe session is built
// straight from the already-stored Order/OrderItem rows, not the cart
// (which is long since empty by this point).
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

  const session = await stripe().checkout.sessions.create({
    mode: "payment",
    line_items: lineItems,
    customer_email: user.email,
    invoice_creation: { enabled: true },
    success_url: `${process.env.FRONT_URL}/compte?paid=1`,
    cancel_url: `${process.env.FRONT_URL}/compte?canceled=1`,
    metadata: { orderId: order.id },
  });

  return json({ url: session.url });
});
