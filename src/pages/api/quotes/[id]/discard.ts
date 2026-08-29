import { apiHandler } from "../../../../lib/api/handler";
import { getSessionUser } from "../../../../lib/api/auth";
import { getGuestSessionId } from "../../../../lib/api/cookies";
import { prisma } from "../../../../lib/server/prisma";
import { deleteQuoteJobFileIfOrphaned } from "../../../../lib/server/quoteCleanup";

// Direct port of POST /quotes/:id/discard — best-effort immediate cleanup:
// the configurator calls this via navigator.sendBeacon when the tab
// closes/navigates away with an analyzed quote that was never added to the
// cart — no response is ever read by a beacon, so this always replies 204
// regardless of outcome. deleteQuoteJobFileIfOrphaned already no-ops if the
// quote is still in a cart or was ordered, so even a stray/late call here
// can't delete a file still in use. Not the only cleanup path — the
// periodic sweep (src/middleware.ts) is the reliable backstop for whatever
// this misses (network drop, browser not firing the beacon, cookies not
// sent cross-site, ...).
export const POST = apiHandler(async (context) => {
  const { id } = context.params;
  const quoteJob = await prisma.quoteJob.findUnique({ where: { id } });
  if (quoteJob) {
    const user = await getSessionUser(context);
    const sessionId = getGuestSessionId(context.cookies);
    const owns = (user && quoteJob.userId === user.id) || (!user && sessionId && quoteJob.sessionId === sessionId);
    if (owns) await deleteQuoteJobFileIfOrphaned(id!);
  }
  return new Response(null, { status: 204 });
});
