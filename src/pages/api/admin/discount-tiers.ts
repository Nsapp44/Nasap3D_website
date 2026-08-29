import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { requireAdmin } from "../../../lib/api/auth";
import { prisma } from "../../../lib/server/prisma";

// Direct port of PUT /admin/discount-tiers — replaces the entire table.
export const PUT = apiHandler(async (context) => {
  await requireAdmin(context);

  const schema = z.array(z.object({ minQty: z.number().int().positive(), pct: z.number().min(0).max(100) }));
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  await prisma.$transaction([prisma.discountTier.deleteMany({}), prisma.discountTier.createMany({ data: body.data })]);
  const tiers = await prisma.discountTier.findMany({ orderBy: { minQty: "asc" } });
  return json({ tiers });
});
