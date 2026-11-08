# Audit SEO du site Nasap3D, 08/11/2026 (lecture seule)

Périmètre : code `src/` + `public/` (master 07a4436, identique à la prod 9d69d2f pour `src/`) et site en ligne https://nasap3d.com. Rien modifié, rien poussé. Non refait : l'audit des maquettes 08 (`seo-perf-maquettes-08_2026-11-08.md`).
Méthode : les agents plugin `searchfit-seo` n'étaient plus disponibles dans la session. Leurs consignes (seo-audit, technical-seo, on-page-seo, schema-markup, internal-linking, ai-visibility, broken-links, content-brief, keyword-clustering) ont été recopiées dans le brief de 2 agents `seo` (code) et 2 `chercheur-web` (prod, concurrents). Vérifications `curl` faites en direct par la session pour combler ce que WebFetch ne voit pas (en-têtes, balises head).
Légende : [V] vérifié (curl/lecture), [A] rapporté par un agent, non recoupé, [S] supposé.

## CRITIQUE
Rien de bloquant pour l'indexation [V] : canonical auto-référent partout, sitemap = 20 URLs publiques en 200, robots cohérent, 1 H1 par page, 301 `/services/` → `/services`, www et http en 308 vers `https://nasap3d.com/`.

Points à plus fort enjeu (classés « important » mais à traiter en premier) :
1. **Cannibalisation « impression 3d nantes »** [A, données `seo-search-console_2026-11-02.md`] : l'accueil est en position 5,5 (216 impr.), `/impression-3d-nantes` en 14,7 (47 impr.). L'accueil n'a aucun lien dans le corps vers la page Nantes (seul le pied de page, `Footer.astro:8`, 10 px gris). Reco déjà écrite dans le doc GSC, jamais appliquée.
2. **Cholet et Angers = pages jumelles** [A] (le plan du 27/10 les laisse « inchangées » à dessein, règle Google sur les pages satellites ; ma reco de les différencier ou passer en noindex est donc une **proposition à valider**, pas un défaut établi) : `impression-3d-cholet.astro:13` et `impression-3d-angers.astro:13` ont le même `sectionIntro`, mêmes statCards (hors distance), même FAQ de 2 questions. Risque doorway / contenu mince. Cholet : 62 impr., pos. 5, 0 clic. Angers est indexée (visible en `site:`).

