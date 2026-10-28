import { prisma } from "./prisma";
import { discountForQty } from "./pricing";
import type { PackPiece } from "./packing";

export interface CartLine {
  id: string;
  qty: number;
  unitPriceCents: number;
  discountPct: number;
  lineTotalCents: number;
  quoteJobId: string;
  fileName: string;
  material: string;
  colorName: string;
  colorHex: string;
  quality: string;
  infillPct: number;
  scale: number | null;
}

export interface CartSummary {
  lines: CartLine[];
  subtotalCents: number;
  discountCents: number;
  smallOrderFeeCents: number;
  totalCents: number;
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

  const lines: CartLine[] = items.map((item) => {
    const q = item.quoteJob;
    const unitPriceCents = q.unitPriceCents ?? 0;
    const discountPct = discountForQty(item.qty, tiers);
    const lineTotalCents = Math.round(unitPriceCents * item.qty * (1 - discountPct / 100));
    return {
      id: item.id,
      qty: item.qty,
      unitPriceCents,
      discountPct,
      lineTotalCents,
      quoteJobId: item.quoteJobId,
      fileName: q.fileName,
      material: q.material.label,
      colorName: q.color.colorName,
      colorHex: q.color.colorHex,
      quality: q.quality.label,
      infillPct: q.infillPct,
      scale: q.scale,
    };
  });

  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.qty, 0);
  const totalBeforeFeeCents = lines.reduce((sum, l) => sum + l.lineTotalCents, 0);
  const minOrderCents = settings!.minOrderCents;
  const belowMin = totalBeforeFeeCents > 0 && totalBeforeFeeCents < minOrderCents;
  const smallOrderFeeCents = belowMin ? settings!.smallOrderFeeCents : 0;

  return {
    lines,
    subtotalCents,
    discountCents: subtotalCents - totalBeforeFeeCents,
    smallOrderFeeCents,
    totalCents: totalBeforeFeeCents + smallOrderFeeCents,
    minOrderCents,
  };
}

// Total physical weight of everything currently in the cart — the input to
// the shipping rate simulation (the per-parcel weight, with carton and +10%,
// is computed by packing.ts).
export async function getCartTotalWeightG(identity: { userId: string } | { sessionId: string }): Promise<number> {
  const items = await prisma.cartItem.findMany({
    where: identity,
    include: { quoteJob: { select: { weightG: true } } },
  });
  return items.reduce((sum, item) => sum + (item.quoteJob.weightG ?? 0) * item.qty, 0);
}

// Total print time of everything in the cart (minutes, qty-weighted) — the
// input to productionBusinessDays() in boxtal.ts, which turns this into the
// real collection date passed to Boxtal.
export async function getCartTotalPrintMinutes(identity: { userId: string } | { sessionId: string }): Promise<number> {
  const items = await prisma.cartItem.findMany({
    where: identity,
    include: { quoteJob: { select: { estimatedTimeMin: true } } },
  });
  return items.reduce((sum, item) => sum + (item.quoteJob.estimatedTimeMin ?? 0) * item.qty, 0);
}

// Pièces à ranger en colis (voir packing.ts) : une entrée par unité (qty 3 →
// 3 pièces). Poids = QuoteJob.weightG, qui est par unité (le panier le
// multiplie par qty, cf. getCartTotalWeightG).
export async function getCartPieces(identity: { userId: string } | { sessionId: string }): Promise<PackPiece[]> {
  const items = await prisma.cartItem.findMany({
    where: identity,
    include: { quoteJob: { select: { bboxXMm: true, bboxYMm: true, bboxZMm: true, weightG: true, fileName: true } } },
    orderBy: { createdAt: "asc" },
  });
  const pieces: PackPiece[] = [];
  for (const item of items) {
    const { bboxXMm, bboxYMm, bboxZMm, weightG, fileName } = item.quoteJob;
    if (bboxXMm == null || bboxYMm == null || bboxZMm == null) continue;
    for (let n = 1; n <= item.qty; n++) {
      pieces.push({
        label: item.qty > 1 ? `${fileName} (${n}/${item.qty})` : fileName,
        bboxMm: [bboxXMm, bboxYMm, bboxZMm],
        weightG: weightG ?? 0,
      });
    }
  }
  return pieces;
}

// Called right after a successful login/signup: an anonymous visitor's cart
// (grouped by the guest session cookie) becomes theirs instead of vanishing.
export async function mergeGuestCartIntoUser(sessionId: string, userId: string): Promise<void> {
  if (!sessionId) return;
  // The underlying QuoteJob rows (the actual uploaded file + slice result
  // each cart item points to) carry their own separate ownership, not
  // inherited from the cart item — GET /quotes/:id/file checks
  // quoteJob.userId/.sessionId directly. Without migrating these too, a
  // guest's cart items reattach to their new account but the file preview
  // (viewer3d.js) 404s right after login: the route now sees an
  // authenticated user, so it stops honoring the old sessionId match, and
  // userId is still null on a quote job that was never touched here.
  await prisma.quoteJob.updateMany({
    where: { sessionId, userId: null },
    data: { userId, sessionId: null },
  });
  await prisma.cartItem.updateMany({
    where: { sessionId, userId: null },
    data: { userId, sessionId: null },
  });
}
