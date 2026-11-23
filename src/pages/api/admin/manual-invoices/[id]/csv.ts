import { apiHandler, jsonError } from "../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../lib/api/auth";
import { prisma } from "../../../../../lib/server/prisma";

// Export CSV d'une facture au format d'import "Livre des recettes" d'Abby.
// Format vérifié sur aide.abby.fr : l'import Livre des recettes n'accepte que
// des factures soldées ; date de paiement et moyen de paiement sont
// obligatoires côté Abby : la date de paiement vient de paidAt (facture cochée
// « payée », sinon 409) ; le moyen de paiement reste VIDE, à compléter avant import.
// Encodage attendu du modèle Abby non vérifié (ici UTF-8 avec BOM).

const HEADER = 'Client,Référence (numéro),Date de paiement,Moyen de paiement,Montant HT,Taux de TVA,Montant TTC,"Type de vente (1,2,3,4)"';

// Neutralise l'injection de formule tableur, puis met entre guillemets si besoin.
function cell(v: string): string {
  let t = v;
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

function fmtDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const inv = await prisma.manualInvoice.findUnique({
    where: { id },
    select: { ref: true, clientName: true, totalCents: true, paidAt: true },
  });
  if (!inv) return jsonError(404, "not_found");
  // Abby n'importe que des factures soldées : pas de CSV si non payée.
  if (!inv.paidAt) return jsonError(409, "not_paid");

  const amount = (inv.totalCents / 100).toFixed(2);
  // TVA non applicable (art. 293 B) : TTC = HT. Type de vente 3.
  const row = [cell(inv.clientName), cell(inv.ref), fmtDate(inv.paidAt), "", amount, "0", amount, "3"].join(",");
  const body = "\uFEFF" + HEADER + "\r\n" + row + "\r\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${inv.ref}_abby.csv"`,
    },
  });
});
