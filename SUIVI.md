# SUIVI : état courant (27/10/2026)

Archives (maquettes 3D, Protection 3D, shop, passation 25/10) : `docs/SUIVI_archive_2026-10-25.md`.

## CHANTIER : SEO national + conversion /devis-instantane
Branche de travail : `claude/seo-conversion-suite-fe4650` (partie de `claude/seo-conversion-de1652` @ 414ee31, 27/10) ; à l'origine partie de master 614f30d. Brief : `reseaux-sociaux/docs/brief_opus_seo_site.md` (dépôt principal). Coordination shop : `Nasap3D website/SEO-COMMUN.md` (hors dépôt, n'éditer que la section « Session SEO site »).
Règles : **commits LOCAUX autorisés sur cette branche (oui de Nolann 26/10), JAMAIS de push sans son oui** ; URLs, JSON-LD, ads intacts. Fin = Docker local, tout vérifié, Nolann teste, push seulement quand on est sûrs.
Maquette validée (26/10) : https://claude.ai/artifact/P3GfWv2y1AFENNK3JTyvDF (source : `N\maquette-seo.html`, ne pas modifier). Galerie côte à côte : https://claude.ai/artifact/EC6H2W9afGKFUNJCdTpqHD (source `N\galerie\index.html` ; republier avec `url` = ce lien après `Artifact read`).
**N** = dossier durable hors dépôt : `C:\Users\Nolann\AppData\Roaming\Claude\side-session-notes\local_fd5f6327-4589-40c3-8f1d-ce3eb0044621`.
**Modèle : la suite se fait en Sonnet medium** (Nolann 27/10 : le code ne se fait pas en Opus).

### Décisions en vigueur
- Accueil variante B (h1 « Impression 3D à Nantes »), title Nantes inchangé ; /impression-3d-en-ligne = page nationale. 5,0 sur 54 avis.
- En-tête IDENTIQUE à avant, seul ajout « Guides » (menu déroulant) avant Contact ; burger jusqu'à 1060 px (27/10). Tout autre écart d'en-tête = décision de Nolann.
- og:image = real-17 1200×630 ; la remplacer par sa grande maquette **seulement quand il confirme l'accord de son client**.
- **Devis : zone de dépôt, options et design du configurateur INCHANGÉS.** Ajouts seulement (cartes exemples, « Pas de fichier STL ? », erreur panier étape 4, Plausible, textes).
- **Phrase A** : « Aucun paiement à la commande. Expertise et validation de votre pièce en amont. » Jamais « humain » ni « sans IA ».
- Prix via `getPublicPricing()`, jamais en dur ; « remise dès 5 pièces » sans % ; jamais de €/kg. **Site en TTC** ; factures, PDF devis, panier GARDENT « TVA non applicable, art. 293 B du CGI ».
- Typo FR : `fr()` (`src/lib/typo.ts`) sur le HTML visible seulement, jamais JSON-LD/meta/title. `text-wrap` par page/composant, **pas de règle globale** (toucherait configurateur et reparer).
- Ne pas toucher : fichiers du shop (cgu, maquette-impression-3d, OrdersTab/OrderCard/Dashboard, api/orders/[id], lib/server/orders, middleware, session), reparer-piece-3d.astro, conteneurs `refontenasap3d-*` (sauf migration locale validée, item 19). Pas de « Boutique » ni d'URL shop au sitemap.

