import { describe, it, expect } from "vitest";
import { computePrice, discountForQty } from "../src/lib/pricing.js";

// This is the anti-tampering core: the price a customer is charged must
// come only from these pure functions, fed by server-side data (slicer
// output, DB material price) — never from anything the client sends. See
// server/PRICING.md for the formula writeup: unit price = max(price floor,
// hourly rate x print time + material cost). No separate margin/setup fee
// (any margin lives directly in each material's price-per-kg instead).
describe("computePrice", () => {
  const baseInputs = {
    weightG: 100,
    estimatedTimeMin: 120,
    pricePerKgCents: 2200,
    hourlyRateCents: 500,
    minUnitPriceCents: 890,
    quantity: 1,
    discountTiers: [],
  };

  it("computes material + machine cost with no margin or setup fee, above the floor", () => {
    const result = computePrice(baseInputs);
    // material: 100g / 1000 * 2200 = 220c ; machine: 120/60 * 500 = 1000c
    expect(result.materialCostCents).toBe(220);
    expect(result.machineCostCents).toBe(1000);
    expect(result.unitPriceCents).toBe(1220);
  });

  it("floors the unit price at minUnitPriceCents for a small/quick piece, discreetly", () => {
    // material: 8g/1000*2200=17.6 ; machine: 15/60*500=125 -> raw ~142.6, well under the 890 floor
    const result = computePrice({ ...baseInputs, weightG: 8, estimatedTimeMin: 15 });
    expect(result.unitPriceCents).toBe(890);
  });

  it("never goes below the floor even for a zero-weight, zero-time piece", () => {
    const result = computePrice({ ...baseInputs, weightG: 0, estimatedTimeMin: 0 });
    expect(result.unitPriceCents).toBe(890);
  });

  it("is deterministic — same inputs always produce the same price", () => {
    const a = computePrice(baseInputs);
    const b = computePrice({ ...baseInputs });
    expect(a).toEqual(b);
  });

  it("ignores any extra/unexpected fields on the input (no client price field can leak through)", () => {
    const tampered = { ...baseInputs, unitPriceCents: 1, totalCents: 1 } as typeof baseInputs;
    const result = computePrice(tampered);
    expect(result.unitPriceCents).toBe(1220);
  });

  it("scales the subtotal linearly with quantity before discount", () => {
    const result = computePrice({ ...baseInputs, quantity: 3 });
    expect(result.subtotalCents).toBe(1220 * 3);
    expect(result.discountPct).toBe(0);
    expect(result.totalCents).toBe(1220 * 3);
  });

  it("applies the highest matching discount tier and nothing more", () => {
    const tiers = [
      { minQty: 5, pct: 10 },
      { minQty: 10, pct: 20 },
    ];
    const result = computePrice({ ...baseInputs, quantity: 10, discountTiers: tiers });
    expect(result.discountPct).toBe(20);
    const subtotal = 1220 * 10;
    expect(result.subtotalCents).toBe(subtotal);
    expect(result.totalCents).toBe(Math.round(subtotal * 0.8));
    expect(result.discountCents).toBe(subtotal - result.totalCents);
  });

  it("never applies a discount below the smallest tier's threshold", () => {
    const tiers = [{ minQty: 5, pct: 10 }];
    const result = computePrice({ ...baseInputs, quantity: 4, discountTiers: tiers });
    expect(result.discountPct).toBe(0);
    expect(result.totalCents).toBe(result.subtotalCents);
  });

  it("rounds the pre-floor unit price to the nearest cent rather than truncating", () => {
    // material: 100/1000*2200=220 ; machine: 121/60*500=1008.33... -> 1228.33 -> round 1228
    const result = computePrice({ ...baseInputs, estimatedTimeMin: 121 });
    expect(result.unitPriceCents).toBe(1228);
  });
});

describe("discountForQty", () => {
  const tiers = [
    { minQty: 5, pct: 10 },
    { minQty: 10, pct: 20 },
    { minQty: 20, pct: 30 },
  ];

  it("returns 0 below the first threshold", () => {
    expect(discountForQty(1, tiers)).toBe(0);
    expect(discountForQty(4, tiers)).toBe(0);
  });

  it("returns the exact tier's percentage at each threshold", () => {
    expect(discountForQty(5, tiers)).toBe(10);
    expect(discountForQty(10, tiers)).toBe(20);
    expect(discountForQty(20, tiers)).toBe(30);
  });

  it("returns the highest applicable tier regardless of array order", () => {
    const shuffled = [tiers[2], tiers[0], tiers[1]];
    expect(discountForQty(25, shuffled)).toBe(30);
  });

  it("returns 0 for an empty tier list", () => {
    expect(discountForQty(1000, [])).toBe(0);
  });
});
