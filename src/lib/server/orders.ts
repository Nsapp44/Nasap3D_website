import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { nextCounter } from "./counter";
import { getCartSummary, type CartSummary } from "./cart";
import type { ShippingRate } from "./boxtal";
import type { Parcel } from "./packing";

export async function nextOrderRef(): Promise<string> {
  const seq = await nextCounter("orderRef");
  return "N3D-" + String(1000 + seq);
}

export class EmptyCartError extends Error {}
// The cart changed (or was already consumed by a concurrent checkout)
// between reading it and creating the order.
export class CartChangedError extends Error {}

export interface ShippingSelection {
  mode: "PICKUP" | "RELAY" | "HOME";
  rate: ShippingRate;
  weightG: number;
  // Colis calculés par packPieces() ; vide pour un retrait atelier.
  parcels: Parcel[];
  recipient: { name: string; phone: string; address: string; city: string; zipcode: string; country: string };
  relayPoint?: { code: string; name: string; address: string; city: string; zipcode: string };
}

// Called at "Passer la commande pour expertise" time (POST /api/checkout)
// — no Stripe/payment involved at all: the order is created straight away,
// in EXPERTISE status, so an admin can review feasibility before ever
// charging the customer. `shipping` is the selection re-verified
// server-side at checkout time — its price was never trusted from the
// client.
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

  // The price summary and the rows above were read separately: refuse to
  // build an order if they disagree (cart edited in between).
  if (cartItems.length !== summary.lines.length) throw new CartChangedError();
  const linesById = new Map(summary.lines.map((l) => [l.id, l]));
  const itemRows = cartItems.map((item) => {
    const line = linesById.get(item.id);
    if (!line || line.qty !== item.qty) throw new CartChangedError();
    return {
      quoteJobId: item.quoteJobId,
      nameSnapshot: item.quoteJob.fileName,
      materialSnapshot: item.quoteJob.material.label,
      colorNameSnapshot: item.quoteJob.color.colorName,
      colorHexSnapshot: item.quoteJob.color.colorHex,
      infillSnapshot: item.quoteJob.infillPct,
      scaleSnapshot: item.quoteJob.scale,
      qualitySnapshot: item.quoteJob.quality.label,
      qty: item.qty,
      unitPriceCents: line.unitPriceCents,
      lineTotalCents: line.lineTotalCents,
    };
  });

  const order = await prisma.$transaction(async (tx) => {
    // Consume exactly the cart rows we priced, conditionally on id + qty.
    // Under READ COMMITTED a concurrent checkout's transaction blocks on rows
    // already deleted by the first one, then finds count 0 and rolls back:
    // no duplicate order. A skipped orderRef number is accepted.
    // Sorted by id so two concurrent checkouts lock rows in the same order (no deadlock).
    for (const item of [...cartItems].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
      const { count } = await tx.cartItem.deleteMany({ where: { id: item.id, userId, qty: item.qty } });
      if (count !== 1) throw new CartChangedError();
    }
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
        // Colis complets (JSON) ; les champs hérités gardent le 1er colis
        // pour les commandes lues par l'ancien code.
        shippingParcels: shipping && shipping.parcels.length > 0 ? (shipping.parcels as unknown as Prisma.InputJsonValue) : undefined,
        shippingParcelLengthCm: shipping ? (shipping.parcels[0]?.outerCm[0] ?? 0) : undefined,
        shippingParcelWidthCm: shipping ? (shipping.parcels[0]?.outerCm[1] ?? 0) : undefined,
        shippingParcelHeightCm: shipping ? (shipping.parcels[0]?.outerCm[2] ?? 0) : undefined,
        shippingOversized: false,
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
            ...itemRows,
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
    return created;
  });

  return { orderId: order.id, ref: order.ref, totalCents: order.totalCents };
}

// A REJECTED order (declined at the expertise stage, never paid) stays
// visible to the customer for a while (see the admin order-status route)
// with a polite "contact us" message rather than vanishing instantly. Run
// periodically (see src/middleware.ts) to actually clean these up
// afterward.
const REJECTED_ORDER_RETENTION_MS = 72 * 60 * 60 * 1000; // 72h

export async function sweepRejectedOrders(): Promise<number> {
  const cutoff = new Date(Date.now() - REJECTED_ORDER_RETENTION_MS);
  const result = await prisma.order.deleteMany({
    where: { status: "REJECTED", rejectedAt: { lt: cutoff } },
  });
  return result.count;
}
