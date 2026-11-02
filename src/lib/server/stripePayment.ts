import type Stripe from "stripe";
import { prisma } from "./prisma";
import { createAndAttachInvoiceForOrder } from "./invoiceGenerator";
import { notifyAdminOrderPaid, notifyAdminPaymentAnomaly, sendOrderPaidEmail } from "./orderEmails";

function eur(cents: number | null | undefined) {
  return cents == null ? "(inconnu)" : (cents / 100).toFixed(2) + " €";
}

// Pure check that a Checkout Session really is a paid session for this order's exact amount, in euros.
export function checkPaidSession(
  session: { payment_status: string | null; amount_total: number | null; currency: string | null },
  order: { totalCents: number },
): { ok: true } | { ok: false; reason: "not_paid" | "amount_mismatch" | "currency_mismatch" } {
  if (session.payment_status !== "paid") return { ok: false, reason: "not_paid" };
  if (session.amount_total !== order.totalCents) return { ok: false, reason: "amount_mismatch" };
  if (session.currency?.toLowerCase() !== "eur") return { ok: false, reason: "currency_mismatch" };
  return { ok: true };
}

// payment_intent is an id string, an expanded object, or null — never store "null"/"undefined".
export function paymentIntentIdOf(session: { payment_intent?: string | { id: string } | null }): string | null {
  const pi = session.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && typeof pi.id === "string") return pi.id;
  return null;
}

const REASON_LABEL = {
  not_paid: "la session Stripe n'est pas au statut payé",
  amount_mismatch: "le montant payé ne correspond pas au total de la commande",
  currency_mismatch: "la devise payée n'est pas l'euro",
} as const;

// Applies a PAID Checkout Session to its order: AWAITING_PAYMENT -> PENDING exactly once, then invoice + emails.
// DB errors on the status update are NOT caught: they must bubble up so the webhook answers 500 and Stripe retries.
export async function applyPaidCheckoutSession(
  session: Stripe.Checkout.Session,
  eventType: string,
): Promise<"applied" | "duplicate" | "anomaly" | "ignored"> {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error(`${eventType} without metadata.orderId (session ${session.id})`);
    return "ignored";
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { user: true, items: true } });
  if (!order) {
    console.error(`${eventType} for missing order ${orderId}`);
    return "ignored";
  }

  const pi = paymentIntentIdOf(session);
  const stripeRef = pi ?? session.id;

  // Deferred payment methods: the session completes while still unpaid; the real transition comes with async_payment_succeeded.
  if (eventType === "checkout.session.completed" && session.payment_status === "unpaid") {
    console.log(`order ${order.ref}: ${eventType} with payment_status "unpaid" — waiting for checkout.session.async_payment_succeeded`);
    return "ignored";
  }

  const check = checkPaidSession(session, order);
  if (!check.ok) {
    const problem = `${REASON_LABEL[check.reason]} (reçu : ${eur(session.amount_total)} en ${session.currency ?? "devise inconnue"}, attendu : ${eur(order.totalCents)} en eur, statut de paiement : ${session.payment_status}). La commande n'a pas été modifiée.`;
    console.error(`order ${order.ref}: stripe payment anomaly (${check.reason}) — ${problem}`);
    await notifyAdminPaymentAnomaly(order.ref, problem, stripeRef);
    return "anomaly";
  }

  // Atomic compare-and-set: only one concurrent delivery can win the AWAITING_PAYMENT -> PENDING transition.
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, status: "AWAITING_PAYMENT" },
    data: {
      status: "PENDING",
      stripeCheckoutSessionId: session.id,
      ...(pi ? { stripePaymentIntentId: pi } : {}),
    },
  });

  if (count === 0) {
    const fresh = await prisma.order.findUnique({
      where: { id: orderId },
      select: { status: true, stripePaymentIntentId: true },
    });
    // Duplicate only if THIS PaymentIntent is already recorded. Not stripeCheckoutSessionId: pay.ts stores it before
    // payment, and an admin may have forced PENDING by hand (bank transfer) — a second real payment would hide behind it.
    if (pi && fresh?.stripePaymentIntentId === pi) {
      console.warn(`order ${order.ref}: ${eventType} already applied (PaymentIntent ${pi}) — skipping duplicate delivery`);
      return "duplicate";
    }
    const status = fresh?.status ?? "inconnu";
    const problem = `paiement Stripe reçu (${eur(session.amount_total)}) alors que la commande est en statut ${status} : vérifier et rembourser si besoin.`;
    console.error(`order ${order.ref}: ${problem}`);
    await notifyAdminPaymentAnomaly(order.ref, problem, stripeRef);
    return "anomaly";
  }

  console.log(`order ${order.ref} marked PENDING from Stripe webhook`);

  // Invoice PDF + emails are follow-ups, not the critical path: the payment is already recorded above, and a failure
  // here must not become a 500 (Stripe would retry, and the CAS above would just report a duplicate).
  try {
    const paid = await prisma.order.findUnique({ where: { id: orderId }, include: { user: true, items: true } });
    if (!paid) {
      console.error(`order ${order.ref} marked paid, but could not be re-read for invoice/email follow-up`);
      return "applied";
    }
    const result = await createAndAttachInvoiceForOrder(paid, paid.user);
    if (!result.attached) console.error(`order ${paid.ref} marked paid, but invoice generation failed: ${result.reason}`);
    await notifyAdminOrderPaid(paid.ref, session.customer_email ?? session.customer_details?.email, paid.totalCents);
    await sendOrderPaidEmail(paid.user.email, paid.ref, paid.totalCents);
  } catch (err) {
    console.error(`order ${order.ref} marked paid, but invoice/email follow-up failed`, err);
  }
  return "applied";
}

// Deferred payment (e.g. SEPA debit) refused: no status change, the order stays AWAITING_PAYMENT so the customer can pay again.
export async function handleAsyncPaymentFailed(session: Stripe.Checkout.Session): Promise<void> {
  const orderId = session.metadata?.orderId;
  if (!orderId) {
    console.error(`checkout.session.async_payment_failed without metadata.orderId (session ${session.id})`);
    return;
  }
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { ref: true } });
  if (!order) {
    console.error(`checkout.session.async_payment_failed for missing order ${orderId}`);
    return;
  }
  console.warn(`order ${order.ref}: checkout.session.async_payment_failed — order stays AWAITING_PAYMENT`);
  await notifyAdminPaymentAnomaly(
    order.ref,
    "le prélèvement / paiement différé a été refusé. La commande reste en attente de paiement et le client peut payer à nouveau depuis son compte.",
    paymentIntentIdOf(session) ?? session.id,
  );
}
