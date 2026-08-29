// The pricing formula. Kept as a pure function (no DB/network access) so it
// can be unit-tested directly: same inputs always produce the same price,
// which is exactly the property that makes server-side pricing trustworthy.
//
// Formula (explicit business decision, deliberately simple): unit price =
// hourly workshop rate x print time + material cost. No separate margin
// multiplier, no fixed setup fee — the hourly rate itself is where any
// margin/overhead lives, adjustable from the admin settings screen.

export interface PricingInputs {
  weightG: number;
  estimatedTimeMin: number;
  pricePerKgCents: number;
  hourlyRateCents: number;
  // Discreet per-piece price floor — a piece that computes below this just
  // shows this price, no visible "minimum fee" line (unlike the cart-level
  // small-order fee, which IS shown to the customer with an explanation).
  minUnitPriceCents: number;
  quantity: number;
  discountTiers: { minQty: number; pct: number }[];
}

export interface PricingResult {
  materialCostCents: number;
  machineCostCents: number;
  unitPriceCents: number;
  discountPct: number;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
}

export function discountForQty(qty: number, tiers: { minQty: number; pct: number }[]): number {
  let pct = 0;
  for (const t of tiers) if (qty >= t.minQty) pct = Math.max(pct, t.pct);
  return pct;
}

export function computePrice(inputs: PricingInputs): PricingResult {
  const materialCostCents = (inputs.weightG / 1000) * inputs.pricePerKgCents;
  const machineCostCents = (inputs.estimatedTimeMin / 60) * inputs.hourlyRateCents;
  const unitPriceCents = Math.max(inputs.minUnitPriceCents, Math.round(materialCostCents + machineCostCents));

  const subtotalCents = unitPriceCents * inputs.quantity;
  const discountPct = discountForQty(inputs.quantity, inputs.discountTiers);
  const totalCents = Math.round(subtotalCents * (1 - discountPct / 100));

  return {
    materialCostCents: Math.round(materialCostCents),
    machineCostCents: Math.round(machineCostCents),
    unitPriceCents,
    discountPct,
    subtotalCents,
    discountCents: subtotalCents - totalCents,
    totalCents,
  };
}
