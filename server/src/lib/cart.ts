import { prisma } from "./prisma.js";
import { discountForQty } from "./pricing.js";

export interface CartLine {
  id: string;
  qty: number;
  unitPriceCents: number;
  discountPct: number;
  lineTotalCents: number;
  expired: boolean;
  fileName: string;
  material: string;
  colorName: string;
  colorHex: string;
  quality: string;
  infillPct: number;
}

export interface CartSummary {
  lines: CartLine[];
  subtotalCents: number;
  discountCents: number;
  smallOrderFeeCents: number;
  totalCents: number;
  hasExpired: boolean;
  minOrderCents: number;
}

// Shared by GET /cart (display) and the checkout route (authoritative
// amount for Stripe) — one place computes the cart total, so the number a
// customer sees is always the number they're charged.
export async function getCartSummary(identity: { userId: string } | { sessionId: string }): Promise<CartSummary> {
  const [items, tiers, settings] = await Promise.all([
    prisma.cartItem.findMany({
      where: identity,
      include: { quoteJob: { include: { material: true, color: true, quality: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.discountTier.findMany({ orderBy: { minQty: "asc" } }),
    prisma.settings.findUnique({ where: { id: 1 } }),
  ]);
  const now = new Date();

  const lines: CartLine[] = items.map((item) => {
    const q = item.quoteJob;
    const expired = q.unitPriceCents == null || (q.expiresAt != null && q.expiresAt < now);
    const unitPriceCents = q.unitPriceCents ?? 0;
    const discountPct = discountForQty(item.qty, tiers);
    const lineTotalCents = expired ? 0 : Math.round(unitPriceCents * item.qty * (1 - discountPct / 100));
    return {
      id: item.id,
      qty: item.qty,
      unitPriceCents,
      discountPct,
      lineTotalCents,
      expired,
      fileName: q.fileName,
      material: q.material.label,
      colorName: q.color.colorName,
      colorHex: q.color.colorHex,
      quality: q.quality.label,
      infillPct: q.infillPct,
    };
  });

  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0);
  const totalBeforeFeeCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const hasExpired = lines.some((l) => l.expired);
  const minOrderCents = settings!.minOrderCents;
  const belowMin = !hasExpired && totalBeforeFeeCents > 0 && totalBeforeFeeCents < minOrderCents;
  const smallOrderFeeCents = belowMin ? settings!.smallOrderFeeCents : 0;

  return {
    lines,
    subtotalCents,
    discountCents: subtotalCents - totalBeforeFeeCents,
    smallOrderFeeCents,
    totalCents: totalBeforeFeeCents + smallOrderFeeCents,
    hasExpired,
    minOrderCents,
  };
}

// Total physical weight of everything currently in the cart — the input to
// the shipping rate simulation (server/src/lib/boxtal.ts adds the 20%
// packaging margin on top of this).
export async function getCartTotalWeightG(identity: { userId: string } | { sessionId: string }): Promise<number> {
  const items = await prisma.cartItem.findMany({
    where: identity,
    include: { quoteJob: { select: { weightG: true } } },
  });
  return items.reduce((sum, item) => sum + (item.quoteJob.weightG ?? 0) * item.qty, 0);
}

// Called right after a successful login/signup: an anonymous visitor's cart
// (grouped by the guest session cookie) becomes theirs instead of vanishing.
export async function mergeGuestCartIntoUser(sessionId: string, userId: string): Promise<void> {
  if (!sessionId) return;
  await prisma.cartItem.updateMany({
    where: { sessionId, userId: null },
    data: { userId, sessionId: null },
  });
}
