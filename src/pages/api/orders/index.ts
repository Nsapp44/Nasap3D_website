import { apiHandler, json } from "../../../lib/api/handler";
import { requireAuth } from "../../../lib/api/auth";
import { prisma } from "../../../lib/server/prisma";

// Direct port of GET /orders (customer-facing — their own orders only).
export const GET = apiHandler(async (context) => {
  const user = await requireAuth(context);
  const orders = await prisma.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });
  return json({
    orders: orders.map((o) => ({
      id: o.id,
      ref: o.ref,
      status: o.status,
      totalCents: o.totalCents,
      createdAt: o.createdAt,
      shippingMode: o.shippingMode,
      trackingNumber: o.trackingNumber,
      items: o.items.map((i) => ({
        nameSnapshot: i.nameSnapshot,
        materialSnapshot: i.materialSnapshot,
        qualitySnapshot: i.qualitySnapshot,
        qty: i.qty,
      })),
    })),
  });
});
