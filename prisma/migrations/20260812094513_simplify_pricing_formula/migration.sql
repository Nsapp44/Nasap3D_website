-- Simplified pricing formula: unit price = hourlyRateCents x print time +
-- material cost. No separate margin multiplier or fixed setup fee anymore
-- (any margin now lives directly in each material's pricePerKgCents,
-- adjustable from the admin stock screen) — see PRICING.md.
ALTER TABLE "Settings" DROP COLUMN "marginPct";
ALTER TABLE "Settings" DROP COLUMN "setupFeeCents";
