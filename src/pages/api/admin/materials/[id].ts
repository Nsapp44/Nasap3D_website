import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { requireAdmin } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";

// Direct port of PATCH /admin/materials/:id.
export const PATCH = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const schema = z.object({ pricePerKgCents: z.number().int().positive() });
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) return jsonError(404, "not_found");

  const updated = await prisma.material.update({
    where: { id },
    data: { pricePerKgCents: body.data.pricePerKgCents },
  });
  return json({ material: updated });
});
