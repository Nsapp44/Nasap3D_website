import { z } from "zod";
import { apiHandler, json, jsonError } from "../../lib/api/handler";
import { requireAuth } from "../../lib/api/auth";
import { prisma } from "../../lib/server/prisma";
import { getCartSummary, getCartTotalWeightG, getCartParcelRequirement, getCartTotalPrintMinutes } from "../../lib/server/cart";
import { createOrderFromCart, EmptyCartError, type ShippingSelection } from "../../lib/server/orders";
import { quoteShippingRates, BoxtalConfigError, BoxtalApiError } from "../../lib/server/boxtal";
import { sendOrderPlacedEmail, notifyAdminOrderToReview } from "../../lib/server/orderEmails";

// The server runs in UTC (no TZ set in the Docker image), but "réessayez à
// partir de 00h00" in the daily-limit popup means Paris midnight, not UTC
// midnight — so the day boundary has to be computed against that zone, DST
// included, rather than naive UTC date slicing. Standard dependency-free
// technique: format `at` in the target zone, then measure how far that
// formatted wall-clock reading is from `at` itself to get the zone's
// current offset, and apply that offset to the zone's own local midnight.
function zonedMidnightUtc(timeZone: string, at: Date): Date {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  const offsetMs = asIfUtc - at.getTime();
  const localMidnightAsIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, 0, 0, 0);
  return new Date(localMidnightAsIfUtc - offsetMs);
}

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

// Direct port of POST /checkout — "Passer la commande pour expertise" —
// creates the order right away, no Stripe involved at all: payment only
// happens later, once an admin has reviewed feasibility and accepted it
// (see POST /api/orders/:id/pay and PATCH /api/admin/orders/:id). Checkout
// requires an account (not guest) — an Invoice is always tied to a User in
// the schema, and "download my invoice from my account" only makes sense
// if there's an account. The front prompts login/signup before this.
export const POST = apiHandler(async (context) => {
  const user = await requireAuth(context);

  // Daily order cap (like JLCPCB) — checked first, before any Boxtal call
  // or DB write, so a full workshop fails fast instead of wasting a rate
  // lookup. 0 = no limit. Reset is Paris midnight, matching the popup's
  // "réessayez à partir de 00h00".
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  const dailyLimit = settings?.dailyOrderLimit ?? 0;
  if (dailyLimit > 0) {
    const todayStart = zonedMidnightUtc("Europe/Paris", new Date());
    const todayCount = await prisma.order.count({ where: { createdAt: { gte: todayStart } } });
    if (todayCount >= dailyLimit) return jsonError(409, "daily_limit_reached");
  }

  const summary = await getCartSummary({ userId: user.id });
  if (summary.lines.length === 0) return jsonError(400, "empty_cart");

  const body = z.object({ shipping: checkoutShippingSchema }).safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");
  const { shipping: requested } = body.data;

  let shipping: ShippingSelection;
  if (requested.mode === "PICKUP") {
    // Free, no carrier involved — never calls Boxtal at all, so none of the
    // packaging fee or parcel-box logic applies.
    shipping = {
      mode: "PICKUP",
      rate: { operatorCode: "PICKUP", serviceCode: "PICKUP", label: "Retrait à l'atelier", cents: 0, estimatedDeliveryDate: null },
      weightG: 0,
      parcelCm: { length: 0, width: 0, height: 0 },
      oversized: false,
      recipient: { ...requested.recipient, address: "", city: "", zipcode: "", country: "FR" },
    };
  } else {
    // The shipping price is NEVER trusted from the client — same principle
    // as the print quote itself. We re-run the real Boxtal rate simulation
    // server-side, right here, and only ever charge the cents it just
    // returned for the requested carrier.
    const weightG = await getCartTotalWeightG({ userId: user.id });
    const parcelRequirement = await getCartParcelRequirement({ userId: user.id });
    const printMinutes = await getCartTotalPrintMinutes({ userId: user.id });
    let rates;
    try {
      rates = await quoteShippingRates(requested.recipient, weightG, parcelRequirement, printMinutes);
    } catch (err) {
      if (err instanceof BoxtalConfigError) return jsonError(503, "shipping_not_configured");
      if (err instanceof BoxtalApiError) return jsonError(502, "shipping_provider_error");
      throw err;
    }
    const rate = requested.mode === "RELAY" ? rates.relay : rates.home;
    if (!rate) return jsonError(409, "shipping_offer_unavailable");

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
    if (err instanceof EmptyCartError) return jsonError(400, "empty_cart");
    throw err;
  }

  await sendOrderPlacedEmail(user.email, created.ref, created.totalCents);
  await notifyAdminOrderToReview(created.ref, user.email, created.totalCents);

  return json({ ok: true, ref: created.ref });
});
