# SUIVI : état courant (27/10/2026, soir)

Archives : `docs/SUIVI_archive_2026-10-25.md`, `docs/SUIVI_archive_2026-10-27.md` (détail items 1-30, commits, outils de capture, prix d'exemple).

## CHANTIER : SEO national + conversion /devis-instantane
Branche `claude/seo-conversion-suite-fe4650`. **Commits LOCAUX autorisés sur cette branche (oui 26/10), JAMAIS de push sans son oui** (push master = redéploiement). Coordination shop : `Nasap3D website/SEO-COMMUN.md` (section « Session SEO site » seulement). **N** = `C:\Users\Nolann\AppData\Roaming\Claude\side-session-notes\local_fd5f6327-4589-40c3-8f1d-ce3eb0044621`.
Mode conseillé : **Sonnet medium** pour l'exécution (plan posé en Opus ultracode le 27/10 soir).

### Décisions en vigueur
- Objectif Nolann : clients de toute la France via le devis instantané (« comme Abeille 3D ») + projets singuliers (maquettage, rétro-conception). France d'abord, Nantes ensuite. **Jamais « livraison gratuite ».**
- Accueil : h1 « Impression 3D en France » (garder). Une seule page ville ciblée (Nantes) ; Angers/Cholet inchangées (règle Google « doorway »).
- En-tête identique à avant + « Guides » ; burger ≤ 1060 px. Correctif 27/10 : `.nav-links` gap `clamp(16px, calc((100vw - 920px) / 8), 26px)` (Header.astro ~172, HomeHeader.tsx ~239) ; 26 px dès ~1130 px, donc 1280/1440 inchangés ; burger garde `gap:0`.
- Phrase A : « Aucun paiement à la commande. Expertise et validation de votre pièce en amont. » Jamais « humain » ni « sans IA ». Rien d'inventé. Prix via `getPublicPricing()`. Site TTC.
- Configurateur inchangé. Ads non coupées. Ne pas toucher : fichiers shop (cgu, maquette-impression-3d, OrdersTab/OrderCard/Dashboard, api/orders/[id], lib/server/orders, middleware, session), reparer-piece-3d.astro.
- og:image : real-17 tant que le client n'a pas confirmé.

### File des demandes (ouvertes)
31. [~] Plan SEO national sûr : recherche faite (rapport concurrents + advisor). **Reste : écrire `docs/plan_seo_national_2026-10-27.md`** (contenu plus bas), puis un seul pop-up.
32. [~] « Guides » touche le logo : correctif CSS appliqué (diff relue : 1 ligne/fichier, CRLF OK), **non construit, non vérifié**.
33. [~] Bloc « Un projet singulier ou original ? » sur l'accueil après le carrousel réalisations (index.astro seulement, classes `projet-cta-*`, CSS copié de realisations `.cta-*`) : diff relue. Écart voulu : bouton principal « Parler de mon projet » visible au repos (valeurs de son état survolé), sinon plus faible que le secondaire sur tactile. Focus visible + reduced-motion ajoutés. Plausible : `/contact` déjà suivi (« Clic contact »), `/maquette-impression-3d` non suivi (AnalyticsClicks.astro, à décider). **Non construit, non vérifié.**
4/8/19. [~] Tunnel STL → panier + Plausible (migration locale faite).
7/20. [ ] Pages villes (Nantes enrichie ; Angers/Cholet seulement avec contenu réel). 9. Bing. 9b. Hors site : `docs/plan_3dnatives_frenchtech_2026-10-27.md`. 11-16 : machines, Ads maquettage (`docs/ads_maquettage_2026-10-27.md`, aucune dépense sans OK).
Shop (non urgent) : questions SEO-COMMUN.md ; prix exemple 14,10 € (choisi) vs 23,75 € en dur ; « humain » dans maquette L19/L39 et cgu L21.
10. Fin : Nolann teste en local, push sur son oui.

### Contenu du plan SEO à écrire (décidé avec l'advisor, 27/10)
- En tête, ligne de certitude : positions Google non mesurées (pas d'accès google.fr) ; à confirmer par Search Console (requêtes 28 j) ou google.fr.
- Titles/metas (longueurs vérifiées par script : title ≤ ~63, meta ≤ 160) :
  - Accueil : title « Impression 3D sur mesure en France — Atelier à Nantes | Nasap3D » ; meta « Impression 3D sur mesure livrée partout en France : pièces, prototypes, maquettes, rétro-conception et petites séries. Atelier à Nantes, expertise avant paiement. » ; h1 inchangé.
  - /impression-3d-en-ligne : « Impression 3D en ligne : fabrication et livraison en France | Nasap3D » (sans « devis instantané », pour ne pas doubler /devis-instantane). /devis-instantane : inchangé.
- Répartition : accueil = sur mesure/France + marque ; /devis-instantane = devis ; /impression-3d-en-ligne = en ligne/national ; /impression-3d-nantes = local ; /maquette-impression-3d = shop.
- JSON-LD : areaServed → « France » seul (index.astro l.37). GuideHero.astro:44 redéclare `#business` en Organization (conflit avec LocalBusiness) → `#organization` ou simple référence.
- devis-instantane l.107/124 : `div.di-h2` → `h2` (margin:0, font:inherit), vérifié par getComputedStyle.
- Images machines (index l.162-195, fonds CSS) : role=img + aria-label (faible valeur).
- Pop-up Nolann : pied de page (Footer.astro l.5-6 : « Livraison partout en France » + liens devis/réalisations/services) ; page rétro-conception (recommandé : phase 2 après inventaire des faits) ; Canclaux (docs Ads l.25, 3Dnatives l.19, desc Nantes).
- Hors site : 3Dnatives, Google Business Profile, Search Console (17 pages non indexées).
- Sources : Google title links (2025-12-10), spam policies doorway (2026-08-28), LocalBusiness/Organization (2026-09-08), Mueller cannibalisation (SEJ 2025-09-22).

### État technique
- Aperçu : `npx astro build`, tuer le PID sur 4455 (`netstat -ano | grep ":4455 " | grep LISTEN`, `taskkill //PID x //F`), `preview_start` « nasap-seo-build ». Nouveau worktree : jonction node_modules, `.env`, `.claude/launch.json` depuis `N\launch.json.modele`.
- Mesure en-tête (JS) : partir de `.nav-guides-btn` → `.nav-links` ; logo = `img` du parent ; comparer logo.right / 1er lien / dernier lien / Compte. Avant correctif à 1070 px : 19 px logo→1er lien, 20 px dernier→Compte. Début du menu : 256 px (1280), 336 px (1440), à garder.
- Le testeur n'a pas de navigateur (ni Playwright ni Puppeteer) : le fil principal capture avec le navigateur intégré.

### Ce qui n'a pas marché et pourquoi
- `astro check` : manque de mémoire (exit 134). Dev local : hydratation cassée via jonction (403 `@fs`) → on sert le dist construit.
- Docker Desktop : sockets périmés → renommer `%LOCALAPPDATA%\Docker\run` et `docker-secrets-engine` en `.stale-*`.
- Captures : animations d'entrée (attendre ≥ 2 s) ; menu Guides ouvert = survol.
- Boucle de compaction 27/10 soir (Opus ultracode, contexte trop lourd) → passation.

### Prochain pas exact
1. (fait 27/10, commit WIP local) Diff du bloc relue.
2. Nouveau worktree : jonction node_modules + `.env` + `.claude/launch.json` (voir État technique) ; tuer l'ancien serveur 4455 s'il tourne encore. Build + aperçu 4455 ; mesures JS de l'en-tête à 1061/1100/1150/1200/1280/1440 sur / et /devis-instantane (logo→1er lien ≥ 40, dernier→Compte ≥ 40, 1280/1440 identiques, pas de scroll horizontal) ; captures 375/768/1024/1280/1440 de l'en-tête et du bloc.
3. Écrire `docs/plan_seo_national_2026-10-27.md` (contenu ci-dessus, longueurs par script).
4. Un seul pop-up : rétro-conception, pied de page, Canclaux.
5. Advisor avant « fini » ; montrer à Nolann en local ; commit local sur son oui ; pas de push. `resize_window` preset desktop à la fin.
