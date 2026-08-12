import { prisma } from "./prisma.js";
import { nextCounter } from "./counter.js";
import { getCartSummary, type CartSummary } from "./cart.js";
import type { ShippingRate } from "./boxtal.js";

export async function nextOrderRef(): Promise<string> {
  const seq = await nextCounter("orderRef");
  return "N3D-" + String(1000 + seq);
}

export class EmptyCartError extends Error {}
export class ExpiredCartError extends Error {}

export interface ShippingSelection {
  mode: "RELAY" | "HOME";
  rate: ShippingRate;
  weightG: number;
  recipient: { name: string; phone: string; address: string; city: string; zipcode: string; country: string };
  relayPoint?: { code: string; name: string; address: string; city: string; zipcode: string };
}

// Packs a confirmed shipping selection into Stripe Checkout Session
// metadata (string keys/values only, 500 chars max each) so the webhook can
// recover it once payment is confirmed — see stripeWebhookRoutes below.
// Several short keys rather than one JSON blob: comfortably under Stripe's
// per-value limit even for long addresses, and easy to inspect in the
// Stripe dashboard.
export function packShippingMetadata(s: ShippingSelection): Record<string, string> {
  const m: Record<string, string> = {
    shipping_mode: s.mode,
    shipping_carrier: s.rate.operatorCode,
    shipping_service: s.rate.serviceCode,
    shipping_label: s.rate.label,
    shipping_cents: String(s.rate.cents),
    shipping_weight_g: String(Math.round(s.weightG)),
    recipient_name: s.recipient.name,
    recipient_phone: s.recipient.phone,
    recipient_address: s.recipient.address,
    recipient_city: s.recipient.city,
    recipient_zipcode: s.recipient.zipcode,
    recipient_country: s.recipient.country,
  };
  if (s.relayPoint) {
    m.relay_code = s.relayPoint.code;
    m.relay_name = s.relayPoint.name;
    m.relay_address = s.relayPoint.address;
    m.relay_city = s.relayPoint.city;
    m.relay_zipcode = s.relayPoint.zipcode;
  }
  return m;
}

function unpackShippingMetadata(metadata: Record<string, string>): ShippingSelection | null {
  if (!metadata.shipping_mode) return null;
  const mode = metadata.shipping_mode === "RELAY" ? "RELAY" as const : "HOME" as const;
  return {
    mode,
    rate: {
      operatorCode: metadata.shipping_carrier ?? "",
      serviceCode: metadata.shipping_service ?? "",
      label: metadata.shipping_label ?? "",
      cents: Number(metadata.shipping_cents) || 0,
    },
    weightG: Number(metadata.shipping_weight_g) || 0,
    recipient: {
      name: metadata.recipient_name ?? "",
      phone: metadata.recipient_phone ?? "",
      address: metadata.recipient_address ?? "",
      city: metadata.recipient_city ?? "",
      zipcode: metadata.recipient_zipcode ?? "",
      country: metadata.recipient_country ?? "FR",
    },
    relayPoint: mode === "RELAY"
      ? {
          code: metadata.relay_code ?? "",
          name: metadata.relay_name ?? "",
          address: metadata.relay_address ?? "",
          city: metadata.relay_city ?? "",
          zipcode: metadata.relay_zipcode ?? "",
        }
      : undefined,
  };
}

export function shippingFromStripeMetadata(metadata: Record<string, string> | null | undefined): ShippingSelection | null {
  return metadata ? unpackShippingMetadata(metadata) : null;
}

// Called from the Stripe webhook once payment is confirmed. Takes the cart
// exactly as it stands right now (see server/README.md's checkout section
// for the accepted trade-off: a cart edited in another tab between "Payer"
// and the webhook firing — seconds, in practice — isn't re-priced here).
// `shipping` is the selection re-verified server-side at /checkout time
// (see checkoutRoutes) — its price was never trusted from the client.
export async function createOrderFromCart(
  userId: string,
  shipping: ShippingSelection | null,
): Promise<{ orderId: string; ref: string; totalCents: number }> {
  const summary: CartSummary = await getCartSummary({ userId });
  if (summary.lines.length === 0) throw new EmptyCartError();
  if (summary.hasExpired) throw new ExpiredCartError();

  const shippingCents = shipping?.rate.cents ?? 0;
  const totalCents = summary.totalCents + shippingCents;

  const ref = await nextOrderRef();
  const cartItems = await prisma.cartItem.findMany({
    where: { userId },
    include: { quoteJob: { include: { material: true, color: true, quality: true } } },
  });

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        ref,
        userId,
        status: "PENDING",
        subtotalCents: summary.subtotalCents,
        discountCents: summary.discountCents,
        shippingCents,
        totalCents,
        shippingMode: shipping?.mode,
        shippingCarrierCode: shipping?.rate.operatorCode,
        shippingServiceCode: shipping?.rate.serviceCode,
        shippingLabel: shipping?.rate.label,
        shippingWeightG: shipping?.weightG,
        recipientName: shipping?.recipient.name,
        recipientPhone: shipping?.recipient.phone,
        recipientAddress: shipping?.recipient.address,
        recipientCity: shipping?.recipient.city,
        recipientZipcode: shipping?.recipient.zipcode,
        recipientCountry: shipping?.recipient.country,
        relayPointCode: shipping?.relayPoint?.code,
        relayPointName: shipping?.relayPoint?.name,
        relayPointAddress: shipping?.relayPoint?.address,
        relayPointCity: shipping?.relayPoint?.city,
        relayPointZipcode: shipping?.relayPoint?.zipcode,
        items: {
          create: [
            ...cartItems.map((item) => {
              const line = summary.lines.find((l) => l.id === item.id)!;
              return {
                quoteJobId: item.quoteJobId,
                nameSnapshot: item.quoteJob.fileName,
                materialSnapshot: item.quoteJob.material.label,
                colorNameSnapshot: item.quoteJob.color.colorName,
                colorHexSnapshot: item.quoteJob.color.colorHex,
                infillSnapshot: item.quoteJob.infillPct,
                qualitySnapshot: item.quoteJob.quality.label,
                qty: item.qty,
                unitPriceCents: line.unitPriceCents,
                lineTotalCents: line.lineTotalCents,
              };
            }),
            ...(summary.smallOrderFeeCents > 0
              ? [{
                  quoteJobId: null,
                  nameSnapshot: "Frais de petite commande",
                  materialSnapshot: "",
                  colorNameSnapshot: "",
                  colorHexSnapshot: "",
                  infillSnapshot: 0,
                  qualitySnapshot: "",
                  qty: 1,
                  unitPriceCents: summary.smallOrderFeeCents,
                  lineTotalCents: summary.smallOrderFeeCents,
                }]
              : []),
          ],
        },
      },
    });
    await tx.cartItem.deleteMany({ where: { userId } });
    return created;
  });

  return { orderId: order.id, ref: order.ref, totalCents: order.totalCents };
}
