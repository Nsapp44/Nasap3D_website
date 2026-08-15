import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../lib/session.js";
import { getCartSummary, getCartTotalWeightG, getCartParcelRequirement, getCartTotalPrintMinutes } from "../lib/cart.js";
import { stripe } from "../lib/stripeClient.js";
import { createOrderFromCart, EmptyCartError, type ShippingSelection } from "../lib/orders.js";
import { quoteShippingRates, BoxtalConfigError, BoxtalApiError } from "../lib/boxtal.js";
import { nextCounter } from "../lib/counter.js";
import { saveFile } from "../lib/storage.js";
import { sendOrderPlacedEmail, notifyAdminOrderToReview, notifyAdminOrderPaid } from "../lib/orderEmails.js";

const shippingRecipientSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(20),
  address: z.string().trim().min(3).max(120),
  city: z.string().trim().min(1).max(80),
  zipcode: z.string().trim().min(2).max(12),
  country: z.string().trim().length(2).default("FR"),
});

const relayPointSchema = z.object({
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(80),
  address: z.string().trim().min(1).max(120),
  city: z.string().trim().min(1).max(80),
  zipcode: z.string().trim().min(1).max(12),
});

// Discriminated on mode rather than one loose object: PICKUP (free,
// in-person at the workshop) only ever needs a name/phone to know who's
// coming, never a real shipping address — RELAY/HOME need the full
// recipient (and RELAY additionally needs the chosen relay point).
const checkoutShippingSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("PICKUP"),
    recipient: z.object({
      name: z.string().trim().min(2).max(80),
      phone: z.string().trim().min(6).max(20),
    }),
  }),
  z.object({ mode: z.literal("RELAY"), recipient: shippingRecipientSchema, relayPoint: relayPointSchema }),
  z.object({ mode: z.literal("HOME"), recipient: shippingRecipientSchema }),
]);

// Checkout requires an account (not guest) — an Invoice is always tied to a
// User in the schema, and "download my invoice from my account" only makes
// sense if there's an account. The front prompts login/signup before this.
export async function checkoutRoutes(app: FastifyInstance) {
  // "Passer la commande pour expertise" — creates the order right away, no
  // Stripe involved at all: payment only happens later, once an admin has
  // reviewed feasibility and accepted it (see POST /orders/:id/pay below
  // and PATCH /admin/orders/:id in routes/admin.ts). This also sidesteps
  // the old design's dependency on Stripe's webhook actually reaching this
  // server to create the order at all — see server/README.md for why that
  // was fragile in local/dev environments without a webhook tunnel.
  app.post("/checkout", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const summary = await getCartSummary({ userId: user.id });
    if (summary.lines.length === 0) return reply.code(400).send({ error: "empty_cart" });

    const body = z.object({ shipping: checkoutShippingSchema }).safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "invalid_body" });
    const { shipping: requested } = body.data;

    let shipping: ShippingSelection;
    if (requested.mode === "PICKUP") {
      // Free, no carrier involved — never calls Boxtal at all, so none of
      // the packaging fee (see boxtal.ts) or parcel-box logic applies.
      shipping = {
        mode: "PICKUP",
        rate: { operatorCode: "PICKUP", serviceCode: "PICKUP", label: "Retrait à l'atelier", cents: 0, estimatedDeliveryDate: null },
        weightG: 0,
        parcelCm: { length: 0, width: 0, height: 0 },
        oversized: false,
        recipient: { ...requested.recipient, address: "", city: "", zipcode: "", country: "FR" },
      };
    } else {
      // The shipping price is NEVER trusted from the client — same
      // principle as the print quote itself (see server/PRICING.md). We
      // re-run the real Boxtal rate simulation server-side, right here, and
      // only ever charge the cents it just returned for the requested
      // carrier.
      const weightG = await getCartTotalWeightG({ userId: user.id });
      const parcelRequirement = await getCartParcelRequirement({ userId: user.id });
      const printMinutes = await getCartTotalPrintMinutes({ userId: user.id });
      let rates;
      try {
        rates = await quoteShippingRates(requested.recipient, weightG, parcelRequirement, printMinutes);
      } catch (err) {
        if (err instanceof BoxtalConfigError) return reply.code(503).send({ error: "shipping_not_configured" });
        if (err instanceof BoxtalApiError) return reply.code(502).send({ error: "shipping_provider_error" });
        throw err;
      }
      const rate = requested.mode === "RELAY" ? rates.relay : rates.home;
      if (!rate) return reply.code(409).send({ error: "shipping_offer_unavailable" });

      shipping = {
        mode: requested.mode,
        rate,
        weightG: rates.weightUsedG,
        parcelCm: rates.parcelCm,
        oversized: rates.oversized,
        recipient: requested.recipient,
        relayPoint: requested.mode === "RELAY" ? requested.relayPoint : undefined,
      };
    }

    let created;
    try {
      created = await createOrderFromCart(user.id, shipping);
    } catch (err) {
      if (err instanceof EmptyCartError) return reply.code(400).send({ error: "empty_cart" });
      throw err;
    }

    await sendOrderPlacedEmail(user.email, created.ref, created.totalCents);
    await notifyAdminOrderToReview(created.ref, user.email, created.totalCents);

    return reply.send({ ok: true, ref: created.ref });
  });

  // Triggered by the "Payer avec Stripe" button that appears on the
  // customer's account once their order has been accepted (AWAITING_PAYMENT)
  // — unlike the old flow, the Stripe session is built straight from the
  // already-stored Order/OrderItem rows, not the cart (which is long since
  // empty by this point).
  app.post("/orders/:id/pay", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order || order.userId !== request.user!.id) return reply.code(404).send({ error: "not_found" });
    if (order.status !== "AWAITING_PAYMENT") return reply.code(409).send({ error: "not_awaiting_payment" });

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
      customer_email: request.user!.email,
      invoice_creation: { enabled: true },
      success_url: `${process.env.FRONT_URL}/Account.dc.html?paid=1`,
      cancel_url: `${process.env.FRONT_URL}/Account.dc.html?canceled=1`,
      metadata: { orderId: order.id },
    });

    return reply.send({ url: session.url });
  });
}

