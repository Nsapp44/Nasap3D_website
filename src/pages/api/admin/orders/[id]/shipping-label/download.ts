import { apiHandler, jsonError } from "../../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../../lib/api/auth";
import { prisma } from "../../../../../../lib/server/prisma";
import { fetchLabelDocument, BoxtalConfigError, BoxtalApiError } from "../../../../../../lib/server/boxtal";

// Direct port of GET /admin/orders/:id/shipping-label/download — proxies
// the actual PDF bytes instead of handing the admin's browser Boxtal's raw
// label URL directly — that URL needs the same account auth as every
// other v1 call, which a plain browser tab obviously doesn't have.
export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return jsonError(404, "not_found");
  if (!order.shippingLabelUrl) return jsonError(409, "label_not_available");

  try {
    const { contentType, buffer } = await fetchLabelDocument(order.shippingLabelUrl);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${order.ref}-etiquette.pdf"`,
      },
    });
  } catch (err) {
    if (err instanceof BoxtalConfigError) return jsonError(500, "boxtal_not_configured");
    if (err instanceof BoxtalApiError) {
      console.error("boxtal label document fetch failed", err);
      return jsonError(502, "boxtal_document_failed");
    }
    throw err;
  }
});