## IMPORTANT
3. **Compression et cache absents côté serveur** [V] : `curl -H "Accept-Encoding: gzip, br" https://nasap3d.com/` ne renvoie aucun `Content-Encoding` (confirmé en GET `curl --compressed`, pas seulement en HEAD) ; aucun `Cache-Control` sur le HTML ; images en `Cache-Control: public, max-age=0` (ex. `/assets/og-nasap3d.jpg`, 67 Ko) ; pas de HSTS. Impact perf (LCP) sur tout le site. Config Caddy hors dépôt : à transmettre à Nolann (déjà signalé pour les maquettes).
4. **Titre de `/impression-3d-nantes` non mis à jour** [V prod] : « Impression 3D à Nantes — Atelier Local | Nasap3D » (`impression-3d-nantes.astro:10`) ; la proposition du chantier GSC (58 car.) n'est pas appliquée. Pas de `LocalBusiness` sur cette page [V : seuls FAQPage + BreadcrumbList en prod] ; l'accueil a LocalBusiness + Organization + WebSite + GeoCoordinates [V].
5. **Meta descriptions : à NE PAS raccourcir sans raison (correction 08/11, après remarque de Nolann).** Version initiale du rapport : « trop longues, viser 150-155 ». C'est à nuancer : Bing Webmaster a signalé des descriptions **trop courtes** (pages légales, `seo-search-console_2026-11-02.md:16`), et `plan_seo_national_2026-10-27.md` §2 fixe déjà les longueurs voulues (accueil 154). Longueurs estimées à la main, ±3 car. : Cholet/Angers ≈185, `devis-instantane.astro:85` ≈175, `maquette-impression-3d.astro:77` ≈170, Nantes ≈158, accueil ≈156. Google coupe vers 155-160 mais ne pénalise pas ; la coupe n'est pas un défaut SEO. Action réelle : (a) allonger les descriptions des pages légales (Bing) ; (b) ne retoucher les autres que si leur début ne porte pas l'argument clé. Aucune retouche recommandée sur l'accueil.
6. **Titres** [A] : `maquette-impression-3d.astro:76` ≈66, `shop.astro:19` ≈63 ; l'accueil (63) a été choisi à dessein dans le plan du 27/10 : ne pas toucher avant ~30/11. Google réécrit parfois les titres longs : priorité basse.
7. **Polices Google bloquantes** [A] : `BaseLayout.astro:68-72`, `<link rel=stylesheet>` sans preconnect gstatic. Héberger Space Grotesk + Inter en local (`font-display:swap`, preload).
8. **Page `/reparer-piece-3d` : noindex, hors sitemap, quasi orpheline** [A+V] (`reparer-piece-3d.astro:3-5,39`) : voulu pour la landing Ads, mais « réparer / refaire une pièce cassée » est le sujet à plus forte intention et n'a aucune page indexable. Fuite : `impression-3d-nantes.astro:56` y renvoie. Plan : une page indexable distincte (`/refaire-piece-introuvable-3d`, H1 « Pièce cassée ou introuvable : refaite sur mesure en impression 3D », sections : pièces refaites, méthode photo+cotes, matières, exemples réels, limites sécurité, FAQ 5 Q, Service+FAQPage), en gardant la LP Ads telle quelle (ne pas couper les ads).
9. **Paramètres de tracking (`?trk=`, UTM)** : pas un problème, Nolann en a besoin pour Plausible. Canonical de `/` propre [V] : Google regroupe les variantes. Rien à faire (seule curiosité : `/?trk=public_post-text` apparaît en `site:`, sans conséquence).
10. **`/favicon.ico` = 404** [V]. Le `<link rel=icon>` PNG existe [V] (`/assets/logo-icon.png`) ; ajouter un `favicon.ico` ou une redirection.
11. **Maillage entre guides** [A] : `/prix-impression-3d`, `/impression-3d-particuliers`, `/materiaux-impression-3d`, `/impression-3d-en-ligne` ne renvoient ni vers `/impression-3d-nantes` ni vers `/maquette-impression-3d` (indexation GSC de cette dernière : aucune). `/a-propos` : menu seulement. Ajouter 1 lien contextuel dans chaque guide.
12. **`aggregateRating` 5,0 / 54 en dur** [V] sur l'accueil (`index.astro:41-46`) : note auto-déclarée ; risque Google « self-serving ». Les avis varient selon la source (36, 44 ou 54) [A] : harmoniser, ou retirer le balisage et garder les avis en texte visible.
13. **Données structurées** [A] : Article des guides sans `datePublished` ni `image`, `dateModified` figé à 2026-10-26 (`GuideHero.astro:38,54-64`) ; `email: "nasap3D@gmail.com"` à la casse différente (`index.astro`). `sameAs` réduit à Google Maps (`index.astro:40`).
14. **Pas de FAQ sur l'accueil** [A, concurrents en ont] : FAQ + FAQPage (prix, formats STL/STEP, délais, expertise avant paiement) : bon pour les citations IA.

