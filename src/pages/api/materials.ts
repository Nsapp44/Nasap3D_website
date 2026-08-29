import { apiHandler, json } from "../../lib/api/handler";
import { prisma } from "../../lib/server/prisma";

// Direct port of server/src/routes/materials.ts's GET /materials — public,
// read-only, powers the configurator's material/color pickers.
export const GET = apiHandler(async () => {
  const materials = await prisma.material.findMany({
    where: { active: true },
    orderBy: { label: "asc" },
    include: { colors: { orderBy: { colorName: "asc" } } },
  });
  return json({
    materials: materials.map((m) => ({
      key: m.key,
      label: m.label,
      pricePerKgCents: m.pricePerKgCents,
      colors: m.colors.map((c) => ({ id: c.id, colorName: c.colorName, colorHex: c.colorHex, inStock: c.inStock })),
    })),
  });
});
