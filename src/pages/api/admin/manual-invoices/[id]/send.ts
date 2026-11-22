import { apiHandler, json, jsonError } from "../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../lib/api/auth";
import { prisma } from "../../../../../lib/server/prisma";
import { readFileByKey } from "../../../../../lib/server/storage";
import { sendMail } from "../../../../../lib/server/mailer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const body = (await context.request.json().catch(() => null)) as { to?: unknown } | null;
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  if (!to || to.length > 254 || !EMAIL_RE.test(to)) return jsonError(400, "invalid_email");

  const inv = await prisma.manualInvoice.findUnique({ where: { id } });
  if (!inv) return jsonError(404, "not_found");
  if (!inv.pdfKey) return jsonError(409, "no_pdf");

  const pdf = await readFileByKey(inv.pdfKey);
  const amount = (inv.totalCents / 100).toFixed(2).replace(".", ",");
  const text =
    "Bonjour,\n\n" +
    `Veuillez trouver ci-joint la facture ${inv.ref} d'un montant de ${amount} €.\n\n` +
    "Cordialement,\nNasap3D";

  await sendMail(to, `Facture ${inv.ref} — Nasap3D`, text, undefined, {
    attachments: [{ filename: `${inv.ref}.pdf`, content: pdf, contentType: "application/pdf" }],
  });

  const updated = await prisma.manualInvoice.update({ where: { id: inv.id }, data: { sentAt: new Date() } });
  return json({ ok: true, sentAt: updated.sentAt });
});
