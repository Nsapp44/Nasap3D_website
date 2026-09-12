import { apiHandler, json } from "../../../lib/api/handler";
import { requireAdmin } from "../../../lib/api/auth";
import { nextCounter } from "../../../lib/server/counter";

// The devis builder itself is deliberately 100% client-side with zero
// persistence (see QuoteBuilderTab.tsx) — no prestation, price, or client
// name from a devis is ever sent to the server. This one endpoint is the
// single, narrow exception: it does nothing but atomically increment a
// day-keyed counter (the same Counter table/mechanism the real invoice
// numbering already uses) and hand back the next number, so "DEV_010_..."
// actually means the 10th devis issued that day instead of an arbitrary
// timestamp-based guess. No devis content is read or stored here — this
// route doesn't even accept a request body.
export const POST = apiHandler(async (context) => {
  await requireAdmin(context);
  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const dailySeq = await nextCounter("devis:" + dateKey);
  return json({ dailySeq });
});
