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
2. [~] 4b fluidité du scroll storyboard : mesure confiée au testeur (long tasks, frames > 33 ms). Rien de mesurable = « aucun changement, déjà fluide » (Nolann le trouve « très bien »).
3. [ ] Boxtal : suivi AUTO Mondial Relay (NE RIEN CASSER). `advisor` avant de figer l'approche ; OK de Nolann pour un dump JSON lecture seule de `order_status/{ref}/informations` sur une commande MR réelle ; ajouter le n° saisi à la main à `TRACKING_KEY_RE` (`src/lib/server/boxtal.ts` ~576).
4. [ ] Demande orale de Nolann (09/11) : « la passe de grosso modo » sur le rapport de la conversation SEO, une fois tout le reste fini. Sens probable : appliquer la liste « À reporter au code Astro » ci-dessous (rapport `docs/chantiers/audit-seo-nouveaux-outils_2026-11-08.md`). À confirmer par pop-up avant de coder.

5. [ ] Demande orale de Nolann (09/11) : à la toute fin, audit de performance (Lighthouse avant/après) ET de sécurité (scan `claude-security` depuis le fil principal) pour confirmer que tout va bien.

## Prochain pas exact
Résultat testeur (4b, 404 à 375, FAQ) -> commit SUIVI -> `get_usage` + ligne `C:/bo-test/docs/conso_sessions.md` -> advisor (2e appel) -> arrêter serveur 4399 par PID -> rapport « prêt à vérifier » avec captures avant/après (`$TEMP/4f/avant_*`, `apres_*`) -> pop-up 3D d'abord ? -> item 3 puis 4.

## À reporter au code Astro
- « PETG HF » → « PETG » (`prisma/seed.ts:64`, migration base : accord de Nolann avant push).
- SEO : retirer « (MAQUETTE 08/11/2026) » du titre/canonical/JSON-LD si resté, og:image:alt figé faux dans BaseLayout (« Objets liturgiques… »), `[data-rv]` masqué seulement si JS.
- Cholet/Angers : 301 → /impression-3d-nantes, retrait liens pied de page + sitemap (après contrôle clics Search Console ≈ 0). Lien `{{ nav.href }}` (404) à chercher dans `src/`.
- Reste Google Fonts : `admin.astro` (fait local), `shop.astro` (Barlow, pas à nous), Leaflet unpkg, scripts Boxtal du panier bloquants.
- Caddy (compression, cache HTML, HSTS, 301 anciens slugs) = dev de Nolann.

## Questions en attente (pop-up au retour de Nolann)
- Slide 3D = 2e de 3 dans le zoom du carrousel : la 3D ne démarre qu'au swipe ou au chip « Vue 3D ». Mettre la 3D en 1re, ouvrir sur la 3D, ou précharger e28 à l'ouverture ?
- Pinch mobile et zoom clavier absents du zoom (optionnel).
- KPI hero « 2 sem. – 3 mois… » : texte littéral à raccourcir ?
- Ancres ou KPI dans le hero de /maquette-industrielle (optionnel).
- real-17 renommé « Maquettes de design produit » (image non vue) ; reprise rotation auto 2 s ; 4 textes BROUILLON des fiches (caravane : « concession allemande », « centaine de caravanes »).
- Contraste bouton devis ; écrans courts (hero épinglé −27 px à 375×667) ; 12 PNG de captures commités.

## Décisions de Nolann (en vigueur)
Une page par projet = GO ; « Un projet similaire ? » → `/contact` ; rideau A ; carrousel « Nos maquettes » 5 cartes. Validé, ne pas toucher : zoom, « De l'idée à la maquette », bouton devis, « Un bureau d'études… », « Usage », « Ce qui nous distingue », « De la maquette à la petite série », carte « Maquette de design produit », rideau. Guide Ads : `docs/ads_campagne_maquettage_2026-11-02.md`.

## Ce qui n'a pas marché
Navigateur intégré peu fiable pour scroll/rAF → Chrome headless + playwright-core. Lecture entière des maquettes (56 et 109 Ko) → boucles de compaction. Sélecteur `+` cassé par les `<script>` intercalés. 404 console à 375 px dans le zoom : en cours d'identification.

## Conversations à supprimer
Aucune (ancienne session déjà supprimée). Agents lancés cette session : terminés sauf testeur en cours.