### File des demandes
1-6, 17, 21. [x] État des lieux, maquette, accueil, guides, menu/pied Guides, sitemap, og:image, 8,90 € alignés, écarts revus (commits plus bas).
4. [~] Devis — tunnel testé jusqu'à « analyse » ; panier bloqué par la base locale (item 19).
7/20. [ ] **Pages villes enrichies DANS ce chantier** : texte unique par ville, rien d'inventé ; Angers d'abord, capture à Nolann, puis les autres.
8. [~] Plausible : restent « prix affiché », « ajout panier », « erreur panier » (après item 19).
9b. [ ] Passer devant Tech3D/Abeille (demande Nolann 27/10) : guides utiles (10-15 de plus, qualité, jamais en lot), pages villes uniques, fiche 3Dnatives (inscription + contenu), French Tech/CCI Nantes (à vérifier : conditions), Google Business Profile + avis Google, avis visibles sur le site. Voir docs/concurrents_tech3d_abeille3d_2026-10-27.md.
9. [ ] Bing (Webmaster Tools, IndexNow, Places).
10. [~] Fin : Docker complet, Nolann teste, push sur son oui.
11-16. [ ] Après ce chantier : machines/REAL_MAX/real-17 ; hors site ; réponses Ads ; SEO /maquette-impression-3d ; campagne Ads maquettes (aucune dépense sans OK) ; og:image → sa maquette sur confirmation.
18. [x] Burger ≤ 1060 px (global.css:316, Header.astro ~337, HomeHeader.tsx:268) — commité (8e83dff), **non construit, non vérifié**.
19. [ ] Migration locale OK (27/10) : `npx prisma migrate deploy` sur `refontenasap3d-db-1` SEULEMENT (vérifier DATABASE_URL = localhost:5432/nasap3d), puis tunnel → panier + Plausible.
22. [~] **Contrôle visuel complet** (Nolann : « plein de trucs chelou », texte mal aligné). Corrections faites, **NON construites, NON vérifiées** :
   - E1 : burger, lignes Guides alignées sur les autres liens (Header.astro ~435, HomeHeader.tsx:286).
   - E2 : accueil (boutons héros en colonne ≤ 480, `.advice-banner` en colonne ≤ 640, `.about-text` centré ≤ 900, text-wrap, typo FR) + pied `white-space:nowrap` sur villes/guides.
   - E4 : `typo.ts` + `fr()` dans GuideFaq/Cta/Hero/Section/Table ; GuideTable : « Faites défiler le tableau → » + dégradé bord droit ≤ 640.
   - E5 (en cours à l'écriture) : typo + badges devis-instantane, services, ServicesGrid, particuliers, en-ligne, materiaux, prix.
   - lecteur (fini) : constats restants dans **`docs/controle_visuel_2026-10-27.md`** (composants du chantier à corriger ; pied de page, machines, réalisations = décision de Nolann).
   - Constat machines@375 : `@media (max-width:420px)` (index.astro, fin du `<style>`) force 1 colonne ; à vérifier en capture, ne rien changer sans raison.
23. [~] Capture ville avec menu ouvert : cause = survol souris de la capture précédente → corriger `capture.mjs`.
24. [~] **Exemple de prix** (Nolann : « fait peur », « ultra chère », l'ancien 31,76 € venait d'un cube PETG fin 60 %) → **chiffre CHOISI (pop-up 27/10) : cube 50 mm PETG, Standard 0,20 mm, 40 % = 14,10 €** (vrai moteur, détail `docs/prix_exemple_2026-10-27.md`). Reste : vérifier le moteur qui facture, montrer la formulation des frais 5 € sous 18 €, puis remplacer (Prochain pas 5).
25. [x] Retour envoyé à « Tests BO et jauge OpenAI » (27/10, confirmé par pop-up).
26. [ ] **Design existant, validé par pop-up 27/10** : (a) pied de page : TOUT centré (lignes 1-3) ; (b) page machines : photos même hauteur, « autres machines » mieux réparties, textes 9,5 px agrandis ; (c) bouton burger 44 px + lien actif réaligné (décalé 3 px). **Refusé : pied 12 px / contraste / gouttières** (ne pas faire).
27. [~] **Demande Nolann 27/10 soir** : (a) tout préparer pour qu'il valide la version locale ce soir (aperçu 4455) ; (b) plan d'attaque « French fab » (à clarifier : French Tech Nantes ou label French Fab) + 3Dnatives (il pense avoir déjà un accès, « rien de spécial », on regarde ensemble) ; (c) Ads maquettage DIFFÉRENTES de celles en place (aucune dépense sans OK, `/maquette-impression-3d` = page du shop, feu vert requis pour y toucher). FAIT 27/10 : plan 3Dnatives/French Fab/GBP écrit (`docs/plan_3dnatives_frenchtech_2026-10-27.md`) ; Search Console : Chrome connecté en nono.gimmy@gmail.com = PAS d'accès à nasap3d.com (autre compte à utiliser). French Tech Nantes jugé peu adapté. Pages villes : jamais interchangeables (Nantes ciblée, Angers/Cholet seulement avec contenu réel). FAIT aussi : page Nantes enrichie (slot dans LocalSeoLayout, sections étapes/retrait/ce qu'on imprime, 3 FAQ ajoutées ; Angers/Cholet inchangées), build + aperçu 4455 + captures 375/768/1280 OK ; `docs/ads_maquettage_2026-10-27.md` écrit (aucune dépense). Reste : validation locale de Nolann ce soir, tunnel STL → panier + Plausible, push sur son oui. Ordre : (a) puis plan écrit `docs/plan_3dnatives_frenchtech_2026-10-27.md` puis `docs/ads_maquettage_2026-10-27.md`.

