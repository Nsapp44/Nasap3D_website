import { apiHandler, json } from "../../../../lib/api/handler";
import { requireAdmin } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";

// Direct port of GET /admin/materials — lists ALL materials (incl.
// inactive), unlike the public GET /api/materials.
export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const materials = await prisma.material.findMany({
    orderBy: { label: "asc" },
    include: { colors: { orderBy: { colorName: "asc" } } },
  });
  return json({ materials });
});
