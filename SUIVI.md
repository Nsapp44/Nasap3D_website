# SUIVI : état courant (26/10/2026)

Archives (maquettes 3D, Protection 3D, shop, passation 25/10) : `docs/SUIVI_archive_2026-10-25.md`.

## CHANTIER : SEO national + conversion /devis-instantane
Branche `claude/seo-conversion-de1652` (worktree `nasap3d-social-media-folders-171abf`), partie de master 614f30d. Brief : `reseaux-sociaux/docs/brief_opus_seo_site.md` (dépôt principal). Coordination shop : `Nasap3D website/SEO-COMMUN.md` (hors dépôt, n'éditer que la section « Session SEO site »).
Règles : maquette validée par Nolann AVANT tout code visible ; **commits LOCAUX autorisés sur cette branche (oui de Nolann 26/10), JAMAIS de push sans son oui** ; URLs, JSON-LD, ads intacts ; événements Plausible autorisés. Fin = Docker local (mêmes ressources que le serveur), tout vérifié, Nolann teste, push seulement quand on est sûrs.

**Maquette publiée (26/10)** : https://claude.ai/artifact/P3GfWv2y1AFENNK3JTyvDF (source : scratchpad `maquette-seo.html`). 6 onglets : guide en ligne rédigé, 3 autres guides (plan), accueil (h1 A/B), devis, menu Guides, photo de partage.

### Décisions en vigueur
- Accueil : title Nantes inchangé ; /impression-3d-en-ligne = page nationale. aggregateRating 5,0 sur 54 avis. Compte à la commande : ne rien changer.
- **Phrase A** (avec le shop) : « Aucun paiement à la commande. Expertise et validation de votre pièce en amont. » Jamais « humain » ni « sans IA » dans le texte visible.
- Google d'abord, Bing ensuite. Termes Ads prioritaires : « impression 3D particulier », « impression 3D en ligne ».
- Fichiers du shop à NE PAS toucher : cgu.astro, maquette-impression-3d.astro, OrdersTab/OrderCard/Dashboard, api/orders/[id].ts, lib/server/orders.ts, middleware.ts, session.ts. Pas de lien « Boutique » ni d'URL shop au sitemap avant sa mise en ligne. reparer-piece-3d.astro : ne pas modifier.
- Prix : plancher 8,90 €/pièce ; exemples réels 8,90 € (PLA 8 g) et 31,76 € (cube PETG 50 mm) ; « remise dès 5 pièces » sans pourcentage ; jamais de €/kg ; TVA non applicable (art. 293 B).

### File des demandes
1. [x] État des lieux + benchmark (Tech3D : volume de pages ciblées ; QB Maker : local Rezé).
2. [x] **Maquette VALIDÉE par Nolann (26/10)** (« j'aime beaucoup, c'est bon »), avec ces corrections : accueil = **variante B** (grand h1 « Impression 3D à Nantes », slogan en sous-titre) ; **en-tête IDENTIQUE à aujourd'hui** (logo, liens, soulignement orange de la page en cours, zoom au survol, Compte, icône compte, panier + badge), seul ajout = **« Guides » avant Contact, mini menu déroulant** (4 guides) ; **garder les petites animations de boutons de la DA du site** (réutiliser les classes existantes, pas le CSS de la maquette) ; **og:image = objets liturgiques `public/assets/real-17.webp`** recadrée 1200×630 (real-12 refusée). SEO maquettes = après ce chantier.
3. [ ] Accueil : h1, h2 descriptifs, bloc 300 mots, « about » h1→h2. Partie invisible FAITE, non testée (client:visible 600px, Leaflet et hCaptcha à la demande).
4. [ ] /devis-instantane : phrase A (ExpertiseSteps, meta l.85, FAQ l.17), cartes prix, carte « pas de STL » ; bug erreur panier invisible à l'étape 4.
5. [ ] 4 guides (1 200+ mots, FAQ h2 + FAQPage, vrais prix/avis/cas).
6. [ ] JSON-LD Organization/WebSite/aggregateRating/Breadcrumb, sitemap lastmod, menu + pied « Guides » (menu mobile max-height 480→~720).
7. [~] Pages villes : partie invisible FAITE dans `LocalSeoLayout.astro` (kickers section/FAQ → h2, questions → h3, même rendu grâce au reset global ; JSON-LD FAQPage + BreadcrumbList), non testée. Enrichissement visible (liens vers les guides, texte) = à proposer à Nolann.
8. [~] Événements Plausible CODÉS, non testés (liste dans SEO-COMMUN.md). Non couvert : 2e lien « Se connecter pour commander » (CartPage ~l.613).
9. [ ] Bing : Webmaster Tools (import GSC, Nolann se connecte), IndexNow, Bing Places, og:image photo 1200×630 + `image` JSON-LD.
10. [ ] Fin : Docker local, tout vérifié (pages, devis, panier, carte, captcha, compte, landing Ads), captures 375/768/desktop/1440 thème sombre, Nolann teste, push sur son oui.
11. [ ] À trancher avec Nolann : machines.astro « Trois imprimantes » (4 affichées) ; REAL_MAX = 6 cache les réalisations 10-18 ; real-17 titre/description incohérents.
12. [ ] Hors site : 3Dnatives, Trustpilot, avis Google, Pages Jaunes / CCI.
13. [ ] Réponses en attente à Nolann : 5 €/jour d'Ads (données + campagne avec conversions, n'aide pas l'organique) ; 500 € (contenu, avis, annuaires, jamais d'achat de liens).
14. [ ] (26/10) Refaire le SEO de /maquette-impression-3d : « maquette » seul = maquettes de modélisme (autre intention) ; viser « maquette impression 3D », « maquette architecture / immobilière Nantes », « maquette sur mesure ». Fichier du shop → coordonner (item 28 de Nolann).
15. [ ] (26/10) Préparer une campagne Ads payante « maquettes » (mots-clés, annonces RSA, budget, landing) ; aucune dépense sans OK de Nolann.

