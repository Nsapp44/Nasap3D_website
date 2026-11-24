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
10. [ ] Étiquettes 100×150 : bouton « Imprimer l'étiquette » restylé et poussé (4be7390), rendu non vérifié ; Nolann n'a pas d'imprimante, item en pause.
11. [~] **Factures libres (portail admin)** : FAIT, poussé 23/11. Émission, PDF, mail, ✎ modifier (même numéro, PDF regénéré), ✕ supprimer, CSV Abby.
    - Plus de verrou « envoyée » (demande Nolann) : ✎ ✕ visibles ; « Envoyée au client » grisé ; PDF/CSV toujours téléchargeables. Risque légal à rappeler : modifier/supprimer une facture envoyée, trou de numérotation (compteur journalier ne redescend pas).
    - **Case « Facture payée »** (migration `20261123180000_manual_invoice_paid`, `paidAt`) : cochée = date du jour ; liste affiche Payée/Non payée ; **CSV Abby seulement si payée** (409 `not_paid` sinon ; lien masqué) ; date de paiement JJ/MM/AAAA ; moyen de paiement VIDE (Abby l'exige, Nolann ne veut pas le saisir : question ouverte). Testé en local (API + onglet).
    - **Lot design 23/11 (poussé 23/11, 09c27e7)** : interrupteur « Payée / Non payée » (plus de texte démo) ; pastille « ✓ Téléchargée » / « ● À télécharger » (migration `20261123200000_manual_invoice_downloaded`, `downloadedAt` marqué au GET du PDF, remis à null à chaque modification) ; sous le prix : « ✉ Envoyer par mail au client » + « ↻ Resynchroniser » (regénère, redépose, télécharge). Testé en local (toggle, resync, pastille). Non testé : mode clair, mobile.
    - **Retouches design 23/11 (poussées 23/11)** : loaders dans les boutons (« Envoi en cours… », « Synchronisation… »), nouvelles icônes mail/sync, tout reste cliquable (plus de bouton grisé) : badges ✓ Téléchargée / ✓ Envoyée au client à droite de « Télécharger le PDF », bouton devient « Renvoyer par mail au client ». Testé en local (resync + loader).
    - E-mail client : facultatif sur devis et facture, JAMAIS imprimé (décision Nolann 23/11).
    - **IBAN/BIC + forme juridique 24/11** : pied des factures libres (« Règlement par virement : NASAP3D E.I. — IBAN … — BIC CEPAFRPP333 », issu du RIB) + « Micro-entrepreneur (entreprise individuelle) » sur factures libres et factures de commande (IBAN pas sur celle-ci : déjà payée par carte). Devis inchangés. PDF non regardé visuellement (tsc seul). Type de vente 3 à confirmer. Encodage du modèle Abby non vérifié.
    - NON TESTÉ : clic réel ✕, mobile, envoi e-mail réel.
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
Confirmer moyen de paiement CSV Abby et type de vente 3 ; regarder un PDF de facture réel.

## Conversations à supprimer
- `local_e6e8af89-a204-4058-bdd3-3c7b10ef3ce2` : NE PAS TOUCHER (session parente, jamais supprimer)
