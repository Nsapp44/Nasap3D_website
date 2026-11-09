# SUIVI : état courant (09/11/2026)

Version complète avant ménage : `docs/chantiers/suivi-maquettes-09_avant-menage_2026-11-09.md` (portage Astro L1-L8, décisions, archives). Plus ancien : `suivi-maquettes-08_avant-menage_2026-11-08.md`, `suivi-storyboard-v3_2026-11-04.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Branche locale `claude/maquettage-b2b` (~99 commits), NON poussée. Push seulement sur le « oui » de Nolann ; avant : scan `claude-security` (fil principal), tests/build, liste des blocs retirés de la page en ligne, Nolann coche les 4 événements webhook Stripe.
Worktree : `.claude/worktrees/maquettage-b2b-propre`. Règle modèle : Sonnet 90 %, Opus seulement maquette/restructuration.
Ne pas commiter : `src/pages/shop.astro` (pas à nous), `planches-maquettes-08/`, `retours-n2_cartes-chiffres.png`, `public/storyboard/cellule/preview-onde.html`.

## Page /maquettiste-nantes (Astro, vérifiée 09/11)
Commits : ec01251 (vide sous la sphère réduit d'environ 144 px : `.mqn .sb ~ section.sec:first-of-type`, l'ancien `+` ne marchait jamais à cause des `<script>` intercalés), ab63a60 (/maquette-industrielle allégée : sections numérotées 01-06, cartes sans cadre, grilles 1/2/4 colonnes, FAQ sans `lp-narrow`, textes/SEO/JSON-LD inchangés). Vérifié : hero, KPI (« … » = texte littéral dans HeroMaquettiste l.18 et SecProcess l.17, pas du CSS), scrollWidth = largeur à 375/768/1440/1920, zoom 3D (caravane 73 requêtes, cellule e12/e28/e55, 0 erreur console). Rideau = bon, intact.

## File des demandes
1. [x] Retours 08/11 soir : a hero, c vide, d KPI, e zoom, f /maquette-industrielle : faits et vérifiés.
2. [x] 4b fluidité scroll storyboard : mesuré 09/11 (440 frames, 2 > 33 ms, max 49 ms, 1 long task 110 ms, headless) = aucun changement, déjà fluide.
3. [ ] Boxtal : suivi AUTO Mondial Relay (NE RIEN CASSER). `advisor` avant de figer l'approche ; OK de Nolann pour un dump JSON lecture seule de `order_status/{ref}/informations` sur une commande MR réelle ; ajouter le n° saisi à la main à `TRACKING_KEY_RE` (`src/lib/server/boxtal.ts` ~576).
4. [~] Passe SEO (Nolann a choisi « liste À reporter », 09/11) : og:image:alt corrigé (BaseLayout). Rien d'autre fait : PETG = migration base (accord avant push), 301 Cholet/Angers = après contrôle Search Console, Footer/404/nantes les lient encore, nav.href introuvable dans src/. Slide 3D : Nolann dit « charge au slide avec loader comme avant » = comportement actuel, aucun changement.

5. [ ] Demande orale de Nolann (09/11) : à la toute fin, audit de performance (Lighthouse avant/après) ET de sécurité (scan `claude-security` depuis le fil principal) pour confirmer que tout va bien.

6. [x] CLOS par décision de Nolann (pop-up 09/11 : on s arrête sur le LCP) (advisor appelé 1x) Essai `inlineStylesheets:'always'` REJETÉ (HTML 153 Ko sans compression Caddy, LCP 2,58 s sur 5 passes) ; config revenue à l'état commité. Relevé réseau /maquettiste-nantes (FCP local 376 ms, 45 req, 907 Ko) : avant le 1er rendu partent client.js 180 Ko (React), GSAP+ScrollTrigger 113 Ko, 15 frames storyboard ~197 Ko, cellule.js 22 Ko ; /api/cart 2,2 s. ESSAI menu mobile en JS pur : fonctionnel OK mais client.js reste chargé (îlots Header client:idle) et LCP bruité 1,5-4 s = aucun gain, REVERTÉ. Concurrents (Lighthouse 09/11) : technix 1,6 s, impressions-3d 1,9 s, les maquettistes 9-75 s = le site les bat presque tous. LCP clos sur décision de Nolann. Critère principal (advisor) : requêtes/Ko partis AVANT le FCP (`net.cjs`, base 36 req / 894 Ko, FCP 376 ms) ; Lighthouse local trop bruité (1,5-4 s). ESSAI différer GSAP+ScrollTrigger+cellule.js après `load` (StoryboardCellule.astro) : 31 req / 721 Ko seulement, ils partent encore avant le FCP (`load` très tôt en local), f_000 figée dans le test de scroll non comparée à la base = REVERTÉ (patch gardé dans le scratchpad `defer.patch`). Piste restante : déclencheur plus tardif (1re interaction/scroll ou délai après `load`) + frames en `rootMargin` 0. Serveur 4399 = PID 14424 (dist = build de l essai, à reconstruire). Pistes non faites : (a) différer frames/GSAP/storyboard après le 1er rendu (toucher au rideau = non) ; (b) menu mobile en JS pur au lieu de React `client:load` ; (c) CSS critique hero + reste différé. Concurrents : Lighthouse en cours (agent), pas de clé PSI. Passe LCP précédente : (Nolann 09/11 « fonce ») : pistes 2-5 déjà faites (baa17c3). Lighthouse mobile 09/11, médiane 2 passes, build prod local : `/` 95, LCP 1,62 s ; `/maquettiste-nantes` 95, LCP 2,05 s (variance : 1,5 à 2,6 s) ; `/maquette-industrielle` 100, LCP 1,35 s ; `/devis-instantane` 99, LCP 1,43 s. Base 08/11 (69 / 6,85 s et 79 / 4,26 s) = avant baa17c3. Reste : JS inutilisé ~0,3 s sur maquettiste-nantes, Speed Index 4,5 s sur `/`. Pistes 1 (Caddy) = dev de Nolann.
7. [x] « Ouvrir la 3D de /maquette-industrielle dans le zoom, pareil pour les 2 autres » : déjà en place (visionneuse réutilisée). LED seulement sur la cellule (`led: true`, src/data/maquettes.ts) : question à Nolann si LED voulues sur purification/caravane (calques de rendu à produire).
8. [~] 09/11 soir, retours Nolann : (a) poster hero « infâme » : plan architecte = f_000.webp net recadré comme le canvas (zoom 1.5), blur 1 px, fondu masqué 0.08-0.10, déclencheur au 1er scroll ; appliqué par executant-ui, à rebuild + captures + vérif (1 seule requête webp avant scroll, écart < 5). (b) /maquette-industrielle : section « réalisées » remplacée par ProjectsCarousel filtré (`slugs` : bioréacteur, purification, cellule) ; garder le carrousel 360°. (c) MachinesStrip : l'ancien encadré est gardé provisoirement, Nolann veut des PROPOSITIONS de cartes + bloc texte H2C plus propres (architecte, 3 options A/B/C -> pop-up). advisor Fable autorisé par Nolann.

## Prochain pas exact
09/11 soir, état : (a) poster f_000 net appliqué (StoryboardCellule.astro + cellule.js, NON commités) ; (b) ProjectsCarousel `slugs` + maquette-industrielle.astro modifiés, NON commités ; (c) propositions machines A/B/C faites par architecte (captures `$TEMP/.../scratchpad/machines/machines-{A,B,C}-{1440,375}.png`, recommandée B = H2C grande carte + lignes compactes 2 colonnes, texte direct sans bloc/trait ; à reporter par executant-ui si Nolann choisit) ; MachinesStrip.astro = ancien encadré (staged). testeur a5d10e325919c09ce : rebuild (serveur 4399) + vérif poster (1 requête webp avant scroll, écart < 5) + carrousel industriel 375-1920. Ensuite : pop-up machines -> executant-ui, commits locaux fichier par fichier (pas shop.astro), item 3 Boxtal, 4, 5 audit. Passation prête (SUIVI à jour).

## À reporter au code Astro
- « PETG HF » → « PETG » (`prisma/seed.ts:64`, migration base : accord de Nolann avant push).
- SEO : retirer « (MAQUETTE 08/11/2026) » du titre/canonical/JSON-LD si resté, og:image:alt figé faux dans BaseLayout (« Objets liturgiques… »), `[data-rv]` masqué seulement si JS.
- Cholet/Angers : 301 → /impression-3d-nantes, retrait liens pied de page + sitemap (après contrôle clics Search Console ≈ 0). Lien `{{ nav.href }}` (404) à chercher dans `src/`.
- Reste Google Fonts : `admin.astro` (fait local), `shop.astro` (Barlow, pas à nous), Leaflet unpkg, scripts Boxtal du panier bloquants.
- Caddy (compression, cache HTML, HSTS, 301 anciens slugs) = dev de Nolann.

## Questions en attente (pop-up au retour de Nolann)
- Pinch mobile et zoom clavier absents du zoom (optionnel).
- KPI hero « 2 sem. – 3 mois… » : texte littéral à raccourcir ?
- Ancres ou KPI dans le hero de /maquette-industrielle (optionnel).
- real-17 renommé « Maquettes de design produit » (image non vue) ; reprise rotation auto 2 s ; 4 textes BROUILLON des fiches (caravane : « concession allemande », « centaine de caravanes »).
- Contraste bouton devis ; écrans courts (hero épinglé −27 px à 375×667) ; 12 PNG de captures commités.

## Décisions de Nolann (en vigueur)
Une page par projet = GO ; « Un projet similaire ? » → `/contact` ; rideau A ; carrousel « Nos maquettes » 5 cartes. Validé, ne pas toucher : zoom, « De l'idée à la maquette », bouton devis, « Un bureau d'études… », « Usage », « Ce qui nous distingue », « De la maquette à la petite série », carte « Maquette de design produit », rideau. Guide Ads : `docs/ads_campagne_maquettage_2026-11-02.md`.

## Ce qui n'a pas marché
Navigateur intégré peu fiable pour scroll/rAF → Chrome headless + playwright-core. Lecture entière des maquettes (56 et 109 Ko) → boucles de compaction. Sélecteur `+` cassé par les `<script>` intercalés. 404 console à 375 px dans le zoom : non reproduit après rebuild (0 réponse >= 400). Zoom : la carte est un lien étiré (`.pj-link::after`) dont le clic est intercepté par JS (ProjectsCarousel l.561) = voulu, vraie page pour no-JS/ctrl-clic ; Playwright `locator.click` expire à cause de ça, pas un bug.

## Conversations à supprimer
Aucune (ancienne session déjà supprimée). Agents lancés cette session : terminés sauf testeur en cours.
