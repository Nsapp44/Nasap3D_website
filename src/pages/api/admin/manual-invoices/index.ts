import { apiHandler, json, jsonError } from "../../../../lib/api/handler";
import { requireAdmin } from "../../../../lib/api/auth";
import { prisma } from "../../../../lib/server/prisma";
import { nextCounter } from "../../../../lib/server/counter";
import { validateManualInvoiceBody } from "../../../../lib/server/manual-invoice-validate";

// "Factures libres" : factures créées depuis l'admin sans commande. Une fois
// non envoyée, une facture peut être modifiée (PUT, qui remet pdfKey à null :
// le client regénère le PDF et le redépose via POST pdf) ou supprimée
// (DELETE). Une fois envoyée (sentAt), elle est verrouillée côté serveur.

export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const rows = await prisma.manualInvoice.findMany({
    orderBy: { issuedAt: "desc" },
    select: { id: true, ref: true, clientName: true, clientEmail: true, totalCents: true, issuedAt: true, sentAt: true, paidAt: true, downloadedAt: true, pdfKey: true },
  });
  return json(
    rows.map((r) => ({
      id: r.id,
      ref: r.ref,
      clientName: r.clientName,
      clientEmail: r.clientEmail,
      totalCents: r.totalCents,
      issuedAt: r.issuedAt,
      sentAt: r.sentAt,
      paidAt: r.paidAt,
      downloadedAt: r.downloadedAt,
      hasPdf: !!r.pdfKey,
    })),
  );
});

export const POST = apiHandler(async (context) => {
  await requireAdmin(context);
  const body = (await context.request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return jsonError(400, "invalid_body");

  const v = validateManualInvoiceBody(body);
  if (!v.ok) return jsonError(400, v.error);
  const { clientName, billingAddress, deliveryAddress, clientEmail, note, items, totalCents, paid } = v.data;

  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const dd = String(now.getDate()).padStart(2, "0");
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const yyyy = now.getFullYear();

  // Même compteur journalier que les factures de commande ("invoice:"), dans
  // une transaction : si le create échoue, le numéro n'est pas consommé.
  const created = await prisma.$transaction(async (tx) => {
    const dailySeq = await nextCounter("invoice:" + dateKey, tx);
    const ref = `FAC_${String(dailySeq).padStart(3, "0")}_${dd}${mm}${yyyy}_L`;
    return tx.manualInvoice.create({
      data: {
        ref,
        dailySeq,
        clientName,
        billingAddress,
        deliveryAddress,
        clientEmail,
        items,
        note,
        totalCents,
        issuedAt: now,
        paidAt: paid ? now : null,
      },
    });
  });

  return json(
    {
      id: created.id,
      ref: created.ref,
      issuedAt: created.issuedAt,
      totalCents: created.totalCents,
      dailySeq: created.dailySeq,
      clientName: created.clientName,
      billingAddress: created.billingAddress,
      deliveryAddress: created.deliveryAddress,
      clientEmail: created.clientEmail,
      items,
      note: created.note,
    },
    { status: 201 },
  );
});
