import { prisma } from "./prisma";
import { discountForQty } from "./pricing";

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
// the shipping rate simulation (boxtal.ts adds the 20% packaging margin on
// top of this).
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

export interface BboxMm {
  xMm: number;
  yMm: number;
  zMm: number;
}

export interface CartParcelRequirement {
  // Bounding box of the single biggest item in the cart, by volume — a box
  // that can't even fit this alone definitely can't fit the order.
  maxItemBboxMm: BboxMm | null;
  // Sum of every line's bounding-box volume × qty — real 3D bin-packing
  // isn't attempted (these are irregular custom prints, not uniform boxes);
  // pickParcelCm() in boxtal.ts instead requires this sum to fit well under
  // the box's own volume.
  totalVolumeMm3: number;
}

// Feeds pickParcelCm() in boxtal.ts, which picks a shipping box from these
// two numbers together.
export async function getCartParcelRequirement(
  identity: { userId: string } | { sessionId: string },
): Promise<CartParcelRequirement> {
  const items = await prisma.cartItem.findMany({
    where: identity,
    include: { quoteJob: { select: { bboxXMm: true, bboxYMm: true, bboxZMm: true } } },
  });
  let maxItemBboxMm: BboxMm | null = null;
  let maxVolume = -1;
  let totalVolumeMm3 = 0;
  for (const item of items) {
    const { bboxXMm, bboxYMm, bboxZMm } = item.quoteJob;
    if (bboxXMm == null || bboxYMm == null || bboxZMm == null) continue;
    const volume = bboxXMm * bboxYMm * bboxZMm;
    totalVolumeMm3 += volume * item.qty;
    if (volume > maxVolume) {
      maxVolume = volume;
      maxItemBboxMm = { xMm: bboxXMm, yMm: bboxYMm, zMm: bboxZMm };
    }
  }
  return { maxItemBboxMm, totalVolumeMm3 };
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
