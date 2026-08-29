import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { requireAdmin } from "../../../lib/api/auth";
import { prisma } from "../../../lib/server/prisma";

// Direct port of GET /admin/settings.
export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return json({ settings });
});

const schema = z.object({
  quoteEnabled: z.boolean().optional(),
  hourlyRateCents: z.number().int().positive().optional(),
  minUnitPriceCents: z.number().int().min(0).optional(),
  minOrderCents: z.number().int().min(0).optional(),
  smallOrderFeeCents: z.number().int().min(0).optional(),
  dailyOrderLimit: z.number().int().min(0).optional(),
});

// Direct port of PATCH /admin/settings.
export const PATCH = apiHandler(async (context) => {
  await requireAdmin(context);
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  const updated = await prisma.settings.update({ where: { id: 1 }, data: body.data });
  return json({ settings: updated });
});
