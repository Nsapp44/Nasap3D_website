import type Stripe from "stripe";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { prisma } from "../../../lib/server/prisma";
import { stripe } from "../../../lib/server/stripeClient";
import { nextCounter } from "../../../lib/server/counter";
import { saveFile } from "../../../lib/server/storage";
import { notifyAdminOrderPaid, sendOrderPaidEmail } from "../../../lib/server/orderEmails";

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
  if (!secret || !signature) {
    // Real, reproduced production bug: this returned 400 with NO server-side
    // log at all — if STRIPE_WEBHOOK_SECRET is unset/misconfigured in prod,
    // or Stripe's request somehow arrives without its signature header,
    // every delivery just silently 400s forever with zero trace in `docker
    // logs`, making this exact failure mode undiagnosable after the fact.
    console.error(`stripe webhook rejected: secret configured=${!!secret} signature present=${!!signature}`);
    return jsonError(400, "webhook_not_configured");
  }

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

  // Standard Stripe Checkout (card, synchronous) never fires a dedicated
  // "declined" event mid-session — a declined card just shows an error on
  // Stripe's own page and the customer retries without leaving the session.
  // The only real "never paid" signal for that flow is the session simply
  // expiring (default 24h) after the customer gave up or kept failing.
  // Logged only, no status change: the order correctly stays
  // AWAITING_PAYMENT (the customer can still click "Payer" again — pay.ts
  // creates a brand new Checkout Session on every call, nothing here
  // depends on the expired one surviving) — this exists purely so a real
  // failed-payment attempt is visible in the logs instead of invisible,
  // e.g. to correlate with a support message like "I tried to pay but
  // nothing happened".
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    console.warn(`checkout.session.expired for order ${orderId ?? "(no orderId in metadata)"} — customer never completed payment on this session`);
    return json({ ok: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    if (!orderId) {
      console.error("checkout.session.completed without metadata.orderId");
      return json({ ok: true });
    }

    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: true } });
    if (!order) {
      console.error(`checkout.session.completed for missing order ${orderId}`);
      return json({ ok: true });
    }
    // Idempotency: Stripe can retry webhook delivery for the same event.
    // Logged (this used to be silent): a genuinely stuck order that reaches
    // this branch on every retry, always skipping instead of ever applying,
    // would otherwise leave zero trace of why it never moved past
    // AWAITING_PAYMENT — this is exactly the shape a real bug elsewhere
    // (the order landing in some other status before payment, a duplicate
    // session, a race) would take, and this log line is what would prove it.
    if (order.status !== "AWAITING_PAYMENT") {
      console.warn(`checkout.session.completed for order ${orderId}, but status is already "${order.status}" (not AWAITING_PAYMENT) — skipping, already applied or the order took a different path`);
      return json({ ok: true });
    }

    await prisma.order.update({
      where: { id: orderId },
      data: { status: "PENDING", stripePaymentIntentId: String(session.payment_intent) },
    });
    console.log(`order ${order.ref} marked PENDING from Stripe webhook`);

    // Invoice PDF + notification emails are follow-up side effects, not the
    // critical path — the order is already correctly marked paid above
    // regardless of what happens here. Isolated in its own try/catch so a
    // failure in any of these (a flaky PDF fetch, SMTP down) can't turn into
    // a 500 response to Stripe, which would otherwise trigger a webhook
    // retry that re-does none of this useful work anyway (the idempotency
    // check above would just skip it) while making the Stripe dashboard
    // show a false "delivery failed" for an event that actually succeeded
    // at the one thing that actually matters: recording the payment.
    try {
      await createInvoiceFromStripeSession(session, orderId, order.user, order.totalCents);
      await notifyAdminOrderPaid(order.ref, session.customer_email, order.totalCents);
      await sendOrderPaidEmail(order.user.email, order.ref, order.totalCents);
    } catch (err) {
      console.error(`order ${order.ref} marked paid, but invoice/email follow-up failed`, err);
    }
  }

  return json({ ok: true });
});

async function createInvoiceFromStripeSession(
  session: Stripe.Checkout.Session,
  orderId: string,
  user: { id: string; customerNo: string },
  amountCents: number,
) {
  if (!session.invoice) return;
  const invoice = await stripe().invoices.retrieve(String(session.invoice));
  if (!invoice.invoice_pdf) return;

  const res = await fetch(invoice.invoice_pdf);
  const pdfBuffer = Buffer.from(await res.arrayBuffer());

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
      userId: user.id,
      amountCents,
      pdfKey,
      dailySeq,
      issuedAt: now,
    },
  });
}
