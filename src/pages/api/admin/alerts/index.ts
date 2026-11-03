import { apiHandler, json } from "../../../../lib/api/handler";
import { requireAdmin } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";
import { deriveAlerts, sortAlerts, storedAlertToDTO, type AlertDTO } from "../../../../lib/server/adminAlerts";
import { boxtalConfigMissing } from "../../../../lib/server/boxtal";

export const ALERTS_LIMIT = 50;

// Centre d'erreurs admin : alertes dérivées (état des commandes, stock cartons, config Boxtal)
// + alertes enregistrées non résolues. Triées (critiques d'abord, plus récentes ensuite), 50 max.
export const GET = apiHandler(async (context) => {
  await requireAdmin(context);

  const [orders, boxStock, stored] = await Promise.all([
    prisma.order.findMany({
      where: { status: { in: ["EXPERTISE", "AWAITING_PAYMENT", "PENDING", "PRINTING", "READY"] } },
      include: { invoice: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.shippingBoxStock.findMany(),
    prisma.adminAlert.findMany({
      where: { resolvedAt: null },
      orderBy: { lastSeenAt: "desc" },
      take: ALERTS_LIMIT,
    }),
  ]);

  const derived: AlertDTO[] = deriveAlerts(orders, boxStock, boxtalConfigMissing()).map((a) => ({ ...a, id: a.id ?? a.key }));
  const all = sortAlerts([...derived, ...stored.map(storedAlertToDTO)]).slice(0, ALERTS_LIMIT);
  return json({ alerts: all });
});
