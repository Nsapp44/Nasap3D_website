import { prisma } from "./prisma";

// Nombre de cartons par code, d'apres Order.shippingParcels (JSON figé au checkout).
export function countBoxes(parcels: unknown): Map<string, number> {
  const out = new Map<string, number>();
  if (!Array.isArray(parcels)) return out;
  for (const p of parcels) {
    const code = p && typeof p === "object" ? (p as { box?: unknown }).box : null;
    if (typeof code === "string" && code) out.set(code, (out.get(code) ?? 0) + 1);
  }
  return out;
}

// Baisse automatique du stock de cartons quand une commande est payee : jamais sous 0.
// Ne leve jamais (le webhook Stripe ne doit pas passer en 500 pour un stock).
export async function decrementBoxStockForOrder(orderRef: string, parcels: unknown): Promise<void> {
  for (const [code, n] of countBoxes(parcels)) {
    try {
      const { count } = await prisma.shippingBoxStock.updateMany({ where: { code, qty: { gte: n } }, data: { qty: { decrement: n } } });
      if (count === 0) await prisma.shippingBoxStock.updateMany({ where: { code }, data: { qty: 0 } });
    } catch (err) {
      console.error(`order ${orderRef}: box stock decrement failed for ${code}`, err);
    }
  }
}
