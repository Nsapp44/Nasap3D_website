# SUIVI : état courant (08/11/2026, soir)

Historique complet avant ménage : `docs/chantiers/suivi-maquettes-08_avant-menage_2026-11-08.md`. Archives storyboard : `docs/chantiers/suivi-storyboard-v3_2026-11-04.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Branche locale `claude/maquettage-b2b` (~97 commits), NON poussée. Push seulement sur le « oui » de Nolann ; avant : scan `claude-security` (fil principal), tests/build, Nolann coche les 4 événements webhook Stripe.
Règle modèle : Sonnet 90 % ; restructuration/maquette → Opus dans la même conversation, sans demander (mémoire `opus-sonnet-bascule-site`).

## Maquettes 08 (carrousel + /maquettiste-nantes) : où on en est
Fichiers : `docs/maquettes/carrousel-projets_2026-11-08.html` (source unique des blocs PJ:CSS/DATA/TPL/JS) et `page-maquettiste-nantes_2026-11-08.html`. Synchro : `outils-maquettes-08/sync_pj.py --write` puis sans option ; PJ:HTML à la main. Outils dans `docs/chantiers/notes-sessions_2026-11-08/local_5eab4690-e7a9-4711-827e-4e6ade9ac193/outils-maquettes-08/` (`cap.cjs`, `caps_serie.sh`, `seo_diff.py`). Serveur `python -m http.server 4380` (PID 46448). **Fichiers de 56 et 109 Ko : extraits seulement (cause des boucles de compaction).** Ne pas toucher `public/storyboard/cellule/preview-onde.html`, `src/`.

FAIT (commités en local) : bandeau chiffres 2×2 ; rideau pleine page (044d47a, à valider par Nolann) ; textes (délais, France / International, Réactivité) ; « 360° » → « 3D » ; **zoom = UNE seule visionneuse 3D par projet, rotation auto douce, pause pendant la manipulation, vignette statique (68682fd)** ; **section « Autres réalisations » retirée, carrousel « Nos maquettes » = 5 cartes, bouton « Toutes nos réalisations » sous le carrousel (3558066)**. Nolann : la maquette est très bonne, prochaine étape = coder la vraie page Astro + grosse optimisation.

## Portage Astro (conversation « [P] NASAP [page maquettiste Astro] », Opus)
Plan : `docs/chantiers/plan-portage-astro-maquettiste_2026-11-08.md` (f153436) : pas d'îlot React (JS vanilla de la maquette), CSS préfixé `.mqn`, lots L1-L8.
L1 données FAIT (4df8c01) : 4 textes de fiche `// BROUILLON à valider par Nolann` (caravane cite « une concession allemande », « près d'une centaine de caravanes »). L3 CSS FAIT (8d34123) : page = `<main class="mqn">` avec `<header class="hero">` dedans, `.mcta` hors main, `html.motion` posé par JS ; `.sb-frame`/`.sb-tag` gardés (à retirer si inutiles). L6 polices FAIT (25c3311, OFL 1.1, latin, preload SG 600/700) ; reste Google Fonts dans `admin.astro` et `shop.astro` (pages hors BaseLayout, lot à part). L2 carrousel FAIT (91b86cb) : `src/components/maquettiste/ProjectsCarousel.astro` + `projets-carrousel.css`, zoom = pop-up (scroll de page bloqué, molette = zoom ×1-×3), rotation auto reprend 2 s après le dernier geste. L5 fiches FAIT (3f3f720) : 4 pages `/realisations/<slug>` prérendues, sitemap +4 URLs, libellés `/realisations`. Build vert après `npx prisma generate` (le prérendu a besoin du client Prisma, cause : middleware). `astro check` plante (mémoire V8), pas de résultat complet. L4 page FAIT (619a1bb) : `src/pages/maquettiste-nantes.astro` réécrite (même title/description/path, JSON-LD Service+FAQPage+Breadcrumb), sections en `src/components/maquettiste/Sec*.astro`, `PageMotion.astro` (script bundlé : motion, [data-rv], .live, #types-cards), StoryboardCellule frame 0 `fetchpriority="high"`. Build vert, 1 H1, 13 details FAQ, JSON-LD valide. **Écarts L4 à vérifier en capture (L8)** : en-tête carrousel sans « 08 » et `h2#pj-title` au lieu de `#s-proj` ; h2 carrousel 24 px (règle `.pj-head .lp-h2` prioritaire) vs h2 des autres sections ; section `.pj` sans `sec`/`wrap` (largeur, espacement avec la 07) ; MachinesStrip dans un `div.wrap` après le carrousel ; `.more summary` masqué à toutes les largeurs ? ; avertissement build `Astro.request.headers` sur `/realisations/[slug]` (prérendu, à corriger).
Rappel Nolann (08/11) pour L2 : zoom = UNE vue 3D, rotation auto douce, pause à la prise en main (déjà en maquette) ; zoom = pop-up : page derrière bloquée, molette sur la 3D = zoom seulement, jamais de scroll de page.
Décisions 08/11 : slug caravane `maquette-caravane` ; photo caravane légendée « illustration » ; polices via @fontsource ; on suit la maquette (liste des blocs retirés de la page en ligne montrée avant push).
Leçon : `set_session_model` refuse sur la session courante → la passation « passe-toi sur Opus » ne marche pas (signalé à la conv Pipeline) ; Nolann a mis Opus à la main.

