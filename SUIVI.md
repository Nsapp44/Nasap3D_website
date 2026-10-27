# SUIVI : état courant (27/10/2026, nuit)

Archives : `docs/SUIVI_archive_2026-10-25.md`, `docs/SUIVI_archive_2026-10-27.md` (détail items 1-30, commits, outils de capture, prix d'exemple).

## CHANTIER : SEO national + conversion /devis-instantane
Branche de travail `claude/vigilant-curran-6ea965` (worktree `nasap3d-pipeline-test-cedca2`, contient `claude/seo-conversion-suite-fe4650` jusqu'à b18c3d9). **Commits LOCAUX autorisés (oui 26/10), JAMAIS de push sans son oui** (push master = redéploiement). Coordination shop : `Nasap3D website/SEO-COMMUN.md` (section « Session SEO site » seulement). **N** = `C:\Users\Nolann\AppData\Roaming\Claude\side-session-notes\local_fd5f6327-4589-40c3-8f1d-ce3eb0044621`.
Mode conseillé : **Sonnet medium** pour la suite (exécution du plan), une fois que Nolann a vu le rendu local.

### Décisions en vigueur
- Objectif Nolann : clients de toute la France via le devis instantané (« comme Abeille 3D ») + projets singuliers (maquettage, rétro-conception). France d'abord, Nantes ensuite. **Jamais « livraison gratuite ».**
- Accueil : h1 « Impression 3D en France » (garder). Une seule page ville ciblée (Nantes) ; Angers/Cholet inchangées (règle Google « doorway »).
- En-tête identique à avant + « Guides » ; burger ≤ 1060 px ; `.nav-links` gap `clamp(16px, calc((100vw - 920px) / 8), 26px)` (Header.astro ~172, HomeHeader.tsx ~239).
- Phrase A : « Aucun paiement à la commande. Expertise et validation de votre pièce en amont. » Jamais « humain » ni « sans IA ». Rien d'inventé. Prix via `getPublicPricing()`. Site TTC.
- Configurateur inchangé. Ads non coupées. Ne pas toucher : fichiers shop (cgu, maquette-impression-3d, OrdersTab/OrderCard/Dashboard, api/orders/[id], lib/server/orders, middleware, session), reparer-piece-3d.astro.
- og:image : real-17 tant que le client n'a pas confirmé.
- Plan SEO : `docs/plan_seo_national_2026-10-27.md` (rôles des pages, titles/metas comptés, JSON-LD, di-h2, décisions, hors site). Rien appliqué au code avant son oui.

### File des demandes (ouvertes)
31. [~] Plan SEO national : doc écrit. **Reste : réponses de Nolann au pop-up (rétro-conception, pied de page, Canclaux), puis son oui pour exécuter le plan (§8 du doc).**
32. [x] « Guides » touche le logo : corrigé et vérifié (build 27/10, mesures 1061-1440 : ≥ 49 px logo→1er lien et dernier→Compte, 1280/1440 identiques à avant, aucun scroll horizontal). **À montrer à Nolann.**
33. [x] Bloc « Un projet singulier ou original ? » (accueil, après le carrousel) : construit, capturé 375/768/1024/1280/1440, propre, pas de scroll horizontal. Plausible : `/maquette-impression-3d` non suivi (AnalyticsClicks.astro, à décider). **À montrer à Nolann.**
4/8/19. [~] Tunnel STL → panier + Plausible (migration locale faite).
7/20. [ ] Pages villes (Nantes enrichie ; Angers/Cholet seulement avec contenu réel). 9. Bing. 9b. Hors site : `docs/plan_3dnatives_frenchtech_2026-10-27.md`. 11-16 : machines, Ads maquettage (`docs/ads_maquettage_2026-10-27.md`, aucune dépense sans OK).
Shop (non urgent) : questions SEO-COMMUN.md ; prix exemple 14,10 € (choisi) vs 23,75 € en dur ; « humain » dans maquette L19/L39 et cgu L21.
10. Fin : Nolann teste en local, push sur son oui.

### État technique
- Aperçu local : `npx astro build` puis `.claude/launch.json` « nasap-seo-4456 » (`node server-entry.mjs`, PORT 4456) → http://localhost:4456. **L'ancien serveur 4455 (PID 6788, dist de l'ancien worktree) tourne encore** : arrêt refusé par le mode auto ; Nolann peut le fermer.
- Captures avant (live) / après (local) : `C:\Users\Nolann\AppData\Roaming\Claude\side-session-notes\local_d5887c7c-3fd7-4561-8901-2eaabdcc644f\captures-2026-10-27` (`entete__*`, `bloc__*`, `mesures.json`). Script CDP : scratchpad de la session (`caps/header.mjs`, copie adaptée de `N\outils-captures\header.mjs`).
- Mesure en-tête (JS) : partir de `.nav-guides-btn` → `.nav-links` ; logo = `img` du parent. Début du menu : 256 px (1280), 336 px (1440). Décalage de 1 px sur /devis-instantane = préexistant.

### Ce qui n'a pas marché et pourquoi
- `astro check` : manque de mémoire (exit 134). Dev local : hydratation cassée via jonction (403 `@fs`) → on sert le dist construit.
- Docker Desktop : sockets périmés → renommer `%LOCALAPPDATA%\Docker\run` et `docker-secrets-engine` en `.stale-*`.
- Captures : animations d'entrée (attendre ≥ 2 s) ; menu Guides ouvert = survol.
- Arrêt du PID 6788 (port 4455) refusé par le classifieur du mode auto → servi sur 4456 à la place.
- Titles de la note du 27/10 trop longs une fois comptés : en-ligne 69 → version 59 ; meta accueil 162 → 154 (voir plan §2).

### Prochain pas exact
1. Nolann répond au pop-up (rétro-conception, pied de page, Canclaux) et regarde http://localhost:4456 + captures.
2. Sur son oui : exécuter le plan §8 en Sonnet medium (commit local par étape, build, contrôles dist + captures). Pas de push sans son oui.
