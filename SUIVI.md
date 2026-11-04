# SUIVI : état courant (04/11/2026)

Archives : `docs/SUIVI_archive_2026-11-03.md` (et autres), SUIVI complet d'avant le storyboard → `docs/chantiers/suivi-avant-storyboard_2026-11-03.md` (items 38-65, index des docs, structure en attente). Maquettage B2B : `docs/chantiers/maquettage-b2b_2026-11-02.md` ; guide Ads : `docs/ads_campagne_maquettage_2026-11-02.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Local, NON poussé, branche `claude/maquettage-b2b` : c59cbb1, 943a3fb, a31400d (page `/maquettiste-nantes` avec bureau d'études, prototypes/objets pour marques, 6 atouts, FAQ 13, timeline CSS) + `/maquette-industrielle`. Push seulement sur le « oui » de Nolann (redéploie le site) ; avant : advisor + scan `claude-security` depuis le fil principal. Structure a31400d PAS encore vérifiée visuellement (375/768/1440, build, 0 « € »).

## File des demandes (04/11)
1. [ ] Storyboard v3 d'après les retours de Nolann : **`docs/chantiers/storyboard-retours-v2_2026-11-04.md`** (points 0-10 : titre d'arrivée en blanc « Des maquettes qui s'animent, se manipulent, s'observent. », un seul plan de coupe « Électronique intégrée » avec bandeaux LED à modéliser + ESP + bouton capacitif, retirer la pièce verte de fixation, retirer 2 zooms, temps ESP et compteur 6/8, finition plus texturée sans carré, aimants = lettres noires + hexagones verts du milieu, motion 2D de pression sur le bouton, textes T7 réduits).
2. [ ] Répondre à sa question « comment t'intègres ça à la page existante ? » et LUI MONTRER la page /maquettiste-nantes complète, avec le storyboard intégré (proposition : le storyboard remplace le hero, puis les sections existantes de a31400d), captures 375/768/1440.

## Storyboard « cellule » : v2 PUBLIÉ (04/11), retours reçus → v3 (voir File)
- Artifact v2 (même URL) : https://claude.ai/artifact/9az7LYrVJrfeLZzEiMFQsU. Il suit les 8 temps du brief (`docs/chantiers/storyboard-cellule-brief_2026-11-03.md`) sur la vraie cellule (rendus Blender). Copies dans le dépôt : `docs/chantiers/storyboard.html` + `storyboard-cellule-page-brief.md`. Les images sont hors dépôt : `Source machine/glb/storyboard/web/` (+ `STORYBOARD.md` à jour).
- Mesures vertes : 0 erreur, 0 scroll horizontal ; 375 = 272 Ko ; 768/1440 = 502 Ko ; reduced = 34 Ko. 0 « € », ni « gratuit », ni nom de client.
- Fichiers publiés confirmés : 79 (78 images + la page). Le rendu en ligne reste à regarder par Nolann (navigateur intégré non connecté à claude.ai).
- Défauts connus, à trancher par Nolann : le reflet de la lumière (T4) est un peu flou ; la carte lumière a une bordure 3:2 ; à 10 %, le texte T2 arrive alors que la cellule est encore floue ; en transition, « Un bouton, et elle s'éclaire » est pâle.
- Ce qui n'a pas marché (v1) : sphère SVG générique ; animation de pinceau (il veut un jeu de lumière + microtexture).
- Suite possible : intégrer l'animation dans /maquettiste-nantes (le site), si Nolann valide.

## Maintenance FUSIONNÉE ici (03/11, décision Nolann « tout ici »)
Branche `claude/nasap3d-maintenance-suite-a237b1` fusionnée localement (centre d'erreurs admin lots 1-3, stock cartons à l'expédition, durcissements Stripe/quotes/admin ; vitest 169, tsc 0 selon elle). SUIVI complet d'origine : `docs/chantiers/suivi-maintenance_2026-11-03.md` (demandes 4, 59, 60, 62-65 : mails shop, bouton avis Google 64, captures centre d'erreurs, lot 4 devis au poids). Avant le push : Nolann coche les 4 événements du webhook Stripe (`docs/note_dev_shop_caddy_ip_2026-11-02.md` §4). Un SEUL push groupé sur son « oui ». Tests/build à relancer sur l'arbre fusionné (testeur) avant push. Conv « NASAP maintenance » supprimée ; conv « maquette B2B » (local_1df33bdf) à supprimer à la demande de Nolann.