## File des demandes (08/11 soir)
1. [x] L8 contrôle + corrections L4 (93d97d6) : FAIT, rotation 3D OK, warning build corrigé.
2. [x] Optimisation site (baa17c3, local) : Lighthouse avant/après 98-100 partout, CLS accueil desktop 0,068→0,024, devis −3 requêtes, admin polices locales. /machines 87 = bruit (3 re-mesures à 100). Reste : shop.astro (Barlow Google), panier scripts Boxtal bloquants, Leaflet unpkg, og:image:alt BaseLayout ; Caddy (compression, cache, HSTS, 301 /service-impression-3d et /retro-conception) = Nolann. À vérifier en navigateur : devis-instantane (client:visible), header (CartBadge idle).
3. [ ] Boxtal : suivi AUTO Mondial Relay (NE RIEN CASSER). Dump JSON lecture seule de `order_status/{ref}/informations` sur une commande MR réelle, chercher le n° saisi à la main, l'ajouter à TRACKING_KEY_RE (`src/lib/server/boxtal.ts` ~576). `advisor` avant de figer l'approche (je ne peux pas choisir Fable : à Nolann de le régler).

4. [ ] Retours Nolann 08/11 soir (page locale 4399) :
   a. [~] Hero : 1re image nette (vraie f_000 chargée direct, sans flou ni base64), passage naturel vers la sphère. Édité (StoryboardCellule.astro, cellule.js `?v=poster-net`), NON vérifié. Rideau = bon, ne pas toucher.
   b. [ ] Fluidité du scroll du storyboard (technique « autre site »), pas commencé.
   c. [~] Trop de vide entre la fin de la sphère et « 01 Maquettes interactives » : `.mqn .sb + section.sec{margin-top:clamp(-200px,-16vh,-96px)}` dans maquettiste-nantes.css, NON vérifié (à 375 le vide mesurait 442 px, peut-être insuffisant).
   d. [~] Carrés KPI du hero tronqués : `white-space:nowrap` remplacé par retour à la ligne (text-wrap:balance), NON vérifié.
   e. [~] Zoom carrousel : caravane ne charge rien + loader ; visionneuse = celle de /maquette-industrielle (élévations e12/e28, LED cellule, frames base/ en zoom) ; cadre autour du texte MachinesStrip à retirer. CODÉ par `executant-ui` (non commité, non vérifié à l'exécution, seulement node --check) : ProjectsCarousel.astro (canvas, 3 hauteurs e12/e28/e55, LED cellule, base/ en zoom, ordonnanceur global annulé à la fermeture = hypothèse de la cause caravane, loader `.sp-loader`), projets-carrousel.css, MachinesStrip.astro (cartes sans cadre ; si trop serré ajouter row-gap sur `.ms-grid`). Manques : pinch mobile, zoom clavier. À vérifier au build + captures (caravane surtout).
   f. [ ] /maquette-industrielle : alléger visuellement comme la page maquettiste (trop de texte dur) : `architecte` conçoit, `executant-ui` applique, captures avant/après.
   Non touchés (Nolann aime) : page maquettiste dans l'ensemble, pages par projet, rideau.

## Prochain pas exact
Rebuild unique (arrêter PID 24504 de 4399, `npx prisma generate`, `npm run build`, relancer) + captures `testeur` (hero t0/1,5 s, fin de scène, KPI, zoom caravane/loader/LED à 375/768/1440/1920) ; puis 4b, 4f ; commits locaux fichier par fichier ; dire « prêt à vérifier » ; puis item 3 ; avant push : scan claude-security, OK de Nolann, liste des blocs retirés, 4 événements webhook Stripe cochés. Serveur 4399 à arrêter en fin.

## À reporter au code Astro
- « PETG HF » → « PETG » partout (`prisma/seed.ts:64` ; label en base/menu admin : migration à prévoir, accord de Nolann avant push).
- SEO : pas d'opacity:0 sur le H1, polices locales, fetchpriority image hero, `[data-rv]` masqué seulement si JS, retirer « (MAQUETTE 08/11/2026) » du titre + canonical + JSON-LD, pages `/realisations/<slug>` + sitemap.
- Cholet/Angers : 301 → /impression-3d-nantes, retrait liens pied de page + sitemap (après contrôle clics Search Console ≈ 0). Chercher dans `src/` le lien `{{ nav.href }}` (404). Lien accueil → /impression-3d-nantes (titre accueil figé jusqu'au ~30/11).
- Caddy (compression, Cache-Control HTML, HSTS) = dev de Nolann. Rapport : `docs/chantiers/audit-seo-nouveaux-outils_2026-11-08.md`.

## Reste à montrer / trancher (Nolann)
Captures : « Lire la suite » Blocs courts, h2 « Quatre types… », flèches masquées aux extrémités, « machines SP » = machines spéciales, lien « Toutes nos réalisations ». Caravane : photo = rendu ChatGPT → retirer ou marquer illustration. Contraste bouton devis. Pager du zoom (5 cartes). Écrans courts : hero épinglé coupé (−27 px à 375×667). Jonction 2 du rideau optionnelle. 12 PNG de captures commités (Nolann décide). Passe responsive 375/768/1440/1920 + thème sombre Windows.
Questions en attente (pop-up au retour) : real-17 renommé « Objets liturgiques » → « Maquettes de design produit » (image non vue, à confirmer) ; reprise de la rotation auto 2 s après le geste (garder ?) ; textes BROUILLON des 4 fiches (caravane : « concession allemande », « centaine de caravanes ») ; og:image:alt figé dans BaseLayout faux (« Objets liturgiques… ») ; Google Fonts restant dans admin/shop (lot à part).
Idée écartée : SMS au client (payant, Nolann le fait à la main, 08/11).

## Conversations à supprimer
Fille SEO et fork SEO : SUPPRIMÉS le 08/11 (accord de Nolann). Passation 09/11 : ancienne = local_1bb3337a-6b12-452b-8f2e-e460714d8e81 (« [P] NASAP [page maquettiste Astro] L8 contrôle + optim », à supprimer par la nouvelle). Rien d'autre en liste.

## Décisions de Nolann (en vigueur)
Une page par projet = GO (~300 mots, sans nom de client) ; « Un projet similaire ? » → `/contact` ; « Blocs courts » + « Animé au scroll » par défaut ; rideau A. Validé, ne pas toucher : zoom, « De l'idée à la maquette », bouton devis, « Un bureau d'études… », « Usage », « Ce qui nous distingue », « De la maquette à la petite série », carte « Maquette de design produit ». Guide Ads « Maquettage B2B » : `docs/ads_campagne_maquettage_2026-11-02.md` (publication après push et pages en 200).

## Ce qui n'a pas marché
Navigateur intégré peu fiable pour scroll/rAF → Chrome headless / `cap.cjs`. Lecture entière des maquettes → boucles de compaction (écriture déléguée à `executant-ui`). Bandeau 4 colonnes rognait « France » → 2×2. 404 console à 375 px dans le zoom, non identifié.
