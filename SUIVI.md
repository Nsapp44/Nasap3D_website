# SUIVI : état courant (04/11/2026, nuit)

Archives : SUIVI précédent intégral → `docs/chantiers/suivi-storyboard-v3_2026-11-04.md` (demandes 1-6, détails v3, maintenance fusionnée, liste à supprimer) ; rendus v3 → `docs/chantiers/storyboard-v3-rendus_2026-11-04.md` ; v2 → `docs/chantiers/storyboard-v2-publie_2026-11-04.md` ; avant storyboard → `docs/chantiers/suivi-avant-storyboard_2026-11-03.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Branche locale `claude/maquettage-b2b`, NON poussée : pages `/maquettiste-nantes` + `/maquette-industrielle`, maintenance fusionnée, et **bd30e19 = storyboard cellule en hero de /maquettiste-nantes**. Push seulement sur le « oui » de Nolann ; avant : scan `claude-security` (fil principal) + tests/build (testeur) + Nolann coche les 4 événements webhook Stripe.

## Intégration (bd30e19, faite par executant-ui, relue sur captures)
- `src/components/StoryboardCellule.astro` (racine `.sb`, `<style is:global>` préfixé `.sb`), JS `public/storyboard/cellule/cellule.js`, images `public/storyboard/cellule/{aimant3,eclate3,elec,led,lumiere3}`, GSAP 3.12.5 auto-hébergé `public/vendor/gsap/` (licence « no charge », usage commercial OK).
- Placé juste après le lp-hero (H1 SEO gardé, seul h1) ; titre storyboard = `<p class="sb-title">`. Scroll : sticky dans scène 600vh, ScrollTrigger top top → bottom bottom ; override `html:has(.sb), body:has(.sb){overflow-x:clip}` (sinon sticky cassé).
- Légendes : test de collision, 0 chevauchement mesuré 375/768/1440 (9 progressions), 0 scroll horizontal. Reduced-motion / no-JS = version statique OK.
- Captures : scratchpad de la conversation 28247dd9 (`s_{375,768,1440}_an_*.png`, `s_375_rm_0.png`) — temporaires, à refaire.
- Non vérifié : `astro build`/check, poids ajouté, Firefox/Safari, Windows thème sombre.

## Ce qui n'a pas marché et pourquoi
- Console dev : 403 Vite `@fs` + hydratation React du header ratée = problème connu du worktree (pas du storyboard), pas de config commitée.
- Volet navigateur intégré : scroll/capture peu fiables → captures Chrome headless (testeur).

## Décisions de Nolann (04/11 nuit, oral)
- Trait de liaison point → pill sur mobile quand la pill est décalée : OUI.
- Texte storyboard calé à gauche (x=80) à 1440 : GARDER tel quel, « ça me choque pas ».
- Fin de l'animation : PAS de fond vide → montrer le produit fini avec les LED allumées (réutiliser `led/cell.webp` + glow, ou la dernière image LED) sous la dernière battue.
- FAQ « devis sur mesure et gratuit » : GARDER (validé par Nolann ; la règle « pas de gratuit » ne s'applique pas à cette ligne FAQ).
- « Optimise tout ça, prépare la page, intègre-la au reste de la page » : la transition storyboard → sections existantes (bureau d'études, prototypes, atouts, timeline, FAQ, CTA final) doit être fluide et cohérente (espacements, alignements, rythme), poids optimisé (lazy-load des séquences hors 1re, mobile < 450 Ko au chargement initial). Puis LUI MONTRER la page complète (captures pleine page 375/768/1440 via SendUserFile) « juste après ».

## Questions en attente (un seul pop-up AskUserQuestion à Nolann)
- H1 : H1 SEO gardé au-dessus du storyboard (défaut actuel) — à confirmer sur captures.
- Cartes « Et encore plus » de page_v3 retirées (doublon des atouts) : OK ?
- Torsades el28 gardées / sens de levée des aimants / « Électronique intégrée, complice » / lumière T4 : défauts détaillés dans l'archive.

## Prochain pas exact
0. executant-ui : appliquer les décisions de Nolann ci-dessus (trait mobile, fin = produit fini LED allumées, intégration fluide au reste de la page, optimisation poids). Puis captures + vérif 0 chevauchement.
1. testeur : `npx astro build` (arrière-plan) + poids ajouté par le storyboard sur mobile + 0 « € »/gratuit/avant paiement dans les fichiers ajoutés ; captures avant/après de la page 375/768/1440.
2. Republier l'Artifact https://claude.ai/artifact/9az7LYrVJrfeLZzEiMFQsU (le LIRE d'abord) avec page_v3 à jour (`Source machine/glb/storyboard/page_v3/`, nouveau ruban LED + coords ELEC).
3. Montrer à Nolann (captures via SendUserFile) + pop-up des questions ci-dessus ; advisor final.
4. Ménage : arrêter http.server port 4371 (PID 26140) par PID ; `delete_session` groupé [ancienne conv « (à supprimer) », local_117c8401, local_e79981e6] après pop-up ; serveur dev 4350 (PID 22244) en fin de chantier.
5. Puis vérif visuelle complète de /maquettiste-nantes + /maquette-industrielle, et push sur « oui ».
