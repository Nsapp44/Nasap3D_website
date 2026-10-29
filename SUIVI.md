# SUIVI : état courant (27/10/2026, nuit)

Archives : `docs/SUIVI_archive_2026-10-25.md`, `docs/SUIVI_archive_2026-10-27.md` (détail des items 1-30, commits, outils de capture, prix d'exemple).

## CHANTIER : SEO national + conversion /devis-instantane
- Branche de travail : `claude/vigilant-curran-6ea965` (worktree `nasap3d-pipeline-test-cedca2`). Elle contient `claude/seo-conversion-suite-fe4650` jusqu'à b18c3d9.
- **Commits LOCAUX autorisés (oui du 26/10). JAMAIS de push sans son oui** : un push sur master redéploie le site.
- Coordination avec le shop : `Nasap3D website/SEO-COMMUN.md`, section « Session SEO site » seulement.
- Mode conseillé : **Sonnet medium** pour exécuter le plan.

### Décisions en vigueur
- **France d'abord, Nantes ensuite. PAS d'international** (Nolann, 27/10 : « national je voulais dire que France »). **Ne pas perdre Nantes** : une commande de 1 300 € vient de Nantes, et « le site rassure et donne envie, c'est bien ce qu'on fait ». **Jamais « livraison gratuite ».**
- Accueil :
  - h1 « Impression 3D en France » (on le garde) ;
  - une seule page ville ciblée (Nantes) ; Angers et Cholet inchangées (règle Google « doorway ») ;
  - « Atelier à Nantes » reste dans le title et la meta ;
  - `areaServed` du JSON-LD inchangé.
- En-tête :
  - identique à avant, avec « Guides » en plus ;
  - menu burger à 1060 px et moins ;
  - `.nav-links` gap `clamp(16px, calc((100vw - 920px) / 8), 26px)` (Header.astro ~172, HomeHeader.tsx ~239).
- Pied de page :
  - « Livraison partout en France » + liens devis / réalisations / services ;
  - **on GARDE les liens Nantes, Cholet et Angers** (ce sont les seuls liens vers /impression-3d-nantes présents sur toutes les pages).
- Rétro-conception : pas de page.
- Canclaux :
  - retiré seulement du texte à côté de « Contact », en bas de l'accueil : déjà fait (43c9aa8) ;
  - **on le laisse partout ailleurs**, y compris dans la bulle de la carte, car « l'adresse complète c'est important ».
- Textes :
  - phrase A : « Aucun paiement à la commande. Expertise et validation de votre pièce en amont. » ;
  - jamais « humain » ni « sans IA » ; rien d'inventé ;
  - prix via `getPublicPricing()` ; site TTC.
- Interdits :
  - configurateur inchangé ; Ads non coupées ;
  - ne pas toucher les fichiers du shop (cgu, maquette-impression-3d, OrdersTab/OrderCard/Dashboard, api/orders/[id], lib/server/orders, middleware, session) ni reparer-piece-3d.astro.
- og:image : real-17.
- **Plan :** `docs/plan_seo_national_2026-10-27.md` (§1-9, décisions intégrées). Rien n'est appliqué au code avant son oui.
- Recherche international / Nantes, archivée : `docs/international_seo_2026-10-27.md`.

### File des demandes (ouvertes)
31. [~] Plan SEO national : doc écrit et toutes ses réponses intégrées. **Reste : son oui pour exécuter le §8.**
32. [x] « Guides » qui touchait le logo : corrigé et vérifié (au moins 49 px d'écart de 1061 à 1440 px, 1280 et 1440 identiques à avant). **À montrer à Nolann.**
33. [x] Bloc « Un projet singulier ou original ? » (accueil) : capturé à 375/768/1024/1280/1440, propre. Plausible ne suit pas `/maquette-impression-3d` (à décider). **À montrer à Nolann.**
34. [x] Nantes + « international » : c'était un malentendu, il voulait dire national. Garde-fous Nantes inscrits dans le plan §9.
4/8/19. [~] Tunnel STL → panier + Plausible (migration locale faite).
7/20. [ ] Pages villes. 9. Bing. 9b. Hors site : `docs/plan_3dnatives_frenchtech_2026-10-27.md`. 11-16 : machines, Ads maquettage (`docs/ads_maquettage_2026-10-27.md`, aucune dépense sans OK).
Shop (non urgent) : questions de SEO-COMMUN.md ; prix d'exemple 14,10 € vs 23,75 € écrit en dur ; « humain » dans maquette L19/L39 et cgu L21.
10. Fin : Nolann teste en local, push sur son oui.

### État technique
- Aperçu local : `npx astro build`, puis la config `.claude/launch.json` « nasap-seo-4456 » (`node server-entry.mjs`, PORT 4456) → http://localhost:4456.
- **L'ancien serveur 4455 tourne encore** (PID 6788, dist de l'ancien worktree). L'arrêt a été refusé par le mode auto ; Nolann peut le fermer.
- Captures avant (live) / après (local) : `C:\Users\Nolann\AppData\Roaming\Claude\side-session-notes\local_d5887c7c-3fd7-4561-8901-2eaabdcc644f\captures-2026-10-27` (`entete__*`, `bloc__*`, `mesures.json`).
- Script de capture CDP : `caps/header.mjs` dans le scratchpad de l'ancienne session. La copie d'origine est dans `local_fd5f6327…\outils-captures\header.mjs`.

### Ce qui n'a pas marché et pourquoi
- `astro check` : manque de mémoire (exit 134).
- Dev local : l'hydratation casse via la jonction (403 `@fs`), donc on sert le dist construit.
- Docker Desktop : sockets périmés → renommer `%LOCALAPPDATA%\Docker\run` et `docker-secrets-engine` en `.stale-*`.
- Captures : attendre au moins 2 s (animations d'entrée) ; le menu Guides ouvert correspond à un survol.
- Titles de la note du 27/10 trop longs une fois comptés : version raccourcie, voir le plan §2.
- Boucle de compaction le 27/10 au soir : passation vers une nouvelle conversation.

### Prochain pas exact
1. Montrer à Nolann http://localhost:4456 et les captures (bloc__375, bloc__1280, entete__accueil__1100__apres) pour les items 32 et 33.
2. Lui demander son oui (pop-up) pour exécuter le plan §8 en **Sonnet medium**, avec un commit local par étape, un build, les contrôles dist et des captures. Pas de push sans son oui.
3. À la fin : `resize_window` desktop sur le navigateur intégré.

## CHANTIER : maquettes 360° (carrousel /maquette-impression-3d)
Etat (29/10/2026) : liste pilotee par `src/data/maquettes.ts` (cellule, purification, caravane). Rendus Cycles faits hors depot (`Source machine/glb/render_obj.py`, `run_full.sh`), convertis par `scripts/build-maquette-frames.mjs <src> <id>` (base+sm seulement, pas de rank/glow : `led:true` reserve a la cellule). Non commite : attente accord de Nolann.

### Supprimer une maquette (pieces de marques tierces, retrait sur demande)
1. `src/data/maquettes.ts` : `enabled:false` sur l'entree (ou supprimer l'entree).
2. Supprimer `public/assets/maquettes/<id>/` (ids : `purification`, `caravane`).
3. `npm run build`, redeployer (push sur master). Aucun titre, JSON-LD, sitemap ni lien interne ne depend des maquettes ; s'il n'en reste aucune, la section carrousel disparait.
4. Limite : l'historique git garde les images. Un retrait definitif exige une reecriture d'historique (filter-repo) + purge du cache.
5. Source des rendus : `Source machine/` (hors depot), a supprimer aussi si demande.
Poids : ~20 Mo par maquette dans le depot.
A signaler a Nolann : le lettrage de marque et le logo des roulettes sont graves dans la geometrie des modeles (re-rendu 13-20 min/modele pour les aplanir) ; les feux rouges arriere de la caravane sont en FDM (plexi possible).
