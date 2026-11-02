import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { requireAdmin } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";

// Alertes recalculées à chaque lecture : elles disparaissent seules quand la cause est réglée.
const DERIVED_KINDS = [
  "BOXTAL_NOT_CONFIGURED",
  "ADDRESS_INCOMPLETE",
  "RELAY_MISSING",
  "BOX_STOCK_EMPTY",
  "INVOICE_MISSING",
  "WEIGHT_ONLY_QUOTE",
];

// Marque une alerte enregistrée comme traitée. `[id]` = id de la ligne OU sa clé.
// Corps accepté : { resolve: true } ou { action: "resolve" } (celui qu'envoie AlertCenter).
export const PATCH = apiHandler(async (context) => {
  const admin = await requireAdmin(context);
  const id = decodeURIComponent(context.params.id ?? "");
  const body = (await context.request.json().catch(() => null)) as { resolve?: unknown; action?: unknown } | null;
  if (!body || (body.resolve !== true && body.action !== "resolve")) return jsonError(400, "invalid_body");

  const prefix = id.split(":")[0];
  if (DERIVED_KINDS.includes(prefix)) return jsonError(400, "derived_alert_auto_resolved");

  const row = await prisma.adminAlert.findFirst({ where: { OR: [{ id }, { key: id }] } });
  if (!row) return jsonError(404, "not_found");

  const updated = await prisma.adminAlert.update({
    where: { id: row.id },
    data: { resolvedAt: new Date(), resolvedBy: admin.email ?? "admin" },
  });
  return json({ ok: true, id: updated.id });
});
