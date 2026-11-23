# SUIVI : état courant (23/11/2026, maintenance)

Archives : `docs/chantiers/SUIVI_complet_2026-11-23_avant_factures.md` (version longue du 23/11, items 10/12/13 détaillés, Dolibarr, « À vérifier en prod »), `SUIVI_complet_2026-11-22_avant_allegement.md`, `suivi-maquettes-09_avant-menage_2026-11-09.md`.

## État global
- En ligne : master poussé jusqu'à `a3699af`/`c79e2fe` (maquette, maintenance, Boxtal MR, PETG, machines). Prod en `migrate deploy` au démarrage (docker-entrypoint.sh).
- **Master LOCAL du dépôt principal diverge d'origin/master** : ne JAMAIS pousser tel quel ; seulement des cherry-picks depuis `origin/master`, sur « oui » de Nolann.
- Ne pas commiter : `src/pages/shop.astro`, `planches-maquettes-08/`, `retours-n2_cartes-chiffres.png`, `public/storyboard/cellule/preview-onde.html`, `SUIVI.avant-ff-2026-10-28.md`, `reseaux-sociaux/*`, `.claude/launch.json`.
- Règle modèle : Sonnet 90 %. Aucun push sans « oui ».

## File des demandes
4. [ ] Perf téléphone des vues 3D (CLS mobile 0,146 `/`, 0,174 bioréacteur ; saccadé au scroll lent).
5. [ ] Réindexation Search Console : par Nolann (`/`, `/machines`, `/realisations`, `/maquettiste-nantes`, 5 pages réalisations + sitemap).
10. [ ] Étiquettes 100×150 : bouton « Imprimer l'étiquette » fait en local, non poussé, non testé ; Nolann n'a pas d'imprimante, item en pause.
11. [~] **Factures libres (portail admin)**. Commité local `aaacc34` (émission, PDF, envoi mail). **Lot « demandes 23/11 » FAIT en local, NON COMMITÉ** (en attente du « oui » de Nolann) :
    - (a) e-mail client facultatif sur le DEVIS (`QuoteBuilderTab.tsx`) : validé, gardé dans l'état seulement (devis 100 % côté client, `QuoteDocument` inchangé, e-mail NON imprimé sur le PDF : choix à Nolann).
    - (b)(h) ✎ modifier (même numéro, PDF regénéré) + ✕ supprimer (pop-up, PDF stocké supprimé) : routes `src/pages/api/admin/manual-invoices/[id]/index.ts` (GET/PUT/DELETE), helper `src/lib/server/manual-invoice-validate.ts`. **CHANGÉ 23/11 sur demande de Nolann : plus de verrou « envoyée »** : ✎ et ✕ visibles même si envoyée (il avait une facture envoyée sans pouvoir la corriger) ; « Envoyée au client » affiché grisé (plus de bouton Envoyer), PDF + CSV toujours téléchargeables ; `sentAt` conservé à la modification, PDF regénéré/retéléchargé. Risque légal à rappeler : modifier/supprimer une facture déjà envoyée (numérotation, avoir). Les branches 409 du composant sont mortes mais inoffensives. `tsc` 0 erreur ; Retesté navigateur 23/11 : facture envoyée → ✎ ✕ « Envoyée au client » grisé visibles ; ✎ puis « Enregistrer les modifications » : même numéro, `sentAt` gardé, PDF regénéré (`hasPdf` true). Clic réel ✕ (pop-up) non testé.
    - (c) export CSV Abby : `[id]/csv.ts` ; en-tête exact du modèle Abby (aide.abby.fr 8957481), BOM, `\r\n`, anti-injection de formule. **Date de paiement et moyen de paiement laissés VIDES** (absents du modèle de données ; Abby les exige, import des factures SOLDÉES seulement) ; TVA 0 (art. 293 B), type de vente 3 par défaut. Encodage du modèle Abby non vérifié.
    - (d) aucun lien commandes/comptes. (g) section « Factures émises (non synchronisées) ». (i) « Envoyer par mail » visible par ligne. (e) expéditeur du mail = `MAIL_FROM` (défaut `Nasap3D <no-reply@nasap3d.com>`).
    - Test navigateur 23/11 : onglet Factures OK (liste, ✎ ✕ Envoyer, export CSV ; facture envoyée = sans ✎/✕, libellé « Envoyée au client »). `tsc --noEmit` 0 erreur. NON FAIT : clic réel ✎/✕ dans l'UI, test visuel mobile des nouvelles lignes, PDF devis comparé visuellement (fichier non modifié), envoi e-mail réel (adresse de Nolann seulement, demander par pop-up).
    - Questions à Nolann : date/moyen de paiement du CSV, type de vente 3 OK ?, e-mail imprimé sur le devis ?, trou de numérotation si une facture est supprimée (FAC_002 supprimée, FAC_003 gardée : risque légal, à rappeler). IBAN/mode de règlement et forme juridique de l'émetteur à fournir.
    - Données de test : base LOCALE seulement (facture FAC_001 marquée envoyée à la main, compte admin de test).
12. [~] Déplacement vers `Desktop\Projet\Nasap3D website` partiel (dépôt, `.git`, worktree faits ; restent `reseaux-sociaux`, 2 worktrees d'autres sessions, dossiers annexes). Rien supprimé sans accord.
13. [ ] SEO : audit fait (`docs/chantiers/seo_audit_2026-11-22.md`). Décision 22/11 : cible TOUTE LA FRANCE ; pages `/maquette-industrielle` + « maquette impression 3D sur mesure », `/maquettiste-nantes` en local. Rien codé.
14. [ ] French Fab : erreur à l'inscription, capture à demander à Nolann.

## Idée en attente : Dolibarr + facture électronique (pas avant jan-fév 2027)
Détail dans l'archive 23/11 : Abby API/export = offre Plus 15 €/mois ; tiers Dolibarr par CSV, pas de migration des anciennes factures ; réception e-factures obligatoire 01/09/2026, émission 01/09/2027.

## Questions en attente (pop-up au retour)
LED purification/caravane ; KPI hero ; 4 textes BROUILLON caravane ; incident base locale 5432 (seed relancé, comparer avec `backups/`).

## Ce qui n'a pas marché
Navigateur intégré peu fiable pour scroll/rAF (→ Chrome headless). Boxtal bac à sable : `order_status` 404 juste après achat. Login `fetch` depuis un onglet sans page chargée : « Failed to fetch » (naviguer d'abord sur /admin). Le serveur dev du worktree : `preview_start nasap3d-worktree-b2b` (port 3000).

## Prochain pas exact
Pop-up à Nolann « je committe le lot factures ? » (fichiers : `src/lib/api-client.ts`, `manual-invoice-validate.ts`, `manual-invoices/index.ts`, `[id]/index.ts`, `[id]/csv.ts`, `[id]/pdf.ts`, `InvoiceBuilderTab.tsx`, `QuoteBuilderTab.tsx`, `SUIVI.md`, archive docs) ; puis clic réel ✎/✕ dans l'UI. Arrêter le serveur dev en fin de test.

## Conversations à supprimer
- `local_e6e8af89-a204-4058-bdd3-3c7b10ef3ce2` : NE PAS TOUCHER (session parente, jamais supprimer)
