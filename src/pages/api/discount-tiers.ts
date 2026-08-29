import { apiHandler, json } from "../../lib/api/handler";
import { prisma } from "../../lib/server/prisma";

// Direct port of server/src/routes/materials.ts's GET /discount-tiers.
export const GET = apiHandler(async () => {
  const tiers = await prisma.discountTier.findMany({ orderBy: { minQty: "asc" } });
  return json({ tiers: tiers.map((t) => ({ minQty: t.minQty, pct: t.pct })) });
});
