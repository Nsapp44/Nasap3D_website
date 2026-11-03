# SUIVI : état courant (02/11/2026) — conversation « NASAP [maintenance] suites post-push 01/11 »

Index des archives (texte d'origine intact) : SUIVI du 01/11 complet (maquettes 360° : matières, commandes de rendu, retrait d'une maquette ; « ce qui n'a pas marché » reflets plexi ; ancien prochain pas) → `docs/SUIVI_archive_2026-11-02.md` ; avant : `docs/SUIVI_archive_2026-10-29.md`, `-10-27`, `-10-25`. Multi-colis → `docs/chantiers/multi-colis_2026-10-29.md` ; SEO national → `docs/chantiers/seo-national-*.md` ; demandes 45-55 → `docs/chantiers/file-demandes-45-55_2026-11-01.md`. Note dev (DNS shop, Caddy, IP réelle, webhook Stripe) → `docs/note_dev_shop_caddy_ip_2026-11-02.md`.


## État global (02/11/2026, conversation « NASAP [maintenance] suites sécurité »)
Site en ligne = 5149161. Branche `claude/nasap3d-maintenance-suite-a237b1` (worktree `nasap3d-pipeline-test-cedca2`). Commits locaux libres (git add par fichier), **un SEUL push groupé, sur « oui » explicite de Nolann, après la session maquettage B2B**. Ne jamais commiter `astro.dev.tmp.mjs` ni `.claude/launch.json`.
Commits locaux non poussés (après 5149161) : 13efe2c note dev, 4a75368 M5 IP réelle, d903be3 M3, 1a37f1d note §4, eed15a0 B1 webhook atomique, 441e127 M4 panier, b495f5a/5b5dd23 SUIVI, ac31ca3 lot quotes, 4e42fe7 lot admin, a309488 messages front, dabfee5 alerte B1, ebe7a0f responsive « Supprimer le compte » ; + lot BAS (commit « Points BAS »). Vérifié 02/11 sur l'arbre commité : vitest 128/128, tsc 0 ; build vert (testeur, avant l'élargissement de la table admin, sans impact build).
Architecture : un seul conteneur Astro ; Caddy et DNS sur OVH, hors dépôt, faits par le dev (Florian) → note dans `docs/`.
**Avant le push** : Nolann coche les 4 événements du webhook Stripe (`docs/note_dev_shop_caddy_ip_2026-11-02.md` §4) ; les messages front sont déjà commités (a309488) et partent avec d903be3/eed15a0/441e127.

## File des demandes
1. [x] Mémoire architecture. 3. [x] Note dev. 57-58. [x]
2. [x] Suites sécurité : M5, M3, B1, M4, lot quotes, lot admin, messages front, B1 alerte, BAS (P2002 facture, prix manquant = erreur, Authorization Boxtal limité à l'hôte, log raison Boxtal, admin orders take 500 / ?limit ≤1000). **Reportés** : messages d'erreur Boxtal contenant 300-500 car. de réponse XML (choix Nolann, remonte au front admin) ; pagination front admin (>500 commandes : seules les 500 récentes). Vérifié : vitest 128/128, tsc 0, build OK.
4. [ ] Restes : 38 (fresque + Bambu H2C/X2D/X1C), 39 (À propos SEO), 43 (menu Guides 375 px, « Europe »), 51 (SEO, peut-être couvert par session SEO) ; tester onglet admin « Liste shop » + « M'envoyer un test » ; nettoyer N3D-2001..2009 : le DELETE admin bloque les commandes payées/facturées → si ces commandes sont PENDING+, nettoyage direct en base, à annoncer à Nolann avant.
59. [ ] Session SEO `local_60b2274e-30eb-4a76-8d5b-bec7033b5594` : relayer son rapport.
60. [ ] Mail d'annonce liste d'attente shop aux couleurs NASAP Shop + petite couche NASAP (`emailTemplate.ts`, `api/admin/shop-waitlist/announce.ts`, `test.ts`) ; ne pas toucher l'onglet « Liste shop ».
62. [x] FAIT (local, vitest 169, tsc 0) : baisse auto à l'expédition (READY, premier passage) dans le PATCH admin (`boxStockAuto.ts`), jamais sous 0 ; +/− manuel déjà existant ; warning 0 conservé. Cadrage d'origine : Stock cartons (cadré par Nolann 02/11) : baisse AUTOMATIQUE à la commande selon les cartons de `shippingParcels`, jamais sous 0 (reste à 0) ; correction manuelle +/− par Nolann pour les cas où la commande n'a pas été emballée selon le calcul ; warning « stock à 0 » conservé. Aujourd'hui (SHIPPING.md l.114) : stock 100 % manuel. Question ouverte : cas critique (rangement/étiquette qui échoue) → voir échange 02/11 : étiquette Boxtal à la main + devis au poids seul.
63. [~] Responsive carte « Supprimer le compte » fait (ebe7a0f, media 560 px, desktop inchangé) ; Nolann a dit « petit souci responsive ici aussi » → page à confirmer.
64. [ ] Bouton « Laisser un avis Google » (https://g.page/r/CX9gHVS07c9sEBM/review), « hyper important » : en avant dans « commande livrée » + tous les mails shop ; se fait avec 60 (`emailTemplate.ts`, `orderEmails.ts`) ; executant-ui, capture du mail, vérif du lien.
65. [~] LOTS 1-3 CODÉS ET COMMITÉS LOCAL (0858dd4, 7d1fbd2, 1f7a7e2 ; vitest 167, tsc 0, build OK) ; reste : captures 375/768/desktop (+ sombre Windows), relecture architecte, montrer à Nolann ; lot 4 (devis au poids seul à l'acceptation) bloqué sur règle de prix de Nolann ; XML Boxtal brut retiré du front admin (reco, réponse de Nolann attendue). Centre de notifications d'erreurs admin (validé Nolann 02/11) : icône point d'exclamation (Lucide, SVG propre) en haut de l'admin avec pastille de compte, panneau listant les erreurs (Boxtal étiquette refusée/non configurée, adresse ou relais manquant, statut injoignable, stock carton à 0, paiement anomalie Stripe, facture/emails non générés) en phrases claires + action (réessayer, « Étiquette faite à la main » avec n° de suivi). Inclut devis au poids seul si le rangement échoue. Conception par `architecte` (Opus) : spec + maquette HTML dans `docs/chantiers/` AVANT code ; Nolann valide, puis executant-ui.

## Décisions Nolann
DELIVERED terminal ; DELETE admin bloqué si payée/facturée/PENDING+ (`adminOrderRules.ts`) ; table PATCH : sauts autorisés entre PENDING/PRINTING/READY/DELIVERED, jamais de retour avant-paiement, `force` vers PENDING seulement depuis avant-paiement. Lot quotes : 411 si Content-Length absent (chunked refusé ; seul le front appelle la route).

## Ce qui n'a pas marché
`astro check` plante : seuls tsc + `npm run build` font foi. Un executant avait d'abord interdit les sauts PENDING→READY (casserait le menu admin) : corrigé.

## Prochain pas exact
Centre d'erreurs (65) : captures + relecture architecte + montrer à Nolann → puis 60+64 (mails), 4. Advisor : appelé avant « fini » seulement.
