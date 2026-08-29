import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../../lib/api/auth";
import { prisma } from "../../../../../../lib/server/prisma";

// Direct port of PATCH /admin/materials/:materialId/colors/:colorId.
export const PATCH = apiHandler(async (context) => {
  await requireAdmin(context);
  const { materialId, colorId } = context.params;

  const schema = z.object({ inStock: z.boolean() });
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  const color = await prisma.materialColor.findUnique({ where: { id: colorId } });
  if (!color || color.materialId !== materialId) return jsonError(404, "not_found");

  const updated = await prisma.materialColor.update({
    where: { id: colorId },
    data: { inStock: body.data.inStock },
  });
  return json({ color: updated });
});
