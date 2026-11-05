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

## File des demandes
1. [ ] Bandeau LED plus souple/long (S, tronçons WS2812B + fils) : 62c8c01 fait 4 tronçons + fils ; captures 04/11 montrent un ruban courbe à 4 tronçons → à confirmer par Nolann sur les captures, sinon refaire `--stage=elec` (Opus).
2. [x] Traits des pastilles + fin produit fini + gouttière mobile : faits, testeur VERT (0 chevauchement 375/768/1440 p=0.30-0.385, 0 scroll horizontal, build OK, 291 Ko). Captures : scratchpad `caps_v4/`. Commit local en cours.

3. [x] Retours Nolann 04/11 nuit : FAITS, testeur VERT (0 chevauchement, 0 scroll horizontal, build OK). Images 960 px q85 (storyboard 294 Ko initial a 375, 500 Ko a 1440, 1,2 Mo / 2 Mo apres scroll) ; poster flou garde ; anneau de clic aimants (#sb-clk, 0.714-0.729, a 40 %/65 % du cadre, recale sur capture) ; hélices orange/verte écartées (~4 mm au pic) + ESP ne traverse plus la plaque (éclaté). Bouton pzr/pzd/pzw verifie visible. Captures : scratchpad `caps_v6/`, `caps_v7/`.
   A trancher par Nolann : orange/verte restent a 1,1 mm AU REPOS (paraissent se toucher ; corriger = bouger la pose de base, raccord galerie) ; timing ESP éclaté change ; a 1440 l'initial storyboard = 500 Ko (> 450, mobile OK) ; sauvegardes rendus `Source machine/glb/storyboard/out/*_avant_2026-11-04`.
4. [x] Retours Nolann 05/11 : FAITS, a valider par Nolann. Anneau de clic supprime (170a3a4) ; bouton plus motion design : ecrasement, 2 ondes, 6 points (b55950e) ; rendus Blender refaits (277f4a1) : lettres aimant3 fixes (deplacement 0), collisions eclate3 22->5 images / aimant3 2->1 (restants invisibles ou erreur d'estimateur), lumiere3 sans trou du connecteur (`--lum_az=-45`, a noter dans docs/chantiers/storyboard-v3-rendus_2026-11-04.md), ecart orange/vert ~4 mm au pic (1,13 mm au repos). Testeur : 0 chevauchement mesure sauf étape aimants 0.70-0.77 NON PROUVÉE (sonde ne voyait qu'1 élément) ; éclaté regardé à l'œil 1440/375 (caps_ecl) OK ; 0 scroll horizontal, build OK, reduced-motion OK ; captures scratchpad `caps_v8/`. Sauvegardes `out/*_avant_2026-11-05`.
   A trancher : hélices à échelle anisotrope + écart 1,5 (léger changement de style, avant/après cmp5_a_005) ; lettres de l'eclate rattachees au noyau (bougent d'un bloc) ; en fin d'eclate l'aimant passe 20 px SOUS le noyau ; poids storyboard non mesure isolement (page entiere 2,8 Mo initial, JS dominants).
   Collab : session CAO-IA Blender (controle_A.py/expo_A.py lecture seule dans C:o-test\_essais_cao_ialender
iveauA\ ; porte penetration controle_A2.py a venir, a passer sur mes rendus).
5. [ ] Carrousel de projets (05/11) : maquette d'abord (Opus ultracode, état des lieux de l'ancien carrousel Nasap3D). Clic = le projet s'agrandit au premier plan (mobile et PC), croix ou clic à côté = retour au carrousel, motion soigné, histoire longue par projet, maquettes 3D possibles. Pas de page séparée ; texte dans le HTML + adresse par projet (#projet-x), à valider avec l'audit SEO.
6. [ ] Audit SEO complet : carte proposée « Nasap3D [SEO] audit complet, bonne voie ? » (task_8f8f36b8), à démarrer par un clic de Nolann.

## Questions en attente (un seul pop-up AskUserQuestion à Nolann)
- H1 : H1 SEO gardé au-dessus du storyboard (défaut actuel) — à confirmer sur captures.
- Cartes « Et encore plus » de page_v3 retirées (doublon des atouts) : OK ?
- Torsades el28 gardées / sens de levée des aimants / « Électronique intégrée, complice » / lumière T4 : défauts détaillés dans l'archive.

## Prochain pas exact
1. Montrer captures/site à Nolann (http://localhost:4350/maquettiste-nantes) + pop-up des questions ci-dessus (ajouter : écart au repos orange/verte, timing ESP) ; advisor final.
2. Republier l'Artifact 9az7LYrVJrfeLZzEiMFQsU (le LIRE d'abord) avec page_v3 à jour.
3. Ménage : http.server 4371 (PID 26140) ; delete_session groupé après pop-up ; dev 4350 (PID 22244) en fin de chantier.
4. Vérif visuelle /maquettiste-nantes + /maquette-industrielle ; scan claude-security ; push seulement sur « oui ».
