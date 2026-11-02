# SUIVI : état courant (02/11/2026) — conversation « NASAP [maintenance] suites post-push 01/11 »

Index des archives (texte d'origine intact) : SUIVI du 01/11 complet (maquettes 360° : matières, commandes de rendu, retrait d'une maquette ; « ce qui n'a pas marché » reflets plexi ; ancien prochain pas) → `docs/SUIVI_archive_2026-11-02.md` ; avant : `docs/SUIVI_archive_2026-10-29.md`, `-10-27`, `-10-25`. Multi-colis → `docs/chantiers/multi-colis_2026-10-29.md` ; SEO national → `docs/chantiers/seo-national-*.md` ; demandes 45-55 → `docs/chantiers/file-demandes-45-55_2026-11-01.md`. Note dev (DNS shop, Caddy, IP réelle, webhook Stripe) → `docs/note_dev_shop_caddy_ip_2026-11-02.md`.

## État global
01/11/2026 : 61 commits poussés sur origin/master (5149161) avec l'accord de Nolann ; le site en ligne = 5149161. Branche de travail : `claude/nasap3d-maintenance-549920` (worktree `seo-conversion-suite-fe4650`). Commits locaux libres (git add par fichier), **push seulement sur « oui » explicite** (push master = redéploiement). Ne jamais commiter `astro.dev.tmp.mjs` ni `.claude/launch.json`.
Commits locaux non poussés (après 5149161) : 13efe2c note dev + SUIVI, 4a75368 M5 IP réelle, d903be3 M3 session Stripe réutilisée.
Architecture : un seul conteneur Astro (front + API) ; Caddy et DNS sur le serveur OVH, hors dépôt, faits à la main par le dev (Florian) → on écrit une note dans `docs/`, on ne les modifie pas.

## File des demandes (conversation maintenance)
1. [x] Mémoire `project_architecture_astro_caddy.md`.
2. [ ] Suites sécurité : M5 [x] 4a75368 ; M3 [x] d903be3 ; **B1** (webhook atomique) et **M4** (panier consommé dans la transaction) : executants en cours (fichiers `webhooks/stripe.ts`, `orderEmails.ts`, `stripePayment.ts` neuf, `orders.ts`, `api/checkout.ts`, tests `stripe-payment` / `order-from-cart`) → relire diff, commit local chacun. Puis lots « quotes », « admin », messages front (ci-dessous), puis testeur vitest + build.
3. [x] Note dev (13efe2c) + section 4 webhook Stripe ajoutée (à commiter).
4. [ ] Restes : 38 (fresque + Bambu H2C/X2D/X1C), 39 (À propos SEO, proposition à valider), 43 (menu Guides 375 px, décision « Europe »), 51 (passe SEO : peut être couverte par la session SEO) ; tester l'onglet admin « Liste shop » et « M'envoyer un test » ; nettoyer N3D-2001..2009 (annoncer avant).
57. [x] Renommer la conversation. 58. [x] Sitemap / indexation (Google : demander l'indexation par URL ; Bing : `node scripts/indexnow.mjs`).
59. [ ] Analyse Search Console + Bing → session [NASAP [SEO] Search Console, Bing, clics accueil/Nantes] `local_60b2274e-30eb-4a76-8d5b-bec7033b5594` (branche `claude/elated-yonath-f6ddff`) : en cours, relayer son rapport.

## Lots de correctifs restants (relecture securite-web du 02/11)
- **Lot « quotes »** (un executant ; `threeMfParse.ts` + `api/quotes/index.ts`) : HAUT zip bomb `inflateRawSync(compressed)` l.149 sans plafond (devis anonyme → plantage) → `maxOutputLength` 200 Mo + plafond de taille déclarée ; fichier temporaire `path.join(dir, fileName)` l.211 = nom client (traversée) → `"upload"+ext` (vérifier que parseurs/slicer n'ont pas besoin du nom) ; `infillPct` non borné l.175 → 0-100 ; Content-Length absent/invalide/> 150 Mo → 411/413 avant `formData()` ; option `filename*=UTF-8''` dans `quotes/[id]/file.ts`.
- **Lot « admin »** (executant séparé ; `api/admin/orders/[id]/index.ts`, `accept.ts`) : PATCH accepte `z.enum(ORDER_STATUSES)` = tous les statuts → table de transitions (EXPERTISE/AWAITING_PAYMENT/REJECTED interdits depuis PENDING+) ; email admin dans le log `force` ; DELETE en `$transaction` + purge fichiers ; accept.ts en `updateMany` atomique. **Décision Nolann (pop-up)** : bloquer DELETE des commandes payées / avec facture (factures à garder légalement) ? Impacte le nettoyage N3D-2001..2009.
- **BAS** : P2002 dans invoiceGenerator (findUnique dans le try) ; `unitPriceCents ?? 0` cart.ts l.46 ; log raison Boxtal, en-tête Authorization hors hôte Boxtal, données perso dans les logs, pagination admin.
- **Messages front** (executant-ui) : `payment_in_progress` (409 de pay.ts) dans `src/hooks/useAccount.ts:448` (aujourd'hui alerte générique) → « Votre paiement est déjà en cours de validation. Actualisez la page dans quelques minutes. » ; `cart_changed` (409 de checkout) : emplacement donné par l'agent M4.
- Rien trouvé : IDOR devis, requireAdmin, emails.

## Ce qui n'a pas marché
`astro check` plante (mémoire) : typage non vérifié, seul `npm run build` fait foi. Lecteur avait dit « PATCH admin = 4 statuts » : faux, c'est `z.enum(ORDER_STATUSES)`.

## Prochain pas exact
Attendre B1 + M4 → relire diff → commits locaux → commit note dev → passation (skill `passation`, autonome, demandée par le hook de boucle de compaction) avec les lots « quotes » / « admin » / front / BAS comme suite → testeur vitest + build → advisor avant « fini ». À dire à Nolann : cocher les événements async du webhook Stripe (note dev §4). Aucun push sans son « oui ».
