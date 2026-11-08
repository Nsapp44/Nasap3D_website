# SUIVI : état courant (08/11/2026, soir)

Archives : `docs/chantiers/suivi-storyboard-v3_2026-11-04.md`, `storyboard-v3-rendus_2026-11-04.md`, `storyboard-v2-publie_2026-11-04.md`. Items 6-10 « faits, à valider » : `docs/chantiers/fait-a-valider_items-6-9_2026-11-05.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Branche locale `claude/maquettage-b2b` (~95 commits), NON poussée. Push seulement sur le « oui » de Nolann ; avant : scan `claude-security` (fil principal), tests/build, Nolann coche les 4 événements webhook Stripe.
Commits maquettes : cb2ae8d (retours n2/n3), 3aa6a07 (bandeau chiffres 2×2), puis transition rideau (voir « Prochain pas »).

## Organisation des conversations
Principale = « [P] NASAP [maquettes 08] flèches zoom + responsive » (groupe « Nasap3D site »). Fille SEO `local_9225f6e4` : audit fini (commit 09b5904, notes `docs/chantiers/seo-perf-maquettes-08_2026-11-08.md` + `gabarit-seo_realisations-slug_2026-11-08.md`), ARCHIVÉE le 08/11, partage le worktree de la principale : à supprimer en fin de chantier. Règle : vérifier les forks avant tout `delete_session` d'une principale.
Liste de conversations à supprimer : fille SEO (ci-dessus) ; fork audit SEO `local_e1401fb4` : FINI (confirmé 08/11, aucune tâche de fond), rapport final commité f8869ed (`docs/chantiers/audit-seo-nouveaux-outils_2026-11-08.md`) ; supprimable en fin de chantier (vérifier qu'il n'a plus de tâche de fond).
Rideau PLEINE PAGE appliqué (plan `docs/chantiers/rideau-page-entiere_2026-11-08.md`, captures avant/après `docs/chantiers/notes-sessions_2026-11-08/rideau-pleine-page/`) : hero épinglé par translate qui recule, `<div class="rideau">` (storyboard → fin de main) remonte avec coins 28px ; mesuré OK 375/768/1440/1920 + écrans courts + reduced-motion. À valider par Nolann ; jonction 2 (avant #nos-maquettes) optionnelle non faite ; Firefox = page normale, Safari 26 requis (non vérifié).
Règle modèle (Nolann 08/11) : Sonnet 90 % ; restructuration/maquette/design complexe → Opus dans la même conversation (`set_session_model`), sans demander, retour à Sonnet pour le code (mémoire `opus-sonnet-bascule-site`).
Guide Google Ads « Maquettage B2B » (3 €/jour, 3 semaines) : `docs/ads_campagne_maquettage_2026-11-02.md`, envoyé à Nolann le 08/11 ; publication seulement après push et pages en 200.

## Maquettes 08 : où on en est
Fichiers : `docs/maquettes/carrousel-projets_2026-11-08.html` (source unique des blocs PJ:CSS/DATA/TPL/JS) et `page-maquettiste-nantes_2026-11-08.html`. Synchro : `outils-maquettes-08/sync_pj.py --write` puis sans option ; PJ:HTML à la main. Captures : `outils-maquettes-08/cap.cjs`, `caps_serie.sh <dossier>`. Serveur `python -m http.server 4380` (PID 46448). **Fichiers de 56 et 109 Ko : extraits seulement (cause des boucles de compaction).** Ne pas toucher `public/storyboard/cellule/preview-onde.html`, `src/`.

FAIT : point 1 bandeau chiffres 2×2 (validé) ; point 2 transition hero → storyboard : rideau PLEINE PAGE (commit 044d47a, voir l.12), conçu par `architecte`, mesuré 4 largeurs + écrans courts + reduced-motion ; sync_pj identique, seo_diff 0 écart (vérifié 08/11). Écrans courts : hero épinglé coupé en haut (−27 px à 375×667, −178 px à 740×360) = à trancher par Nolann. Seules 1440 et 375×740 regardées à l'œil. 404 console préexistant non identifié. Outils : `docs/chantiers/notes-sessions_2026-11-08/local_5eab4690-e7a9-4711-827e-4e6ade9ac193/outils-maquettes-08/`. 12 PNG de captures commités (Nolann décide de les garder).

RESTE :
1. Montrer en captures à Nolann puis redemander : « Lire la suite » en Blocs courts, h2 « Quatre types… », flèches du carrousel masquées aux extrémités, « machines SP » = machines spéciales.
2. Caravane : la photo est un rendu ChatGPT, « on ment en fait » → la retirer ou la marquer illustration (à trancher) ; contenu fiche : `docs/chantiers/fiche-projet-caravane_brouillon_2026-11-08.md`.
3. SEO : Plausible suffit (pas d'outil A/B) ; corriger le contraste du bouton devis ; à reporter au code Astro (liste de la fille SEO) : pas d'opacity:0 sur le H1, polices locales, fetchpriority image hero, `[data-rv]` masqué seulement si JS, retirer « (MAQUETTE 08/11/2026) » du titre + canonical + JSON-LD, pages `/realisations/<slug>` + sitemap, Caddy compression/301 www (dev de Nolann).
4. Question de Nolann restée coupée (« Mais… ») : à redemander si besoin.
5. Plus tard : scan `claude-security` avant push ; passe perf (Lighthouse prod) ; arrêter le serveur 4380 ; note « 1 sem. – 1 mois » (aside-kpi) sur 2 lignes à 375.

6. SEO ordre du rapport (`docs/chantiers/audit-seo-nouveaux-outils_2026-11-08.md`, validé par Nolann) : lien accueil → /impression-3d-nantes (titre accueil figé jusqu'au ~30/11) ; Caddy (dev de Nolann) ; Cholet/Angers contenu local ou noindex (à valider) ; pages « pièce cassée », matériaux, 1 commune, llms.txt, favicon, lastmod ; hors site : French Tech/French Fab, 3Dnatives, annuaires. Meta descriptions : ne pas raccourcir (Bing les veut plus longues) ; ?trk=/UTM voulus. Rien envoyé sans accord.

## Décisions de Nolann (en vigueur)
Une page par projet = GO (~300 mots uniques, sans nom de client, projets avec histoire et photos ; pas les machines à tuyaux sans go client) ; drapeau `fiche` dans PJ:DATA ; « Un projet similaire ? » → `/contact` ; « Quatre types » = flex-wrap ; « Blocs courts » + « Animé au scroll » par défaut ; transition hero → storyboard = rideau A. Validé, ne pas toucher : zoom, « De l'idée à la maquette », bouton devis, « Un bureau d'études… », « Usage », « Ce qui nous distingue », « De la maquette à la petite série », carte « Maquette de design produit ».

## Autres items en file
Bandeau LED plus souple ; onde de choc (5 previews, attendre le choix) ; refonte /maquettiste-nantes = maquettes 08 (tout le texte SEO, 1 seul H1) ; « N » animé de l'accueil à vérifier sur build prod ; suites SEO (backlinks, Google Business Profile).

## Ce qui n'a pas marché
- Console dev worktree : 403 Vite `@fs` + hydratation React = connu. Navigateur intégré peu fiable pour scroll/capture → Chrome headless / `cap.cjs`.
- Lecture entière des maquettes → boucles de compaction (3 fois). Écriture déléguée à executant-ui.
- Bandeau 4 colonnes rognait « France » → 2×2.

## Prochain pas exact
Nolann valide le rideau (captures envoyées) ; sinon renforcer l'ombre ou ajouter la jonction 2. Puis RESTE 1-5 ; passation ensuite ; fin de chantier : pop-up pour supprimer fille SEO + fork SEO.
