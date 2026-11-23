import { apiHandler, json, jsonError } from "../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../lib/api/auth";
import { prisma } from "../../../../../lib/server/prisma";
import { saveFile, readFileByKey } from "../../../../../lib/server/storage";

const MAX_PDF_BYTES = 10 * 1024 * 1024;

// Le PDF est généré côté navigateur (admin) puis déposé ici ; 409 si un PDF est
// déjà attaché. Modifier une facture (PUT) remet pdfKey à null :
// le client regénère alors le PDF et le redépose ici. Le GET marque downloadedAt.
export const POST = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const inv = await prisma.manualInvoice.findUnique({ where: { id } });
  if (!inv) return jsonError(404, "not_found");
  if (inv.pdfKey) return jsonError(409, "pdf_already_exists");

  const form = await context.request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError(400, "missing_file");
  if (file.size > MAX_PDF_BYTES) return jsonError(413, "file_too_large");

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length < 5 || buf.subarray(0, 4).toString("latin1") !== "%PDF") {
    return jsonError(400, "invalid_file_type");
  }

  const pdfKey = `invoices/manual/${inv.ref}.pdf`;
  await saveFile(pdfKey, buf);
  // pdfKey: null dans le where → pas d'écrasement en cas de double dépôt concurrent.
  const res = await prisma.manualInvoice.updateMany({ where: { id: inv.id, pdfKey: null }, data: { pdfKey } });
  if (res.count === 0) return jsonError(409, "pdf_already_exists");

  return json({ ok: true, ref: inv.ref }, { status: 201 });
});

export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const inv = await prisma.manualInvoice.findUnique({ where: { id } });
  if (!inv) return jsonError(404, "not_found");
  if (!inv.pdfKey) return jsonError(404, "pdf_not_found");

  const pdf = await readFileByKey(inv.pdfKey);
  if (!inv.downloadedAt) {
    await prisma.manualInvoice.update({ where: { id: inv.id }, data: { downloadedAt: new Date() } }).catch(() => {});
  }
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${inv.ref}.pdf"`,
    },
  });
});
