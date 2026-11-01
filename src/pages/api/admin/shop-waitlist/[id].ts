import { apiHandler, json } from "../../../../lib/api/handler";
import { requireAdmin } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";

export const DELETE = apiHandler(async (context) => {
  await requireAdmin(context);
  await prisma.shopWaitlist.deleteMany({ where: { id: context.params.id } });
  return json({ ok: true });
});
