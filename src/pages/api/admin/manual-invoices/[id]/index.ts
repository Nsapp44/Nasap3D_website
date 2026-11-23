import { apiHandler, json, jsonError } from "../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../lib/api/auth";
import { prisma } from "../../../../../lib/server/prisma";
import { deleteFile } from "../../../../../lib/server/storage";
import { validateManualInvoiceBody } from "../../../../../lib/server/manual-invoice-validate";

// Une facture libre peut être modifiée ou supprimée, envoyée ou non (décision
// de Nolann 23/11 : pouvoir corriger puis re-synchroniser). sentAt est conservé
// à la modification ; le PDF est invalidé (pdfKey null) et regénéré par le client.

async function dropPdf(key: string | null | undefined) {
  if (!key) return;
  try {
    await deleteFile(key);
  } catch (err) {
    console.warn("manual-invoice: suppression du PDF impossible", key, err);
  }
}

export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const inv = await prisma.manualInvoice.findUnique({ where: { id } });
  if (!inv) return jsonError(404, "not_found");

  return json({
    id: inv.id,
    ref: inv.ref,
    issuedAt: inv.issuedAt,
    totalCents: inv.totalCents,
    dailySeq: inv.dailySeq,
    clientName: inv.clientName,
    billingAddress: inv.billingAddress,
    deliveryAddress: inv.deliveryAddress,
    clientEmail: inv.clientEmail,
    items: inv.items,
    note: inv.note,
    sentAt: inv.sentAt,
    hasPdf: !!inv.pdfKey,
  });
});

export const PUT = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const body = (await context.request.json().catch(() => null)) as unknown;
  const v = validateManualInvoiceBody(body);
  if (!v.ok) return jsonError(400, v.error);
  const d = v.data;

  const before = await prisma.manualInvoice.findUnique({ where: { id }, select: { pdfKey: true } });

  const res = await prisma.manualInvoice.updateMany({
    where: { id },
    data: {
      clientName: d.clientName,
      billingAddress: d.billingAddress,
      deliveryAddress: d.deliveryAddress,
      clientEmail: d.clientEmail,
      items: d.items,
      note: d.note,
      totalCents: d.totalCents,
      pdfKey: null,
    },
  });
  if (res.count === 0) {
    const exists = await prisma.manualInvoice.findUnique({ where: { id }, select: { id: true } });
    return exists ? jsonError(409, "already_sent") : jsonError(404, "not_found");
  }

  await dropPdf(before?.pdfKey);

  const inv = await prisma.manualInvoice.findUnique({ where: { id } });
  if (!inv) return jsonError(404, "not_found");
  return json({
    id: inv.id,
    ref: inv.ref,
    issuedAt: inv.issuedAt,
    totalCents: inv.totalCents,
    dailySeq: inv.dailySeq,
    clientName: inv.clientName,
    billingAddress: inv.billingAddress,
    deliveryAddress: inv.deliveryAddress,
    clientEmail: inv.clientEmail,
    items: d.items,
    note: inv.note,
  });
});

export const DELETE = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const before = await prisma.manualInvoice.findUnique({ where: { id }, select: { pdfKey: true } });

  const res = await prisma.manualInvoice.deleteMany({ where: { id } });
  if (res.count === 0) {
    const exists = await prisma.manualInvoice.findUnique({ where: { id }, select: { id: true } });
    return exists ? jsonError(409, "already_sent") : jsonError(404, "not_found");
  }

  await dropPdf(before?.pdfKey);
  return json({ ok: true });
});
