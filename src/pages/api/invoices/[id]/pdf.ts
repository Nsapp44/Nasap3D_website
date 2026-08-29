import { apiHandler, jsonError } from "../../../../lib/api/handler";
import { requireAuth } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";
import { readFileByKey } from "../../../../lib/server/storage";

// Direct port of GET /invoices/:id/pdf.
export const GET = apiHandler(async (context) => {
  const user = await requireAuth(context);
  const { id } = context.params;

  const invoice = await prisma.invoice.findUnique({ where: { id } });
  if (!invoice || invoice.userId !== user.id) return jsonError(404, "not_found");

  const pdf = await readFileByKey(invoice.pdfKey);
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.ref}.pdf"`,
    },
  });
});