// Registered as its own plugin scope in index.ts so the raw-buffer content
// parser below (required to verify Stripe's signature) never leaks into
// other routes, which need normal JSON parsing.
export async function stripeWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
    done(null, body);
  });

  app.post("/webhooks/stripe", async (request, reply) => {
    const signature = request.headers["stripe-signature"];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !signature) return reply.code(400).send({ error: "webhook_not_configured" });

    let event: Stripe.Event;
    try {
      event = stripe().webhooks.constructEvent(request.body as Buffer, signature as string, secret);
    } catch (err) {
      request.log.warn(err, "stripe webhook signature verification failed");
      return reply.code(400).send({ error: "invalid_signature" });
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;
      if (!orderId) {
        request.log.error("checkout.session.completed without metadata.orderId");
        return reply.send({ ok: true });
      }

      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (!order) {
        request.log.error(`checkout.session.completed for missing order ${orderId}`);
        return reply.send({ ok: true });
      }
      // Idempotency: Stripe can retry webhook delivery for the same event.
      if (order.status !== "AWAITING_PAYMENT") {
        return reply.send({ ok: true });
      }

      await prisma.order.update({
        where: { id: orderId },
        data: { status: "PENDING", stripePaymentIntentId: String(session.payment_intent) },
      });

      await createInvoiceFromStripeSession(session, orderId, order.userId, order.totalCents);
      await notifyAdminOrderPaid(order.ref, session.customer_email, order.totalCents);
    }

    return reply.send({ ok: true });
  });
}

async function createInvoiceFromStripeSession(
  session: Stripe.Checkout.Session,
  orderId: string,
  userId: string,
  amountCents: number,
) {
  if (!session.invoice) return;
  const invoice = await stripe().invoices.retrieve(String(session.invoice));
  if (!invoice.invoice_pdf) return;

  const res = await fetch(invoice.invoice_pdf);
  const pdfBuffer = Buffer.from(await res.arrayBuffer());

  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const dailySeq = await nextCounter("invoice:" + dateKey);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const ref = `FA${String(dailySeq).padStart(3, "0")}-${yyyy}_${mm}_${dd}_${user.customerNo}`;

  const pdfKey = `invoices/${ref}.pdf`;
  await saveFile(pdfKey, pdfBuffer);

  await prisma.invoice.create({
    data: {
      ref,
      orderId,
      userId,
      amountCents,
      pdfKey,
      dailySeq,
      issuedAt: now,
    },
  });
}
