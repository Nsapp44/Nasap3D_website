# SUIVI : état courant (27/10/2026)

Archives (maquettes 3D, Protection 3D, shop, passation 25/10) : `docs/SUIVI_archive_2026-10-25.md`.

## CHANTIER : SEO national + conversion /devis-instantane
Branche `claude/seo-conversion-de1652` (worktree `nasap3d-social-media-folders-171abf`), partie de master 614f30d. Brief : `reseaux-sociaux/docs/brief_opus_seo_site.md` (dépôt principal). Coordination shop : `Nasap3D website/SEO-COMMUN.md` (hors dépôt, n'éditer que la section « Session SEO site »).
Règles : **commits LOCAUX autorisés sur cette branche (oui de Nolann 26/10), JAMAIS de push sans son oui** ; URLs, JSON-LD, ads intacts. Fin = Docker local, tout vérifié, Nolann teste, push seulement quand on est sûrs.
Maquette validée (26/10) : https://claude.ai/artifact/P3GfWv2y1AFENNK3JTyvDF (source : scratchpad `maquette-seo.html` ; onglet « 3 autres guides » = plans du lot E).

### Décisions en vigueur
- Accueil variante B (h1 « Impression 3D à Nantes »), title Nantes inchangé ; /impression-3d-en-ligne = page nationale. 5,0 sur 54 avis.
- En-tête IDENTIQUE à avant, seul ajout « Guides » (mini menu déroulant) avant Contact. Animations de boutons = classes existantes du site. og:image = real-17 (objets liturgiques) 1200×630.
- **Phrase A** : « Aucun paiement à la commande. Expertise et validation de votre pièce en amont. » Jamais « humain » ni « sans IA ».
- Prix : plancher / minimum / frais via `getPublicPricing()` (réglages admin), jamais en dur ; exemples réels 8,90 € (PLA 8 g) et 31,76 € (cube PETG 50 mm) ; « remise dès 5 pièces » sans % ; jamais de €/kg ; TVA non applicable (art. 293 B).
- Ne pas toucher : fichiers du shop (cgu, maquette-impression-3d, OrdersTab/OrderCard/Dashboard, api/orders/[id], lib/server/orders, middleware, session), reparer-piece-3d.astro. Pas de « Boutique » ni d'URL shop au sitemap.

### File des demandes
1. [x] État des lieux + benchmark. 2. [x] Maquette validée.
3. [~] Accueil codé (9e98e98). Écarts à montrer : marge h1 16→10, `text-wrap: balance`, titre du bloc 22 px (maquette 25).
4. [~] Devis codé (d43a030). À montrer : « Envoyer mes photos » = copie de `.hero-cta-secondary` ; **8,90 € en dur dans la carte** (passer par getPublicPricing).
5. [~] Guides : **1/4** (/impression-3d-en-ligne + `components/guides/`, commit local). Restent particuliers, prix, matériaux = lot E.
6. [x] Menu + pied Guides, sitemap lastmod (19 URL), og:image, AnalyticsClicks (902fb2f).
7. [~] Pages villes : JSON-LD + h2/h3 faits ; enrichissement visible à proposer (pop-up).
8. [~] Événements Plausible codés, non testés.
9. [ ] Bing (Webmaster Tools, IndexNow, Places).
10. [ ] Fin : Docker local, captures 375/768/901/1024/desktop/1440 thème sombre, Nolann teste, push sur son oui.
11-15. [ ] Après ce chantier : machines « Trois imprimantes »/REAL_MAX/real-17 ; hors site (3Dnatives, avis) ; réponses Ads 5 €/j et 500 € ; SEO /maquette-impression-3d ; campagne Ads maquettes (aucune dépense sans OK).

### Doutes à soumettre à Nolann (pop-ups, avec les captures)
- Pied : « Guides » en ligne, pas en colonne. En-tête non vérifié à 901 et 1024 px. Liste des guides dupliquée (Header, HomeHeader, Footer, GuideRelated).
- Guide en ligne : texte 15 px, h1 38 px, h2 25 px (plus grand que les autres pages) ; largeur 800 px (maquette 860) ; bloc « Nos autres guides » ajouté (hors maquette) ; ~1 250 mots (maquette ~2 000) ; liens en 404 tant que le lot E n'existe pas ; jamais rendu au navigateur.
- « Retrait gratuit à l'atelier sur rendez-vous » (comme contact.astro) alors que le tunnel en ligne n'a pas d'option retrait (SHIPPING.md).

### État technique
- `astro build` vert (avant lots A/D). `astro check` : manque de mémoire (exit 134) même à 8 Go → piste tsconfig include/exclude.
- Commits locaux (rien de poussé) : 3fec742, 9e98e98, d43a030, 902fb2f, + guide en ligne (27/10).
- Rien vérifié au navigateur : carrousel 375, Leaflet, hCaptcha, Plausible, menu Guides clavier/mobile, guides.

### Ce qui n'a pas marché et pourquoi
- `astro check` à court de mémoire avec les réglages par défaut.
- Dev local : hydratation React cassée via jonction node_modules (403 `@fs`) → config temporaire `fs.strict=false`, jamais commitée.

### Prochain pas exact
**Lot E** : 3 guides (/impression-3d-particuliers, /prix-impression-3d, /materiaux-impression-3d) par `executant`, sur le modèle de `pages/impression-3d-en-ligne.astro` et des composants `guides/` (prix via getPublicPricing, faits tirés de PRICING.md, SHIPPING.md, matières, machines, lib/reviews.ts). Puis aligner la carte 8,90 € du devis. Puis build + `astro check` (testeur), dev local + captures, pop-ups des doutes, Docker local, Nolann teste, push sur son oui.
