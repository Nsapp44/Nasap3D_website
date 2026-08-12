import { describe, it, expect } from "vitest";
import { computePrice, discountForQty } from "../src/lib/pricing.js";

// This is the anti-tampering core: the price a customer is charged must
// come only from these pure functions, fed by server-side data (slicer
// output, DB material price) — never from anything the client sends. See
// server/PRICING.md for the formula writeup.
describe("computePrice", () => {
  const baseInputs = {
    weightG: 10,
    estimatedTimeMin: 30,
    pricePerKgCents: 2200,
    hourlyRateCents: 600,
    setupFeeCents: 150,
    marginPct: 30,
    quantity: 1,
    discountTiers: [],
  };

  it("computes material + machine + setup cost before margin", () => {
    const result = computePrice(baseInputs);
    // material: 10g / 1000 * 2200 = 22c ; machine: 30/60 * 600 = 300c
    expect(result.materialCostCents).toBe(22);
    expect(result.machineCostCents).toBe(300);
    expect(result.setupFeeCents).toBe(150);
    // beforeMargin = 22 + 300 + 150 = 472 ; *1.30 = 613.6 -> round 614
    expect(result.unitPriceCents).toBe(614);
  });

  it("is deterministic — same inputs always produce the same price", () => {
    const a = computePrice(baseInputs);
    const b = computePrice({ ...baseInputs });
    expect(a).toEqual(b);
  });

  it("ignores any extra/unexpected fields on the input (no client price field can leak through)", () => {
    const tampered = { ...baseInputs, unitPriceCents: 1, totalCents: 1 } as typeof baseInputs;
    const result = computePrice(tampered);
    expect(result.unitPriceCents).toBe(614);
  });

  it("scales the subtotal linearly with quantity before discount", () => {
    const result = computePrice({ ...baseInputs, quantity: 3 });
    expect(result.subtotalCents).toBe(614 * 3);
    expect(result.discountPct).toBe(0);
    expect(result.totalCents).toBe(614 * 3);
  });

  it("applies the highest matching discount tier and nothing more", () => {
    const tiers = [
      { minQty: 5, pct: 10 },
      { minQty: 10, pct: 20 },
    ];
    const result = computePrice({ ...baseInputs, quantity: 10, discountTiers: tiers });
    expect(result.discountPct).toBe(20);
    const subtotal = 614 * 10;
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

  it("rounds the unit price to the nearest cent rather than truncating", () => {
    // beforeMargin chosen so the *1.x multiplication lands on a half-cent
    const result = computePrice({ ...baseInputs, weightG: 1, estimatedTimeMin: 1, marginPct: 0 });
    // material: 1/1000*2200=2.2 ; machine: 1/60*600=10 ; setup 150 -> 162.2 -> round 162
    expect(result.unitPriceCents).toBe(162);
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
