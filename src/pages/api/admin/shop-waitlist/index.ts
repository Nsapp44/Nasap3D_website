import { apiHandler, json } from "../../../../lib/api/handler";
import { requireAdmin } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";

export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const entries = await prisma.shopWaitlist.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, createdAt: true },
  });
  return json({ count: entries.length, entries });
});
