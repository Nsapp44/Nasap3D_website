import { apiHandler, json } from "../../lib/api/handler";
import { prisma } from "../../lib/server/prisma";

// Direct port of server/src/routes/materials.ts's GET /quote-enabled — the
// real "mode vacances" source of truth (also checked server-side in
// POST /quotes, ported in a later phase).
export const GET = apiHandler(async () => {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return json({ quoteEnabled: !!settings?.quoteEnabled });
});
