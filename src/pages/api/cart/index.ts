import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { getSessionUser } from "../../../lib/api/auth";
import { getOrCreateGuestSessionId } from "../../../lib/api/cookies";
import { identityFor } from "../../../lib/api/identity";
import { prisma } from "../../../lib/server/prisma";
import { getCartSummary } from "../../../lib/server/cart";
import { enforceRateLimit, clientIp } from "../../../lib/api/rateLimit";

// Direct port of GET /cart — no rate limit, matches the original (every
// other cart route has one).
export const GET = apiHandler(async (context) => {
  const identity = await identityFor(context);
  const summary = await getCartSummary(identity);
  return json(summary);
});

const postSchema = z.object({ quoteJobId: z.string(), qty: z.number().int().positive().max(2000).optional() });

// Direct port of POST /cart.
export const POST = apiHandler(async (context) => {
  enforceRateLimit(`cart:post:${clientIp(context)}`, 30, 60_000);

  const body = postSchema.safeParse(await context.request.json().catch(() => null));
  if (!body.success) return jsonError(400, "invalid_body");

  const user = await getSessionUser(context);
  const sessionId = user ? null : getOrCreateGuestSessionId(context.cookies);

  const quoteJob = await prisma.quoteJob.findUnique({ where: { id: body.data.quoteJobId } });
  if (!quoteJob) return jsonError(404, "quote_not_found");
  const owns = (user && quoteJob.userId === user.id) || (!user && quoteJob.sessionId === sessionId);
  if (!owns) return jsonError(403, "forbidden");
  if (quoteJob.status !== "ANALYZED") return jsonError(409, "quote_not_ready");

  await prisma.cartItem.create({
    data: {
      userId: user?.id,
      sessionId: sessionId ?? undefined,
      quoteJobId: quoteJob.id,
      qty: body.data.qty ?? quoteJob.quantity,
    },
  });

  const identity = user ? ({ userId: user.id } as const) : ({ sessionId: sessionId! } as const);
  const summary = await getCartSummary(identity);
  return json(summary, { status: 201 });
});
