import { prisma } from "./prisma.js";
import { nextCounter } from "./counter.js";
import { getCartSummary, type CartSummary } from "./cart.js";

export async function nextOrderRef(): Promise<string> {
  const seq = await nextCounter("orderRef");
  return "N3D-" + String(1000 + seq);
}

export class EmptyCartError extends Error {}
export class ExpiredCartError extends Error {}

// Called from the Stripe webhook once payment is confirmed. Takes the cart
// exactly as it stands right now (see server/README.md's checkout section
// for the accepted trade-off: a cart edited in another tab between "Payer"
// and the webhook firing — seconds, in practice — isn't re-priced here).
export async function createOrderFromCart(userId: string): Promise<{ orderId: string; ref: string; totalCents: number }> {
  const summary: CartSummary = await getCartSummary({ userId });
  if (summary.lines.length === 0) throw new EmptyCartError();
  if (summary.hasExpired) throw new ExpiredCartError();

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
        totalCents: summary.totalCents,
        items: {
          create: [
            ...cartItems.map((item) => {
              const line = summary.lines.find((l) => l.id === item.id)!;
              return {
                quoteJobId: item.quoteJobId,
                nameSnapshot: "Pièce personnalisée (STL)",
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
