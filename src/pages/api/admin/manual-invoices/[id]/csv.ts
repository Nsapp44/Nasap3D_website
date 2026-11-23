import { apiHandler, jsonError } from "../../../../../lib/api/handler";
import { requireAdmin } from "../../../../../lib/api/auth";
import { prisma } from "../../../../../lib/server/prisma";

// Export CSV d'une facture au format d'import "Livre des recettes" d'Abby.
// Format vérifié sur aide.abby.fr : l'import Livre des recettes n'accepte que
// des factures soldées ; date de paiement et moyen de paiement sont
// obligatoires côté Abby et sont laissés VIDES ici (la facture n'a pas de date
// d'encaissement) : à compléter à la main avant l'import. Encodage attendu du
// modèle Abby non vérifié (ici UTF-8 avec BOM).

const HEADER = 'Client,Référence (numéro),Date de paiement,Moyen de paiement,Montant HT,Taux de TVA,Montant TTC,"Type de vente (1,2,3,4)"';

// Neutralise l'injection de formule tableur, puis met entre guillemets si besoin.
function cell(v: string): string {
  let t = v;
  if (/^[=+\-@]/.test(t)) t = "'" + t;
  return /[",\r\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
}

export const GET = apiHandler(async (context) => {
  await requireAdmin(context);
  const { id } = context.params;

  const inv = await prisma.manualInvoice.findUnique({
    where: { id },
    select: { ref: true, clientName: true, totalCents: true },
  });
  if (!inv) return jsonError(404, "not_found");

  const amount = (inv.totalCents / 100).toFixed(2);
  // TVA non applicable (art. 293 B) : TTC = HT. Type de vente 3.
  const row = [cell(inv.clientName), cell(inv.ref), "", "", amount, "0", amount, "3"].join(",");
  const body = "\uFEFF" + HEADER + "\r\n" + row + "\r\n";

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${inv.ref}_abby.csv"`,
    },
  });
});
