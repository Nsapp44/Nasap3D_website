import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { getSessionUser } from "../../../../lib/api/auth";
import { getGuestSessionId } from "../../../../lib/api/cookies";
import { prisma } from "../../../../lib/server/prisma";

function quotePublicView(
  q: {
    id: string;
    fileName: string;
    volumeCm3: number | null;
    weightG: number | null;
    estimatedTimeMin: number | null;
    unitPriceCents: number | null;
    totalPriceCents: number | null;
    quantity: number;
    infillPct: number;
    status: string;
    material: { key: string; label: string };
    color: { colorName: string; colorHex: string };
    quality: { key: string; label: string };
  },
  discountPct: number,
) {
  return {
    id: q.id,
    fileName: q.fileName,
    material: q.material.key,
    materialLabel: q.material.label,
    colorName: q.color.colorName,
    colorHex: q.color.colorHex,
    quality: q.quality.key,
    qualityLabel: q.quality.label,
    infillPct: q.infillPct,
    quantity: q.quantity,
    volumeCm3: q.volumeCm3,
    weightG: q.weightG,
    estimatedTimeMin: q.estimatedTimeMin,
    unitPriceCents: q.unitPriceCents,
    totalPriceCents: q.totalPriceCents,
    discountPct,
    status: q.status,
  };
}

// Direct port of GET /quotes/:id — owner-only (via user or guest-session
// cookie).
export const GET = apiHandler(async (context) => {
  const { id } = context.params;
  const quoteJob = await prisma.quoteJob.findUnique({
    where: { id },
    include: { material: true, color: true, quality: true },
  });
  if (!quoteJob) return jsonError(404, "not_found");

  const user = await getSessionUser(context);
  const sessionId = getGuestSessionId(context.cookies);
  const owns = (user && quoteJob.userId === user.id) || (!user && sessionId && quoteJob.sessionId === sessionId);
  if (!owns) return jsonError(404, "not_found");

  const tiers = await prisma.discountTier.findMany({ orderBy: { minQty: "asc" } });
  const discountPct = tiers.reduce((acc, t) => (quoteJob.quantity >= t.minQty ? Math.max(acc, t.pct) : acc), 0);
  return json({ quote: quotePublicView(quoteJob, discountPct) });
});