## Autres demandes ouvertes
- Ads Google (maquettage B2B) : étapes dans le guide ci-dessus, après la mise en ligne ; rien dépensé sans son feu vert. Vérifier `gratuit|avant paiement` dans ce guide.
- FAQ coût : « devis sur mesure et gratuit » à trancher par Nolann.
- Session maintenance `local_35b3dfd0` (item 57 lien d'avis Google) : pop-up « garder en permanence ou supprimer ».
- À supprimer (liste cumulée) : worktree `maquettage-b2b-propre` / branche `claude/maquettage-b2b` après push+merge ; cette conversation en fin de tâche ; serveur dev port 4350 (PID 22244). Branche maintenance `claude/nasap3d-maintenance-suite-a237b1` : conflit attendu seulement sur SUIVI.md.

## Questions en attente (un seul pop-up au retour de Nolann)
- Torsades jaune/bleue/grise « mal mises » : leur place dans le .blend ou dans le rendu ? Défaut : les aligner proprement dans le noyau (comme orange/vert), à montrer en capture.
- « Électronique intégrée, complice, tu peux mettre » (fin T7) : sens exact ? Défaut sûr : une ligne « Électronique intégrée » dans le texte final.
- Lumière T4 « on verra » : défaut = vue arrière + texture Plaster001 plus fine, lumière inchangée.
- FAQ coût « devis sur mesure et gratuit » : à trancher.
- H1 de la page : storyboard en hero → H1 « Des maquettes qui s'animent… » ou garder le H1 SEO « Maquettiste à Nantes… » ? Défaut sûr : H1 SEO gardé (visible, sous l'animation ou en sur-titre), phrase du storyboard en texte d'accroche ; `<title>`/meta inchangés.

## v3 en cours (04/11, session reprise)
- Décisions : plaque_234 = pièce verte à retirer (groupe bouton) ; labels du plan électronique en HTML sur coords json ; aimants = lettres noir_60..138 + polyedres 6/10/12/250/252, rendu border ×2,5 ; pression bouton en CSS/canvas ; gsap via `npm i gsap` (bundlé), images dans `public/` (mobile < 450 Ko).
- Licences : bandeau LED Sketchfab (CC-BY, compte requis) écarté → primitives ; texture peinture = ambientCG Plaster001 CC0 (`Source machine/glb/textures_cc0/Plaster001_1K/`).
- FAIT : `render_storyboard.py` a `--v3 --sans --sub --n_elec --n_aimant3 --k_aim --outdir`, stages `elec`, `aimant3`, `v3` (eclate3→elec→aimant3). Test `out_test/` relu à l'œil : éclaté sans plaque_234 OK ; tas électronique (ESP, bouton, ruban LED primitives, fils) cadré OK, ruban un peu clair ; aimants : lettres + hexagones levés OK, rect_base [204.2,63.2,283.7,212.8], 709×532. Doutes : décalage 0,028 entre 17 clusters ; normales de 4 polyèdres vers le bas (levée visible quand même). Rien de commité côté Blender (hors dépôt).
- Reste : stage lumière arrière (Plaster001, az≈180, 16 images), rendus complets `--stage=v3` (testeur, arrière-plan, une seule instance Blender), webp (`to_webp.py`), page v3 (executant-ui), captures, Artifact, intégration.
- Timeline v3 : 0-0,08 titre ; 0,10-0,26 éclaté ; 0,26-0,42 coupe électronique ; 0,42-0,50 remontage ; 0,50-0,62 finition vue arrière ; 0,62-0,76 aimants ; 0,76-0,88 bouton + LED ; 0,90+ croquis, « Et encore plus », CTA. ~600vh, pas de HUD.

## Prochain pas exact
0. Refaire `stage_aimant3` d'après « Retours oraux sur le test aimants v3 » (fin de `docs/chantiers/storyboard-retours-v2_2026-11-04.md`) : lettres fixes ; hexagones + 5 torsades levés vers la caméra sans collision, torsades ×1,15 puis retour et clic ; repositionner jaune/bleu/gris.
1. Brief executant : stage lumière arrière ; puis testeur lance `blender -b cellule.blend -P render_storyboard.py -- --stage=v3` en arrière-plan (dossier `Source machine/glb/storyboard`).
2. Stage lumière arrière, rendus complets, webp, page v3, captures 375/768/1440 + reduced, republier l'Artifact (lire d'abord).
3. Intégrer dans `/maquettiste-nantes`, captures, advisor final, montrer à Nolann.
4. Ensuite : vérif visuelle de a31400d, puis « oui » de push → scan claude-security, `curl.exe -I https://nasap3d.com/maquette-impression-3d` (301), 200 sur les 2 pages, `node scripts/indexnow.mjs`.
