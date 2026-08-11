import type { FastifyInstance } from "fastify";
import Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import { getSessionUser, requireAuth } from "../lib/session.js";
import { getCartSummary } from "../lib/cart.js";
import { stripe } from "../lib/stripeClient.js";
import { createOrderFromCart, EmptyCartError, ExpiredCartError } from "../lib/orders.js";
import { nextCounter } from "../lib/counter.js";
import { saveFile } from "../lib/storage.js";

// Checkout requires an account (not guest) — an Invoice is always tied to a
// User in the schema, and "download my invoice from my account" only makes
// sense if there's an account. The front prompts login/signup before this.
export async function checkoutRoutes(app: FastifyInstance) {
  app.post("/checkout", { preHandler: requireAuth }, async (request, reply) => {
    const user = request.user!;
    const summary = await getCartSummary({ userId: user.id });
    if (summary.lines.length === 0) return reply.code(400).send({ error: "empty_cart" });
    if (summary.hasExpired) return reply.code(409).send({ error: "quote_expired_in_cart" });

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = summary.lines.map((l) => ({
      quantity: 1,
      price_data: {
        currency: "eur",
        unit_amount: l.lineTotalCents,
        product_data: {
          name: `Pièce personnalisée — ${l.material}, ${l.quality}, ${l.infillPct}% (×${l.qty}${l.discountPct ? `, -${l.discountPct}%` : ""})`,
        },
      },
    }));
    if (summary.smallOrderFeeCents > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: "eur",
          unit_amount: summary.smallOrderFeeCents,
          product_data: { name: `Frais de petite commande (panier < ${(summary.minOrderCents / 100).toFixed(2)}€)` },
        },
      });
    }

    const session = await stripe().checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      customer_email: user.email,
      invoice_creation: { enabled: true },
      success_url: `${process.env.FRONT_URL}/Cart.dc.html?paid=1`,
      cancel_url: `${process.env.FRONT_URL}/Cart.dc.html?canceled=1`,
      metadata: { userId: user.id },
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
      const userId = session.metadata?.userId;
      if (!userId) {
        request.log.error("checkout.session.completed without metadata.userId");
        return reply.send({ ok: true });
      }

      let created;
      try {
        created = await createOrderFromCart(userId);
      } catch (err) {
        if (err instanceof EmptyCartError || err instanceof ExpiredCartError) {
          request.log.error(err, "could not create order from cart at webhook time");
          return reply.send({ ok: true });
        }
        throw err;
      }

      await prisma.order.update({
        where: { id: created.orderId },
        data: { stripePaymentIntentId: String(session.payment_intent) },
      });

      await createInvoiceFromStripeSession(session, created.orderId, userId, created.totalCents);
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
