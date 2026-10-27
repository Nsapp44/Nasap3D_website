import { z } from "zod";
import { apiHandler, json, jsonError } from "../../../lib/api/handler";
import { getSessionUser } from "../../../lib/api/auth";
import { getOrCreateGuestSessionId } from "../../../lib/api/cookies";
import { identityFor } from "../../../lib/api/identity";
import { prisma } from "../../../lib/server/prisma";
import { getCartSummary, getCartPieces } from "../../../lib/server/cart";
import { packPieces, parcelsRelayOk, parcelsLockerOk } from "../../../lib/server/packing";
import { enforceRateLimit, clientIp } from "../../../lib/api/rateLimit";

// Direct port of GET /cart — no rate limit, matches the original (every
// other cart route has one).
export const GET = apiHandler(async (context) => {
  const identity = await identityFor(context);
  const summary = await getCartSummary(identity);
  // Pièce trop grande pour tous nos cartons : le panier grise « Expédition »
  // (seul le retrait atelier reste possible). null = tout rentre.
  const packed = packPieces(await getCartPieces(identity));
  return json({
    ...summary,
    tooBigPiece: packed.ok ? null : packed.piece,
    // Nombre de colis prévus (expédition) : le panier prévient le client au-delà d'un colis.
    parcelCount: packed.ok ? packed.parcels.length : 0,
    // Point Relais : S/M/L/XL ; Colissimo seul dès un XXL.
    relayOk: packed.ok ? parcelsRelayOk(packed.parcels) : false,
    // Locker : S/M/L seulement (pas de XL ni XXL).
    lockerOk: packed.ok ? parcelsLockerOk(packed.parcels) : false,
  });
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