## MINEUR
15. **Pas de `llms.txt`** [V : 404 prod]. Coût nul, gain faible : entité en 3 lignes + 12 pages clés.
16. **Sitemap statique** [V] : 15 `lastmod` à 2026-10-26 alors que des pages ont changé depuis [A] ; `priority` ignorée par Google ; `/shop` et `/reparer-piece-3d` absents (normal).
17. **Images sans width/height** [A] : `machines.astro:40,62`, `realisations.astro:47`, `Header.astro:48`, `HomeHeader.tsx:131`, `RealisationsCarousel.tsx:103` (CLS). Cartes machines de l'accueil en fond CSS avec `role=img` (`index.astro:175-208`) : non indexables par Google Images.
18. **Structure pauvre** [V prod] : `/machines` et `/realisations` n'ont qu'un H2 ; `/contact` aucun ; `/a-propos` H1 en deux blocs collés. `/realisations` : légende « Objets liturgiques » incohérente avec son texte, légendes dupliquées (déjà dans l'audit maquettes : à corriger au portage).
19. **Footer en 10 px, gris 35-50 %** [A] (`Footer.astro:28-48`) : maillage presque illisible, à doubler dans un bloc visible de l'accueil.
20. **`robots.txt` bloque `/compte /admin /panier`** alors que les meta noindex ne sont alors pas lues : sans conséquence (pages privées) [A]. `shop.nasap3d.com` : erreur de certificat « unable to verify the first certificate » vue par WebFetch [A, peut-être artefact de l'outil] ; le middleware redirige ce sous-domaine en 302 [A].
21. Ancres `/services#maintenance`, `#retroconception`… : existence des `id` non vérifiée [S].

## Positionnement observé (indicatif, hors géoloc) [A]
- « impression 3d nantes » : nasap3d.com ~6e-7e (2 pages dans le top 10) derrière La Nouvelle École, 3d-impressions.fr, Atlantech 3D (Rezé), Tech3D, Technix3D.
- « maquette impression 3d nantes » : nasap3d.com 1er (`/impression-3d-nantes`) et 2e (`/`).
- Concurrents directs : 3D Nantes (3d-nantes.com : 14 pages communes, 7 matériaux, 3 guides, FAQ 6 Q), Atlantech 3D (viewer 3D, avis 5,0, remises quantité), Concept 3D (B2B, pages par matériau, cas industriels), Dariane 3D (B2B, cas aux liens cassés). Nasap3D a déjà : 15 réalisations, avis, prix « dès 8,90 € », guides, page maquettes.

## Opportunités de pages (priorisées)
1. Page indexable « refaire une pièce cassée / introuvable » (point 8). Concurrents : repar3d.fr (dès 59 €), alveo3dprint, recrea3d.
2. Pages par matériau (PETG, ASA, TPU, Nylon) : concurrents en ont, basse difficulté.
3. Pages de communes autour de Nantes (Rezé, Saint-Herblain, Orvault…) avec 150-250 mots uniques ; une seule ville à tester d'abord, après avoir réglé Cholet/Angers.
4. Études de cas détaillées par réalisation (déjà porté par le gabarit `/realisations/<slug>` des maquettes 08).
5. `/maquette-industrielle-3d` : voir `/maquette-industrielle` déjà prévu côté maquettes ; éviter de doubler `/maquette-impression-3d`.
6. `/impression-3d-professionnels` (série, TPU 528 pièces) : à tester après les autres.
## Reste à faire hors site (backlinks) : le vrai manque
Constat de Nolann (08/11) : pas assez de backlinks. Google Business Profile : déjà complet, rien à faire (retiré de la liste). Tout ce qui suit est préparé mais RIEN n'est envoyé ni payé sans son accord.
1. **French Tech / French Fab** : c'est lui qui peut faire la demande. Nuance du plan du 27/10 (`docs/plan_3dnatives_frenchtech_2026-10-27.md`) : French Tech Nantes jugée peu adaptée (label d'écosystème, pas d'annuaire trouvé) [NV] ; French Fab (Bpifrance, `lafrenchfab.fr`) plausible pour un atelier qui produit en France [NV, site illisible par l'outil : 10 min dans un navigateur]. À confirmer avant de passer du temps.
2. **3Dnatives** (priorité 1 du plan du 27/10) : page « Impression 3D à Nantes » avec 3 prestataires, Nasap3D absent. Formulaire `3dnatives.com/ajout-societe/` (vérifier avant d'envoyer s'il est payant) + email à la rédaction, textes déjà rédigés dans le plan.
3. **Annuaires gratuits** [A] : I3DEL (impression3denligne.fr, SIRET requis), lesimprimantes3d.fr/annuaire, jesuisnumerique.fr, Pages Jaunes / Cylex.
4. **« L'autre chose »** évoquée par Nolann : non identifiée avec certitude (3Dnatives ? French Fab ?) : à confirmer.
5. Mesure : citation par ChatGPT/Perplexity non testée ; suivre les liens entrants dans Search Console (Liens) et Bing Webmaster.

## Ordre d'action conseillé
1. Lien de l'accueil vers `/impression-3d-nantes` + nouveau titre Nantes (+ LocalBusiness sur cette page).
2. Compression, Cache-Control, HSTS dans Caddy (dev de Nolann) ; polices locales.
3. Différencier Cholet/Angers (contenu local réel) ou `noindexFollow`.
4. Page indexable « pièce cassée » ; liens guides → Nantes/maquette ; `llms.txt` ; `favicon.ico` ; lastmod.
Ne pas toucher : ads, URLs, `/reparer-piece-3d` (Ads), titre de l'accueil avant ~30/11.

## Non vérifié
Contenu complet des 4 guides, de `/a-propos`, `/machines`, `/realisations`, `LocalSeoLayout.astro` (grep seulement) ; poids et Lighthouse réels ; citations IA ; longueurs de titres/descriptions estimées à la main.

## Comparaison avec l'audit des maquettes 08
- Nouveau ici : en-têtes réels de la prod (pas de compression, pas de cache, pas de HSTS), `favicon.ico` 404, cannibalisation accueil / `/impression-3d-nantes` (données GSC), pages jumelles Cholet/Angers, absence de `llms.txt`, JSON-LD par page, concurrents nantais, manque de backlinks.
- Recoupe l'audit précédent : polices Google à héberger, compression Caddy, pages `/realisations/<slug>`, lastmod du sitemap, légendes de `/realisations`.
- Apport des « nouveaux outils » : les agents plugin `searchfit-seo` étaient indisponibles ; le travail est fait par `seo` + `chercheur-web` avec leurs consignes recopiées. Utiles surtout pour les concurrents et le positionnement ; le code et les en-têtes ont demandé des `curl` en plus. Pas de découverte critique que l'audit précédent aurait ratée sur les maquettes (périmètres différents).

