# SUIVI : état courant (08/11/2026, fin d'après-midi)

Archives : `docs/chantiers/suivi-storyboard-v3_2026-11-04.md`, `storyboard-v3-rendus_2026-11-04.md`, `storyboard-v2-publie_2026-11-04.md`. Items 6-10 « faits, à valider » : `docs/chantiers/fait-a-valider_items-6-9_2026-11-05.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Branche locale `claude/maquettage-b2b` (~92 commits), NON poussée. Push seulement sur le « oui » de Nolann ; avant : scan `claude-security` (fil principal), tests/build, Nolann coche les 4 événements webhook Stripe.
Dernier commit maquettes : **cb2ae8d** (retours n2/n3 appliqués par 2 executant-ui, blocs PJ resynchronisés).

## Organisation des conversations (fait le 08/11)
Principale = « [P] NASAP [maquettes 08] flèches zoom + responsive » (groupe « Nasap3D site »). Fille SEO : `local_9225f6e4` « Nasap3D [SEO] suite audit + perf » (idle, à interroger pour SEO/perf ; NE PAS supprimer). Les 3 anciennes (B2B, carrousel Opus, SEO audit) sont SUPPRIMÉES ; leurs notes sont dans `docs/chantiers/notes-sessions_2026-11-08/local_5eab4690-.../` (commit e962f49).
Liste de conversations à supprimer : aucune pour l'instant (l'ancienne de passation, si elle existe, y sera ajoutée).

## Maquettes 08 (item 5) : où on en est
Fichiers : `docs/maquettes/carrousel-projets_2026-11-08.html` (source unique des blocs PJ:CSS/DATA/TPL/JS) et `page-maquettiste-nantes_2026-11-08.html`. Synchro : `outils-maquettes-08/sync_pj.py --write` puis sans option (vérif) ; PJ:HTML à la main. Captures : `outils-maquettes-08/caps_serie.sh <dossier>` (dossier `apres-n23`), « avant » dans `planches-maquettes-08/avant-n23/`. Serveur `python -m http.server 4380` (PID 46448, mono-thread). **Fichiers de 56 et 109 Ko : lire par extraits (grep, offset/limit), jamais en entier (cause des boucles de compaction).** Page 05 = référence « avant », intouchable. Ne pas toucher `public/storyboard/cellule/preview-onde.html`, `src/`.

FAIT (cb2ae8d, non vérifié au navigateur) : carrousel centré dans la colonne, avance par blocs (MIN_CARD 240, pas de trou), badge unique « 360° », `#pj-fiches` (4 projets avec fiche : filtration, bioréacteur, cellule, caravane), icônes animées « Et encore plus » dans la section électronique, h2 « Maquettes interactives, intégration électronique et design produit », carte « Maquette industrielle » animée (translate), « Lire la suite » animé WAAPI, défauts « Blocs courts » + « Animé au scroll », « Le saviez-vous » retiré, `#types-cards` flex-wrap.

RESTE :
1. **Point 1 : cartes chiffres du hero** (« 1 sem. – 1 mois » casse sur 2 lignes ; garder les 4 infos). Piste : bandeau compact, filets fins, valeur blanche nowrap ~17 px, légende ~12,5 px, orange en accent. Markup `<div class="kpis hero-in">` page-08 ~l.530, CSS `.kpi` l.65-68/205/216/224 ; ne pas casser `.aside-kpi .kpi` (~l.615). Conception `architecte` (design sans base) puis `executant-ui`.
2. **Point 2 : transition hero → storyboard** : attend la réponse de Nolann (A rideau recommandée / B carte arrondie / C CSS natif ; refs dans `recherches-n2_animations-transitions_2026-11-08.md`), puis `architecte` + `executant-ui`.
3. **Pop-up unique à Nolann** : transition A/B/C ; « Lire la suite » pour blocs longs en Blocs courts ? ; renommer le h2 « Quatre types… » ; caravane : une seule photo dans le dépôt, en fournir d'autres ? ; flèches du carrousel masquées aux extrémités OK ? ; SEO : outils A/B (reco A), qui parle au dev pour Caddy/301 www/compression, contraste du bouton devis ; confirmer « machines SP » = machines spéciales ; contenu de la fiche caravane (`docs/chantiers/fiche-projet-caravane_brouillon_2026-11-08.md`, à compléter : échelle, matériaux, délai, photos).
4. **Vérifs** : `seo_diff.py`, 0 débordement à 375/768/1024/1180×820/1440/1920 (`caps_serie.sh apres-n23`), test carrousel N = 5, 7, 11, planches avant/après, regarder les captures. Puis commit local ciblé, advisor avant « fini », ligne dans `C:/bo-test/docs/conso_sessions.md`.
5. Plus tard : scan `claude-security` avant push ; passe perf avec la fille SEO (`pistes-optimisation-perf.md`) ; reporter `.split > *{min-width:0}` dans le CSS Astro ; pages `/realisations/<slug>` (gabarit SEO dans les notes de session) ; arrêter le serveur 4380 en fin de chantier.

## Décisions de Nolann (en vigueur)
Une page par projet = GO (seulement si ~300 mots uniques, sans nom de client, projets avec histoire et photos suffisantes ; pas les machines à tuyaux tant que les clients n'ont pas donné leur go) ; drapeau `fiche` dans PJ:DATA ; « Un projet similaire ? » → `/contact` ; « Quatre types » = flex-wrap, variante « Liste » retirée ; « Blocs courts » + « Animé au scroll » par défaut. Validé, ne pas toucher : zoom (fermeture, suivant/précédent), « De l'idée à la maquette », bouton devis, « Un bureau d'études… », « Usage », « Ce qui nous distingue », « De la maquette à la petite série », carte « Maquette de design produit ».

## Autres items en file
1. Bandeau LED plus souple (à confirmer sur captures). 11. Corrections SEO après accord. 12. Onde de choc : 5 previews A-E (`preview-onde.html`, non commité, à supprimer après choix), attendre le choix de Nolann. 13. Refonte /maquettiste-nantes = maquettes 08 (garder tout le texte SEO, 1 seul H1). 14. « N » animé de l'accueil à vérifier sur build prod. 15. Suites SEO : backlinks, Google Business Profile après mise en ligne B2B, perf « premier affichage rapide ».

## Ce qui n'a pas marché
- Console dev worktree : 403 Vite `@fs` + hydratation React = connu.
- Navigateur intégré peu fiable pour scroll/capture → Chrome headless / `cap.cjs`.
- Lecture entière des maquettes → boucles de compaction (déjà 3 fois). Extraits seulement, écriture déléguée à executant-ui.
- PowerShell 5.1 : `python -c` avec guillemets casse → petit script.

## Prochain pas exact
Point 1 (cartes chiffres du hero) via `architecte` puis `executant-ui`, puis vérifs (4), puis pop-up unique (3), puis point 2 selon la réponse.
