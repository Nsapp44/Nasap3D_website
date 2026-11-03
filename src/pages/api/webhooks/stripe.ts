import type Stripe from "stripe";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { stripe } from "../../../lib/server/stripeClient";
import { applyPaidCheckoutSession, handleAsyncPaymentFailed } from "../../../lib/server/stripePayment";

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
  // "declined" event mid-session: a declined card just shows an error on
  // Stripe's own page and the customer retries. The only "never paid" signal
  // for that flow is the session expiring (default 24h).
  // Logged only, no status change: the order stays AWAITING_PAYMENT. pay.ts
  // reuses the session while it is open and creates a new one once it has
  // expired, so the customer can still click "Payer" again. This log exists
  // to correlate with a support message like "I tried to pay but nothing happened".
  if (event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.orderId;
    console.warn(`checkout.session.expired for order ${orderId ?? "(no orderId in metadata)"} — customer never completed payment on this session`);
    return json({ ok: true });
  }

  // completed = card paid right away; async_payment_succeeded = deferred method finally paid.
  // A DB error inside bubbles up as a 500 so Stripe retries the delivery.
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const session = event.data.object as Stripe.Checkout.Session;
    await applyPaidCheckoutSession(session, event.type);
    return json({ ok: true });
  }

  if (event.type === "checkout.session.async_payment_failed") {
    const session = event.data.object as Stripe.Checkout.Session;
    await handleAsyncPaymentFailed(session);
    return json({ ok: true });
  }

  return json({ ok: true });
});
