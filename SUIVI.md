# SUIVI : état courant (27/10/2026)

Archives (maquettes 3D, Protection 3D, shop, passation 25/10) : `docs/SUIVI_archive_2026-10-25.md`.

## CHANTIER : SEO national + conversion /devis-instantane
Branche `claude/seo-conversion-de1652` (worktree `nasap3d-social-media-folders-171abf`), partie de master 614f30d. Brief : `reseaux-sociaux/docs/brief_opus_seo_site.md` (dépôt principal). Coordination shop : `Nasap3D website/SEO-COMMUN.md` (hors dépôt, n'éditer que la section « Session SEO site »).
Règles : **commits LOCAUX autorisés sur cette branche (oui de Nolann 26/10), JAMAIS de push sans son oui** ; URLs, JSON-LD, ads intacts. Fin = Docker local, tout vérifié, Nolann teste, push seulement quand on est sûrs.
Maquette validée (26/10) : https://claude.ai/artifact/P3GfWv2y1AFENNK3JTyvDF (source : scratchpad `maquette-seo.html`, ne pas modifier).

### Décisions en vigueur
- Accueil variante B (h1 « Impression 3D à Nantes »), title Nantes inchangé ; /impression-3d-en-ligne = page nationale. 5,0 sur 54 avis.
- En-tête IDENTIQUE à avant, seul ajout « Guides » (menu déroulant) avant Contact : **validé 27/10 (burger + menu normal)**. Tout écart d'en-tête = décision de Nolann.
- og:image = real-17 (objets liturgiques) 1200×630 : **OK 27/10**. La remplacer par sa grande maquette **seulement quand il confirme l'accord de son client**.
- **Devis : zone de dépôt, options et design du configurateur INCHANGÉS.** Ajouts seulement : cartes exemples + « Pas de fichier STL ? » (/devis-instantane), erreur panier à l'étape 4, événements Plausible, textes FAQ/meta. « Besoin d'aide pour choisir vos réglages ? » reste.
- **Phrase A** : « Aucun paiement à la commande. Expertise et validation de votre pièce en amont. » Jamais « humain » ni « sans IA ».
- Prix via `getPublicPricing()` (réglages admin), jamais en dur ; exemples plancher (PLA 8 g) et 31,76 € (cube PETG 50 mm) ; « remise dès 5 pièces » sans % ; jamais de €/kg.
- **Site en TTC** (27/10 : « je dois afficher TTC, on laisse les factures avec l'article »). Factures, PDF devis, panier GARDENT « TVA non applicable, art. 293 B du CGI ».
- Matériaux : températures gardées, phrase contact alimentaire OK, puces des héros + un seul bouton gardés ; photos particuliers real-18/5/16 OK (pop-ups 27/10).
- Ne pas toucher : fichiers du shop (cgu, maquette-impression-3d, OrdersTab/OrderCard/Dashboard, api/orders/[id], lib/server/orders, middleware, session), reparer-piece-3d.astro, conteneurs `refontenasap3d-*` (ni migration de leur base sans oui). Pas de « Boutique » ni d'URL shop au sitemap.

### File des demandes
1. [x] État des lieux + benchmark. 2. [x] Maquette validée.
3. [x] Accueil (9e98e98) — capturé ; écarts listés dans la galerie.
4. [~] Devis (d43a030) — capturé ; tunnel testé jusqu'à « analyse » ; panier bloqué par la base locale (voir plus bas).
5. [x] Guides : en ligne (f3f3c83) + particuliers, prix, matériaux (1aeeb76), TTC — capturés.
6. [x] Menu + pied Guides, sitemap lastmod (19 URL), og:image (902fb2f) — menu clavier, burger 375/768 vérifiés.
7. [~] Pages villes : JSON-LD + h2/h3 faits ; enrichissement visible = question à Nolann.
8. [~] Plausible : vérifiés « clic pas de STL », « Clic contact », « fichier chargé », « étape » 2/3, « analyse lancée », « erreur analyse » ; restent « prix affiché », « ajout panier », « erreur panier » (base) ; envoi réel /m/e vérifiable seulement en prod.
9. [ ] Bing (Webmaster Tools, IndexNow, Places).
10. [~] Fin : captures faites (7 pages × 375/768/901/1024/1280/1440, sombre) ; galerie côte à côte maquette/site en cours ; puis Docker complet, Nolann teste, push sur son oui.
11-15. [ ] Après ce chantier : machines « Trois imprimantes »/REAL_MAX/real-17 ; hors site (3Dnatives, avis) ; réponses Ads 5 €/j et 500 € ; SEO /maquette-impression-3d ; campagne Ads maquettes (aucune dépense sans OK).
16. [ ] Plus tard, sur confirmation : og:image → sa grande maquette.
17. [x] 8,90 € en dur alignés sur le plancher admin (706a322).
18. [ ] **En-tête entre 901 et ~1060 px** (voir ci-dessous) : choix de Nolann, puis correctif + recaptures 901/1024/1060.

### Questions à poser (un seul pop-up, après la galerie)
- **En-tête 901–1060 px** : avec « Guides », « Devis instantané » / « À propos » passent sur 2 lignes et le panier sort de l'écran à 901. (A, recommandé) burger jusqu'à ~1060 px (3 points : `global.css:316`, `Header.astro:337`, `HomeHeader.tsx:268/277`) ; (B) resserrer marges/espaces entre 901 et 1100 px (panier visible, retours à la ligne comme sur le site en ligne).
- **Base locale** : OK pour `npx prisma migrate deploy` (colonne `scale`, migration 20261022120000) sur la base du conteneur `refontenasap3d-db-1`, pour finir le test panier ?
- Pages villes : enrichissement visible ou non.
- Écarts : pied « Guides » en ligne ; guide en ligne (800 px vs 860, 15/38/25 px, bloc « Nos autres guides », ~1 250 mots vs ~2 000) ; liste des guides dupliquée (Header, HomeHeader, Footer, GuideRelated).

### État technique
- `astro build` vert (27/10, lot E compris ; avertissement Vite « chunk > 500 kB » déjà là). `astro check` : manque de mémoire (exit 134) même à 8 Go → piste tsconfig include/exclude.
- Commits locaux (rien de poussé) : 3fec742, 9e98e98, d43a030, 902fb2f, f3f3c83, 706a322, 1aeeb76.
- Aperçu = dist construit servi par `server-entry.mjs` port 4455 (`.claude/launch.json` « nasap-seo-build », non commité). Base = conteneur `refontenasap3d-db-1` (5432).
- Captures : scratchpad `captures/` (`capture.mjs`, `out/`, `mk/` = maquette). 42/42 sans scroll horizontal, îlots hydratés, aucune erreur console. 375 : Leaflet + hCaptcha (/contact), carrousel accueil OK.
- Port 4400 = `astro dev` du dépôt principal (autre session, PID 5384) : ne pas toucher.

### Ce qui n'a pas marché et pourquoi
- `astro check` à court de mémoire avec les réglages par défaut.
- Dev local : hydratation React cassée via jonction node_modules (403 `@fs`) → on sert le dist construit.
- POST /api/quotes en 500 (P2022, colonne `scale`) : la base locale n'a pas la migration 20261022120000 ; pas lancée sans le oui de Nolann.
- **Docker Desktop plantait au démarrage** : sockets Unix périmés (`%LOCALAPPDATA%\Docker\run\*`, `%LOCALAPPDATA%\docker-secrets-engine\engine.sock`). **À chaque redémarrage** : fermer Docker, renommer ces deux dossiers en `.stale-*` (rien supprimé), relancer. Jamais « Reset to factory defaults » (efface les volumes).

### Prochain pas exact
Galerie côte à côte (executant, scratchpad `galerie/`) → relire → publier en Artifact → pop-up groupé (en-tête, migration, villes, écarts). Puis correctif d'en-tête choisi + rebuild + recaptures, `astro check` (OOM), Docker complet, Nolann teste, push sur son oui.
