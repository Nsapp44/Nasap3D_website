// The pricing formula — see server/PRICING.md for the full writeup with
// worked examples. Kept as a pure function (no DB/network access) so it can
// be unit-tested directly: same inputs always produce the same price, which
// is exactly the property that makes server-side pricing trustworthy.

export interface PricingInputs {
  weightG: number;
  estimatedTimeMin: number;
  pricePerKgCents: number;
  hourlyRateCents: number;
  setupFeeCents: number;
  marginPct: number;
  quantity: number;
  discountTiers: { minQty: number; pct: number }[];
}

export interface PricingResult {
  materialCostCents: number;
  machineCostCents: number;
  setupFeeCents: number;
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
  const beforeMargin = materialCostCents + machineCostCents + inputs.setupFeeCents;
  const unitPriceCents = Math.round(beforeMargin * (1 + inputs.marginPct / 100));

  const subtotalCents = unitPriceCents * inputs.quantity;
  const discountPct = discountForQty(inputs.quantity, inputs.discountTiers);
  const totalCents = Math.round(subtotalCents * (1 - discountPct / 100));

  return {
    materialCostCents: Math.round(materialCostCents),
    machineCostCents: Math.round(machineCostCents),
    setupFeeCents: inputs.setupFeeCents,
    unitPriceCents,
    discountPct,
    subtotalCents,
    discountCents: subtotalCents - totalCents,
    totalCents,
  };
}
