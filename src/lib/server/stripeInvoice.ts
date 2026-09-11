import type Stripe from "stripe";
import { prisma } from "./prisma";
import { stripe } from "./stripeClient";
import { nextCounter } from "./counter";
import { saveFile } from "./storage";

// Fetches the real invoice PDF Stripe generated for a completed Checkout
// Session (invoice_creation: { enabled: true } at session-create time, see
// orders/[id]/pay.ts) and stores it as our own Invoice row. Shared between
// the normal webhook path (webhooks/stripe.ts) and the admin emergency
// force-payment path (admin/orders/[id]/index.ts) — same logic either way,
// the only difference is how the caller obtained a completed `session`.
export async function createInvoiceFromStripeSession(
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

// Real incident this exists for: the Stripe webhook can fail (a
// misconfigured secret, downtime, anything) — before stripeCheckoutSessionId
// was stored at checkout-creation time (pay.ts), there was no reliable way
// to find which Stripe session/invoice belonged to an order after the fact
// (Stripe's own List Checkout Sessions API can't filter by our metadata,
// only by customer/payment_intent/status/date — confirmed, not a shortcut we
// chose). Called automatically by the admin's "Forcer → Payée" action so a
// genuinely-paid order that the webhook missed still ends up with a real
// invoice, without a separate manual step.
//
// Deliberately never throws — every failure mode returns { attached: false,
// reason }, since this must never block the status change itself (the order
// being marked paid is the important part; an admin can always retry this
// or attach the invoice manually if it genuinely never shows up).
export async function fetchAndAttachInvoiceForOrder(order: {
  id: string;
  totalCents: number;
  stripeCheckoutSessionId: string | null;
  user: { id: string; customerNo: string };
}): Promise<{ attached: boolean; reason?: string }> {
  if (!order.stripeCheckoutSessionId) {
    return { attached: false, reason: "no Stripe checkout session recorded on this order (created before this existed, or the customer never reached checkout)" };
  }

  const existing = await prisma.invoice.findUnique({ where: { orderId: order.id } });
  if (existing) {
    return { attached: false, reason: "order already has an invoice" };
  }

  let session: Stripe.Checkout.Session;
  try {
    session = await stripe().checkout.sessions.retrieve(order.stripeCheckoutSessionId);
  } catch (err) {
    return { attached: false, reason: `Stripe session lookup failed: ${err instanceof Error ? err.message : String(err)}` };
  }
  if (session.status !== "complete") {
    return { attached: false, reason: `Stripe session status is "${session.status}", not "complete" — no real payment recorded there` };
  }
  if (!session.invoice) {
    return { attached: false, reason: "Stripe session has no invoice attached" };
  }

  await createInvoiceFromStripeSession(session, order.id, order.user, order.totalCents);
  return { attached: true };
}
