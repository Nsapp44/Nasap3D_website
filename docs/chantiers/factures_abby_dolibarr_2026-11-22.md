# Factures depuis le portail : recherche Abby / Dolibarr (22/11/2026)

Existant : `InvoicePdf.tsx`, `invoiceGenerator.ts`, `invoicePdfSubprocess.ts`, `api/admin/orders/[id]/invoice/generate.ts|upload.ts` (facture liée à une commande) ; modèle d'UI : `QuoteBuilderTab.tsx`, `QuoteDocument.tsx`, `api/admin/quote-ref.ts`.

Abby : import CSV seulement vers le Livre des recettes (factures soldées), pas d'import de facture à émettre. API (Plus, 15 €/mois HT) : Abby ré-émet SA facture (numéro et PDF Abby), pas de dépôt de notre PDF.
Dolibarr : API REST (`DOLAPIKEY`) : thirdparties, invoices + lines, validate (`force_number`), payments, `documents/upload` (PDF base64). Auto-hébergé gratuit.
E-facture : réception 01/09/2026, émission micro/PME 01/09/2027 -> stocker des données structurées par facture (Factur-X plus tard).

Architecture proposée : facture libre (sans commande) avec numérotation séquentielle propre, client/lignes/TVA figés (snapshot) ; PDF react-pdf identique au devis ; envoi par e-mail depuis le portail ; export CSV mensuel des factures payées (notre numéro) pour le Livre des recettes Abby ; connecteur Dolibarr (API + upload PDF) plus tard, une seule source de vérité. API Abby seulement si on abandonne notre PDF.