### État technique
- `astro build` vert. `astro check` : manque de mémoire (exit 134) trois fois, même avec 8 Go (26/10) → piste : limiter ce qu'il analyse (tsconfig include/exclude, dossiers lourds), à creuser avant la fin. Aucun warning vu sur les fichiers de la branche.
- Commit local 1 (26/10) : événements Plausible, chargement à la demande Leaflet/hCaptcha, LocalSeoLayout, archive docs. Le reste (lots A-D, useQuoteWizard, BaseLayout, index) sera commité lot par lot après relecture.
- Non vérifié au navigateur : carrousel à 375, Leaflet (/ et /contact), hCaptcha (/, /contact, /compte), événements Plausible.

### Ce qui n'a pas marché et pourquoi
- « Cubemaker » introuvable : le vrai nom est QB Maker (qbmaker.com).
- « Tech3D sans prix ni FAQ » ne valait que pour son accueil : sa page /impression-3d-en-ligne/ a une FAQ et « dès 10 € H.T. ».
- `astro check` à court de mémoire avec les réglages par défaut.
- Dev local : hydratation React cassée via jonction node_modules (403 `@fs`) → config temporaire `fs.strict=false`, jamais commitée.

### Prochain pas exact
Code en cours (26/10) : 4 executant LANCÉS en parallèle (A, B, C, D), relire chaque diff à leur retour. Lots aux fichiers séparés : **A** en-tête/pied/sitemap/og:image (Header.astro, HomeHeader.tsx, MobileNavToggle, Footer.astro, sitemap.xml, BaseLayout ogImage) ; **B** accueil (index.astro + home/*, JSON-LD) ; **C** devis (devis-instantane.astro, ExpertiseSteps.astro, quote/*, bug panier étape 4) ; **D** guide /impression-3d-en-ligne + composants `src/components/guides/`. Puis **E** : 3 autres guides + pages villes. Puis build (testeur), `astro check` sans OOM, dev local + captures 375/768/desktop/1440, Docker local, Nolann teste, push sur son oui.
