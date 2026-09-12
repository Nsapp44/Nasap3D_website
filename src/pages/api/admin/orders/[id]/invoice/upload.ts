import { apiHandler, json, jsonError } from "../../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../../lib/api/auth";
import { prisma } from "../../../../../../lib/server/prisma";
import { saveFile } from "../../../../../../lib/server/storage";
import { nextCounter } from "../../../../../../lib/server/counter";

const MAX_INVOICE_PDF_BYTES = 10 * 1024 * 1024;

// Manual fallback for exactly the case the admin's "Forcer → Payée" auto-
// generation (createAndAttachInvoiceForOrder, invoiceGenerator.ts) can't
// resolve on its own — a genuine bug in PDF generation, missing order data,
// or any other unexpected failure. Without this, that specific order would
// have permanently shown no invoice with no way to fix it short of a direct
// DB/storage edit — same gap "Forcer" itself was built to close for order
// status, just for the invoice PDF this time.
export const POST = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const order = await prisma.order.findUnique({ where: { id }, include: { invoice: true, user: true } });
  if (!order) return jsonError(404, "not_found");
  if (order.invoice) return jsonError(409, "invoice_already_exists");

  const form = await context.request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return jsonError(400, "missing_file");
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return jsonError(400, "invalid_file_type");
  }
  if (file.size > MAX_INVOICE_PDF_BYTES) return jsonError(413, "file_too_large");

  const pdfBuffer = Buffer.from(await file.arrayBuffer());

  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const dailySeq = await nextCounter("invoice:" + dateKey);
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const ref = `FAC_${String(dailySeq).padStart(3, "0")}_${dd}${mm}${yyyy}_${order.user.customerNo}`;

  const pdfKey = `invoices/${ref}.pdf`;
  await saveFile(pdfKey, pdfBuffer);

  console.warn(`ADMIN MANUAL INVOICE UPLOAD: order ${order.ref} — attached ${ref} (${file.size} bytes)`);

  await prisma.invoice.create({
    data: {
      ref,
      orderId: order.id,
      userId: order.user.id,
      amountCents: order.totalCents,
      pdfKey,
      dailySeq,
      issuedAt: now,
    },
  });

  return json({ ok: true, ref }, { status: 201 });
});
