# SUIVI : état courant (08/11/2026, soir)

Archives : `docs/chantiers/suivi-storyboard-v3_2026-11-04.md`, `storyboard-v3-rendus_2026-11-04.md`, `storyboard-v2-publie_2026-11-04.md`. Items 6-10 « faits, à valider » : `docs/chantiers/fait-a-valider_items-6-9_2026-11-05.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Branche locale `claude/maquettage-b2b` (~95 commits), NON poussée. Push seulement sur le « oui » de Nolann ; avant : scan `claude-security` (fil principal), tests/build, Nolann coche les 4 événements webhook Stripe.
Commits maquettes : cb2ae8d (retours n2/n3), 3aa6a07 (bandeau chiffres 2×2), puis transition rideau (voir « Prochain pas »).

## Organisation des conversations
Principale = « [P] NASAP [maquettes 08] flèches zoom + responsive » (groupe « Nasap3D site »). Fille SEO `local_9225f6e4` : audit fini (commit 09b5904, notes `docs/chantiers/seo-perf-maquettes-08_2026-11-08.md` + `gabarit-seo_realisations-slug_2026-11-08.md`), ARCHIVÉE le 08/11, partage le worktree de la principale : à supprimer en fin de chantier. Règle : vérifier les forks avant tout `delete_session` d'une principale.
Liste de conversations à supprimer : fille SEO (ci-dessus).
Guide Google Ads « Maquettage B2B » (3 €/jour, 3 semaines) : `docs/ads_campagne_maquettage_2026-11-02.md`, envoyé à Nolann le 08/11 ; publication seulement après push et pages en 200.

## Maquettes 08 : où on en est
Fichiers : `docs/maquettes/carrousel-projets_2026-11-08.html` (source unique des blocs PJ:CSS/DATA/TPL/JS) et `page-maquettiste-nantes_2026-11-08.html`. Synchro : `outils-maquettes-08/sync_pj.py --write` puis sans option ; PJ:HTML à la main. Captures : `outils-maquettes-08/cap.cjs`, `caps_serie.sh <dossier>`. Serveur `python -m http.server 4380` (PID 46448). **Fichiers de 56 et 109 Ko : extraits seulement (cause des boucles de compaction).** Ne pas toucher `public/storyboard/cellule/preview-onde.html`, `src/`.

FAIT : point 1 bandeau chiffres 2×2 (validé « plus propre ») ; point 2 transition « rideau » A choisie par Nolann : CSS natif `animation-timeline: view()` sur `.sb-frame` (clip-path), sous `@supports` + `no-preference`, +8 lignes l.81 de la page ; vérifié : 0 débordement 375/768/1440/1920, reduced-motion = rien, mi-course OK (`planches-maquettes-08/rideau/`), seo_diff 0 écart.

RESTE :
1. Montrer en captures à Nolann puis redemander : « Lire la suite » en Blocs courts, h2 « Quatre types… », flèches du carrousel masquées aux extrémités, « machines SP » = machines spéciales.
2. Caravane : la photo est un rendu ChatGPT, « on ment en fait » → la retirer ou la marquer illustration (à trancher) ; contenu fiche : `docs/chantiers/fiche-projet-caravane_brouillon_2026-11-08.md`.
3. SEO : Plausible suffit (pas d'outil A/B) ; corriger le contraste du bouton devis ; à reporter au code Astro (liste de la fille SEO) : pas d'opacity:0 sur le H1, polices locales, fetchpriority image hero, `[data-rv]` masqué seulement si JS, retirer « (MAQUETTE 08/11/2026) » du titre + canonical + JSON-LD, pages `/realisations/<slug>` + sitemap, Caddy compression/301 www (dev de Nolann).
4. Question de Nolann restée coupée (« Mais… ») : à redemander si besoin.
5. Plus tard : scan `claude-security` avant push ; passe perf (Lighthouse prod) ; arrêter le serveur 4380 ; note « 1 sem. – 1 mois » (aside-kpi) sur 2 lignes à 375.

## Décisions de Nolann (en vigueur)
Une page par projet = GO (~300 mots uniques, sans nom de client, projets avec histoire et photos ; pas les machines à tuyaux sans go client) ; drapeau `fiche` dans PJ:DATA ; « Un projet similaire ? » → `/contact` ; « Quatre types » = flex-wrap ; « Blocs courts » + « Animé au scroll » par défaut ; transition hero → storyboard = rideau A. Validé, ne pas toucher : zoom, « De l'idée à la maquette », bouton devis, « Un bureau d'études… », « Usage », « Ce qui nous distingue », « De la maquette à la petite série », carte « Maquette de design produit ».

## Autres items en file
Bandeau LED plus souple ; onde de choc (5 previews, attendre le choix) ; refonte /maquettiste-nantes = maquettes 08 (tout le texte SEO, 1 seul H1) ; « N » animé de l'accueil à vérifier sur build prod ; suites SEO (backlinks, Google Business Profile).

## Ce qui n'a pas marché
- Console dev worktree : 403 Vite `@fs` + hydratation React = connu. Navigateur intégré peu fiable pour scroll/capture → Chrome headless / `cap.cjs`.
- Lecture entière des maquettes → boucles de compaction (3 fois). Écriture déléguée à executant-ui.
- Bandeau 4 colonnes rognait « France » → 2×2.

## Prochain pas exact
Commit local de la transition rideau + SUIVI ; advisor avant « fini » ; montrer à Nolann les petits points restants (RESTE 1) en captures ; rapport final avec le commit en tête.
