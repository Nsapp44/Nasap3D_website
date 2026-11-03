import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { requireAdmin } from "../../../lib/api/auth";
import { prisma } from "../../../lib/server/prisma";
import { BOXES } from "../../../lib/server/packing";

// Stock de cartons : correction manuelle par l admin (baisse auto au paiement, voir boxStockAuto.ts), jamais
// sous 0.
export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const rows = await prisma.shippingBoxStock.findMany();
  const qtyByCode = new Map(rows.map((r) => [r.code, r.qty]));
  return json(BOXES.map((box) => ({ ...box, qty: qtyByCode.get(box.code) ?? 0 })));
});

const schema = z.object({
  code: z.enum(BOXES.map((b) => b.code) as [string, ...string[]]),
  qty: z.number().int().min(0),
});

export const PUT = apiHandler(async (context) => {
  await requireAdmin(context);
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");
  const row = await prisma.shippingBoxStock.upsert({
    where: { code: body.data.code },
    update: { qty: body.data.qty },
    create: { code: body.data.code, qty: body.data.qty },
  });
  return json(row);
});
