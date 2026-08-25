import { prisma } from "./prisma.js";
import { nextCounter } from "./counter.js";
import { getCartSummary, type CartSummary } from "./cart.js";
import type { ShippingRate, ParcelCm } from "./boxtal.js";

export async function nextOrderRef(): Promise<string> {
  const seq = await nextCounter("orderRef");
  return "N3D-" + String(1000 + seq);
}

export class EmptyCartError extends Error {}

export interface ShippingSelection {
  mode: "PICKUP" | "RELAY" | "HOME";
  rate: ShippingRate;
  weightG: number;
  parcelCm: ParcelCm;
  oversized: boolean;
  recipient: { name: string; phone: string; address: string; city: string; zipcode: string; country: string };
  relayPoint?: { code: string; name: string; address: string; city: string; zipcode: string };
}

// Called at "Passer la commande pour expertise" time (POST /checkout, see
// routes/checkout.ts) — no Stripe/payment involved at all: the order is
// created straight away, in EXPERTISE status, so an admin can review
// feasibility before ever charging the customer. `shipping` is the
// selection re-verified server-side at /checkout time — its price was
// never trusted from the client.
export async function createOrderFromCart(
  userId: string,
  shipping: ShippingSelection | null,
): Promise<{ orderId: string; ref: string; totalCents: number }> {
  const summary: CartSummary = await getCartSummary({ userId });
  if (summary.lines.length === 0) throw new EmptyCartError();

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
        status: "EXPERTISE",
        subtotalCents: summary.subtotalCents,
        discountCents: summary.discountCents,
        shippingCents,
        totalCents,
        shippingMode: shipping?.mode,
        shippingCarrierCode: shipping?.rate.operatorCode,
        shippingServiceCode: shipping?.rate.serviceCode,
        shippingLabel: shipping?.rate.label,
        shippingWeightG: shipping?.weightG,
        shippingParcelLengthCm: shipping?.parcelCm.length,
        shippingParcelWidthCm: shipping?.parcelCm.width,
        shippingParcelHeightCm: shipping?.parcelCm.height,
        shippingOversized: shipping?.oversized ?? false,
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
              ? [
                  {
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
                  },
                ]
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

// A REJECTED order (declined at the expertise stage, never paid) stays
// visible to the customer for a while — see routes/admin.ts — with a
// polite "contact us" message rather than vanishing instantly. Run
// periodically (see index.ts) to actually clean these up afterward.
const REJECTED_ORDER_RETENTION_MS = 72 * 60 * 60 * 1000; // 72h

export async function sweepRejectedOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - REJECTED_ORDER_RETENTION_MS);
  const result = await prisma.order.deleteMany({
    where: { status: "REJECTED", rejectedAt: { lt: cutoff } },
  });
  return result.count;
}
