import { apiHandler, jsonError } from "../../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../../lib/api/auth";
import { prisma } from "../../../../../../lib/server/prisma";
import { readFileByKey } from "../../../../../../lib/server/storage";

// Admin-scoped invoice download — mirrors /invoices/:id/pdf (which only
// lets the invoice's own customer download it, see that route) but keyed
// by order instead of invoice id (what the admin UI already has on hand)
// and gated by requireAdmin instead of ownership, so support staff can
// re-fetch a customer's invoice on request without DB access.
export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const invoice = await prisma.invoice.findUnique({ where: { orderId: id } });
  if (!invoice) return jsonError(404, "invoice_not_found");

  const pdf = await readFileByKey(invoice.pdfKey);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.ref}.pdf"`,
    },
  });
});