28. [~] **Nolann 27/10 soir** : relancer le local (FAIT : Docker db/api OK, aperçu 4455 relancé, 200) ; Search Console accessible (compte u/2, `sc-domain:nasap3d.com`) : 28 j = 55 clics, 2,43 k impressions, position moy. 12 ; « impression 3d nantes » 8 clics / 253 impr. ; 15 pages indexées, 17 non (à examiner) ; « imprimante 3d » 529 impr. 0 clic, « service impression 3d » 109 impr. 0 clic. Reste : test STL jusqu'au panier + Plausible, titre accueil (proposé : « Impression 3D sur mesure — Devis instantané en ligne | Atelier à Nantes », en attente de son oui), pages non indexées, passation (nouvelle conversation Sonnet medium).

29. [x] **Accueil, texte SEO + contact (27/10, retour Nolann : mal aligné)** : skills web-design-guidelines / design-critique / ux-copy passés. Texte SEO passé sur 2 colonnes alignées sur la grille du contact (avant : colonne étroite à gauche, 40 % vide) ; contact : vrai titre h2 « Contacter l'atelier à Nantes » + sous-titre (avant : petit label rouge « CONTACT ET ATELIER À NANTES (CANCLAUX) » collé au formulaire), téléphone et email cliquables, texte 14 px. Captures 1280 et 375 OK, aucun scroll horizontal. Même passe à faire sur les autres pages (à demander).

### Questions à poser (pop-up)
Plus tard : slogan anglais, ancre « devis instantané impression 3D », PriceBadge Angers/Cholet, réalisations sans majuscule.

