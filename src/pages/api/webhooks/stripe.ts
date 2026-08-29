import type Stripe from "stripe";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { prisma } from "../../../lib/server/prisma";
import { stripe } from "../../../lib/server/stripeClient";
import { nextCounter } from "../../../lib/server/counter";
import { saveFile } from "../../../lib/server/storage";
import { notifyAdminOrderPaid } from "../../../lib/server/orderEmails";

// Direct port of POST /webhooks/stripe. In Fastify this needed its own
// encapsulated plugin scope registering a raw-buffer content-type parser,
// specifically so that override didn't leak into every other JSON route.
// Astro API routes hand each route its own standard Request object with no
// shared global body-parsing step, so there's nothing to isolate: reading
// the raw text here (BEFORE anything else touches the body — nothing else
// in this file does) is naturally scoped to this one route already.
export const POST = apiHandler(async (context) => {
  const signature = context.request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !signature) return jsonError(400, "webhook_not_configured");

  // Must be the exact raw bytes Stripe signed — .text() on the untouched
  // Request body gives that; re-serializing a parsed object would break
  // the HMAC signature check.
  const rawBody = await context.request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    console.warn("stripe webhook signature verification failed", err);
    return jsonError(400, "invalid_signature");
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (!orderId) {
      console.error("checkout.session.completed without metadata.orderId");
      return json({ ok: true });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      console.error(`checkout.session.completed for missing order ${orderId}`);
      return json({ ok: true });
    }
    // Idempotency: Stripe can retry webhook delivery for the same event.
    if (order.status !== "AWAITING_PAYMENT") {
      return json({ ok: true });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "PENDING", stripePaymentIntentId: String(session.payment_intent) },
    });

    await createInvoiceFromStripeSession(session, orderId, order.userId, order.totalCents);
    await notifyAdminOrderPaid(order.ref, session.customer_email, order.totalCents);
  }

  return json({ ok: true });
});

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
