# SUIVI : état courant (08/11/2026)

Archives : `docs/chantiers/suivi-storyboard-v3_2026-11-04.md` (demandes 1-6, détails v3, liste à supprimer) ; rendus v3 → `docs/chantiers/storyboard-v3-rendus_2026-11-04.md` ; v2 → `docs/chantiers/storyboard-v2-publie_2026-11-04.md`.
Items 6 à 10 « faits, à valider » (Boxtal, éclaté, onde de choc, audit SEO) + leurs questions en attente : `docs/chantiers/fait-a-valider_items-6-9_2026-11-05.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Branche locale `claude/maquettage-b2b` (~90 commits), NON poussée : /maquettiste-nantes + /maquette-industrielle, maintenance fusionnée, storyboard cellule en hero, maquettes 08. Push seulement sur le « oui » de Nolann ; avant : scan `claude-security` (fil principal), tests/build (testeur), Nolann coche les 4 événements webhook Stripe.
Storyboard : `src/components/StoryboardCellule.astro`, JS `public/storyboard/cellule/cellule.js` (GSAP 3.12.5 auto-hébergé), séquences webp 960 px q85.

## En attente de Nolann (un seul pop-up)
Les questions des items 6-10 (voir le fichier ci-dessus) + celles de l'item 5 ci-dessous.

## File
1. [ ] Bandeau LED plus souple (4 tronçons faits, à confirmer sur captures sinon refaire `--stage=elec`, Opus).
5. [ ] **Maquettes 08 (`docs/maquettes/carrousel-projets_2026-11-08.html` + `page-maquettiste-nantes_2026-11-08.html`) : retours n2 + n3 de Nolann À APPLIQUER** (rien encore modifié pour n2/n3 ; dernier commit maquettes 79397d5 = retours n1).
   - Retours : dossier de notes de local_5eab4690 → `retours-nolann-n2_2026-11-08.md` (points 1-8) + `retours-n2_cartes-chiffres.png`, `retours-nolann-n3_2026-11-08.md` (points 9-12).
   - **Plan complet, repères de lignes, méthode : `passation-maquettes-08-n23.md` (même dossier de notes).** Recherches faites : `recherches-n2_animations-transitions_2026-11-08.md` (icônes animées « Et encore plus » retrouvées avec leur CSS exact, cause du survol cassé, 3 pistes de transition avec références). Fiche chantier : `docs/chantiers/maquettes-carrousel-page-08_2026-11-08.md`.
   - Méthode : page-08 = base, éditée directement (`build_page_0811.py` OBSOLÈTE, garde `sys.exit`) ; carrousel-08 = source unique des blocs PJ:CSS/DATA/TPL/JS → `outils-maquettes-08/sync_pj.py --write` ; PJ:HTML reporté à la main. Captures : `outils-maquettes-08/caps_serie.sh <dossier>` ; « avant » dans `planches-maquettes-08/avant-n23/` (0 débordement).
   - Décisions de Nolann (n3, pop-up 08/11) : « Blocs courts » + « Animé au scroll » = page par défaut ; pages par projet = GO (seulement si ~300 mots uniques ; drapeau `fiche` dans PJ:DATA, câblage Astro plus tard) ; « Un projet similaire ? » → `/contact` simple ; « Quatre types » : il y en aura de plus en plus → mise en page qui s'adapte (flex-wrap), variante « Liste » retirée.
   - Questions pour Nolann (pop-up unique, après les retouches) : a) transition hero → storyboard : A rideau (recommandée) / B carte arrondie / C sortie CSS native ; b) « Lire la suite » revient-il pour les blocs longs en Blocs courts ? c) renommer le h2 « Quatre types… » (ex. « Nos types de maquettes sur mesure ») ? d) caravane : une seule vraie photo dans le dépôt, en fournir d'autres ? e) flèches du carrousel masquées aux extrémités OK ?
   - Après : passe perf (`pistes-optimisation-perf.md`, notes partagées) ; reporter `.split > *{min-width:0}` dans le CSS Astro.
11. [ ] Corrections SEO (voir audit) après son accord.
12. [ ] **Onde de choc trop grosse/violente (05/11 soir)** : 5 previews A-E prêtes sur http://localhost:4350/storyboard/cellule/preview-onde.html (fichier temporaire `public/storyboard/cellule/preview-onde.html`, NON commité, à supprimer après choix). Attendre son choix, puis intégrer dans `cellule.js` (executant-ui).
13. [ ] **Refonte structure /maquettiste-nantes** : en cours via les maquettes 08 (item 5). Garder TOUT le texte (SEO), le structurer et le rendre vivant. Ordre voulu : hero → storyboard → « Maquettes interactives et intégration électronique » (visuels remontés) → bureau d'études + atelier, Pour qui, Comment ça se passe, Quatre types, Au-delà de la maquette, Ce qui distingue → carrousel de projets → FAQ → CTA. Sections actuelles : `src/pages/maquettiste-nantes.astro` ~155-289. Ne pas casser titres/meta/JSON-LD/H1 unique.
15. [ ] **Suites de l'audit SEO** : a) autorité/backlinks (3Dnatives, CCI, French Tech) + fiche Google Business Profile APRÈS la mise en ligne B2B ; b) objectif « meilleur de France » : baseline Search Console + Plausible d'abord ; c) bouton « Demander un devis » (quasi invisible mobile) + perf « premier affichage rapide, animation après » (hero statique, H1 sans opacity:0, polices/CSS inline, frames en fond, compression Caddy) : rapport §10.
14. [ ] **Le « N » animé de l'accueil (NPrintLogo.tsx) ne s'anime pas** : probable échec d'hydratation en dev worktree (403 Vite `@fs`), mais « pas pour la première fois » → vérifier sur un build prod / le site en ligne.

## Ce qui n'a pas marché
- Console dev worktree : 403 Vite `@fs` + hydratation React = connu, hors sujet.
- Navigateur intégré peu fiable pour scroll/capture → Chrome headless / `cap.cjs` (Playwright).
- Testeur Haiku a dit « hélices non groupées » sur l'éclaté ; vérifié à l'œil : correct.
- Maquettes 08 : la fille local_2827b498 est tombée en boucle de compaction (lectures entières de fichiers de 56 et 109 Ko) ; la session suivante a aussi bouclé. **Lire les maquettes par extraits (offset/limit, grep), jamais en entier ; déléguer l'écriture à executant-ui.**
- PowerShell 5.1 : `python -c` avec guillemets casse et peut relancer la commande suivante → écrire un petit script. JSON des étapes de `cap.cjs` entre guillemets simples en bash.

## Prochain pas exact
1. Item 5 : suivre le plan de `passation-maquettes-08-n23.md` (executant-ui A sur carrousel-08 : points 6, 7, 11 ; executant-ui B sur page-08 : points 3, 4, 5, 6, 8, 9, 10 ; en parallèle, un fichier chacun) → `sync_pj.py --write` → point 1 → pop-up unique → point 2 → seo_diff, caps `apres-n23`, planches, commit local `docs/maquettes/`, advisor avant « fini ».
2. Pop-up des questions items 6-10 ; Boxtal : vérifier le champ réel (item 7).
3. Advisor avant « fini » ; republier Artifact 9az7LYrVJrfeLZzEiMFQsU (le LIRE d'abord) avec page_v3 ; scan claude-security ; push sur « oui ».
4. Ménage : http.server 4371 (PID 26140), http.server 4380 des maquettes 08 (PID 46448, à garder tant que l'item 5 tourne), dev 4350 (PID 22244) ; pop-up unique de suppression des conversations (local_75c60f2f « fini, supprimable », local_ae7e1921, local_117c8401, local_e79981e6, local_2827b498 « maquettes 08 » coincée, l'ancienne « Nasap3D [maquette] carrousel + page, Opus (à supprimer) » une fois remplacée, sous-sessions finies) ; log conso dans `C:/bo-test/docs/conso_sessions.md`.
