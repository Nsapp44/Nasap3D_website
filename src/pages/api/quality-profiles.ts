import { apiHandler, json } from "../../lib/api/handler";
import { prisma } from "../../lib/server/prisma";

// Direct port of server/src/routes/materials.ts's GET /quality-profiles.
export const GET = apiHandler(async () => {
  const qualities = await prisma.qualityProfile.findMany({
    where: { active: true },
    orderBy: { layerHeightMm: "desc" },
  });
  return json({
    qualities: qualities.map((q) => ({ key: q.key, label: q.label, layerHeightMm: q.layerHeightMm })),
  });
});