### État technique
- Commits locaux (rien de poussé) : 3fec742, 9e98e98, d43a030, 902fb2f, f3f3c83, 706a322, 1aeeb76, 192d86a, 8e83dff (WIP E1-E5 + burger, non construit), 19442dc + commit de passation.
- **Nouveau worktree à préparer** (ignorés par git, jamais commités) : jonction `node_modules` vers le dépôt principal, copie de `.env` du dépôt principal, `.claude/launch.json` recopié depuis `N\launch.json.modele` (« nasap-seo-build », `server-entry.mjs` port 4455).
- Aperçu = dist construit servi par `server-entry.mjs` port 4455. Après chaque modif : `npx astro build` (arrière-plan) puis relancer l'aperçu.
- Outils de capture : `N\outils-captures\` (`capture.mjs` Chrome headless CDP port 9333, `--all` → dossier de sortie ; `liens.mjs` liens internes, 67/67 en 200 le 27/10 ; `verify.mjs`, `gen.mjs` = galerie). Chemins internes à adapter (ils visaient l'ancien scratchpad). CDP suffit (Nolann OK 27/10).
- **Captures « avant »** (avant E1-E5 et item 26, 157 fichiers) : `N\captures-avant\` (+ `report.md`). Les captures « après » vont dans le scratchpad de la session.
- Port 4400 = autre session (PID 5384) : ne pas toucher.

### Ce qui n'a pas marché et pourquoi
- `astro check` : manque de mémoire (exit 134) même à 8 Go → piste tsconfig include/exclude.
- Dev local : hydratation React cassée via jonction node_modules (403 `@fs`) → on sert le dist construit.
- POST /api/quotes 500 (P2022, colonne `scale`) : migration 20261022120000 absente de la base locale (item 19).
- Docker Desktop plantait : sockets périmés. **À chaque redémarrage** : fermer Docker, renommer `%LOCALAPPDATA%\Docker\run` et `%LOCALAPPDATA%\docker-secrets-engine` en `.stale-*`, relancer. Jamais « Reset to factory defaults ».
- Captures : animations d'entrée = faux trous (attendre ≥ 2 s) ; menu Guides resté ouvert = survol (souris au coin + blur + attente > 300 ms avant chaque capture).
- Règle text-wrap globale abandonnée (configurateur, reparer).

### Passation 27/10 (après-midi)
- Tout est commité (WIP `8e83dff` = E1/E2/E4/E5 + burger, ni construit ni vérifié ; puis SUIVI). E5 fini ; proposé non appliqué : `fr()` à l'affichage du FaqAccordion de devis-instantane (`faqs.map(f => ({q: fr(f.q), a: fr(f.a)}))`, sans toucher la chaîne du JSON-LD).
- Prix : tout est dans `docs/prix_exemple_2026-10-27.md` (+ `N\prix-exemple\`). À vérifier avant d'écrire : le prix facturé vient-il du tranchage client (Kiri) ou serveur (`kiriSlicer.ts`, grid-apps Linux) ? Le texte ne cache pas les 5 € de frais sous 18 € : proposer la formulation à Nolann (ex. « 14,10 € la pièce ; frais de 5 € sous 18 € de commande »).
- Nolann (27/10) : je crée moi-même la nouvelle conversation et je supprime l'ancienne. L'ancienne (`local_3fc6639f-ded6-4b4a-a5be-d76929843ca4`) possède l'ancien worktree `nasap3d-social-media-folders-171abf` : la nouvelle a son PROPRE worktree, donc la suppression de l'ancienne ne touche pas au travail en cours.

### Prochain pas exact (28 : conversation `seo-conversion-suite-fe4650`)
Fait (27/10) : corrections composants guides, item 26 (pied centré, machines 4/3 + grille 3+2, burger 44 px, lien actif), prix d'exemple 23,75 € (cube 60 mm PETG, 149 g, 3 h 59 ; remplace 31,76 €) dans QuoteWizard, en-ligne, particuliers, prix, PRICING.md. Build refait, aperçu 4455 relancé, recaptures `--all` faites (69 captures : sw == cw partout, seule la 404 est signalée, menu Guides et burger OK, 68 liens internes en 200). Captures dans le scratchpad `apres\`, outils dans `outils\`.
1. [x] Page avant/après publiée (27/10) : artifact EC6H2W9afGKFUNJCdTpqHD, lien « Avant / après » dans le menu de la galerie (fichier avant-apres.html, 20 images). Reste : la présenter à Nolann avec les écarts (ExpertiseSteps 13 px/.7 partagé, badge x2 à 12 px non demandé, height machines inutilisé, fr() FAQ devis non appliqué).
2. [x] Commit local 4602079 (oui Nolann 27/10). Item 19 fait : migration appliquée sur la base locale, dist reconstruit, aperçu 4455 relancé. Reste : tunnel avec un STL de test jusqu'au panier + Plausible ; nouvelle passe maquette ; concurrents : `docs/concurrents_tech3d_abeille3d_2026-10-27.md` (pages villes = levier n°1 : Nantes/Angers uniques, GBP, avis).
3. Ensuite item 19 (migration locale `prisma migrate deploy` sur refontenasap3d-db-1 seulement), villes (item 20), Bing, push sur son oui. `resize_window` preset desktop à la fin.
Note capture : sur machines, la capture pleine page montre le menu Guides ouvert (artefact de capture ; le haut de page est fermé).
