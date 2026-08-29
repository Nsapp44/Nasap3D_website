import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { identityFor } from "../../../lib/api/identity";
import { prisma } from "../../../lib/server/prisma";
import { getCartSummary } from "../../../lib/server/cart";
import { deleteQuoteJobFileIfOrphaned } from "../../../lib/server/quoteCleanup";
import { enforceRateLimit, clientIp } from "../../../lib/api/rateLimit";

function owns(identity: { userId: string } | { sessionId: string }, item: { userId: string | null; sessionId: string | null }) {
  return (
    ("userId" in identity && item.userId === identity.userId) ||
    ("sessionId" in identity && item.sessionId === identity.sessionId)
  );
}

// Direct port of PATCH /cart/:id.
export const PATCH = apiHandler(async (context) => {
  enforceRateLimit(`cart:patch:${clientIp(context)}`, 60, 60_000);

  const { id } = context.params;
  const schema = z.object({ qty: z.number().int().positive().max(2000) });
  const body = schema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  const identity = await identityFor(context);
  const item = await prisma.cartItem.findUnique({ where: { id } });
  if (!item || !owns(identity, item)) return jsonError(404, "not_found");

  await prisma.cartItem.update({ where: { id }, data: { qty: body.data.qty } });
  const summary = await getCartSummary(identity);
  return json(summary);
});

// Direct port of DELETE /cart/:id.
export const DELETE = apiHandler(async (context) => {
  enforceRateLimit(`cart:delete:${clientIp(context)}`, 30, 60_000);

  const { id } = context.params;
  const identity = await identityFor(context);
  const item = await prisma.cartItem.findUnique({ where: { id } });
  if (!item || !owns(identity, item)) return jsonError(404, "not_found");

  await prisma.cartItem.delete({ where: { id } });
  await deleteQuoteJobFileIfOrphaned(item.quoteJobId);
  const summary = await getCartSummary(identity);
  return json(summary);
});
