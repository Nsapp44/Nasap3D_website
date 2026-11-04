# SUIVI : état courant (04/11/2026)

Archives : `docs/SUIVI_archive_2026-11-03.md` (et autres), SUIVI complet d'avant le storyboard → `docs/chantiers/suivi-avant-storyboard_2026-11-03.md` (items 38-65, index des docs, structure en attente). Maquettage B2B : `docs/chantiers/maquettage-b2b_2026-11-02.md` ; guide Ads : `docs/ads_campagne_maquettage_2026-11-02.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Local, NON poussé, branche `claude/maquettage-b2b` : c59cbb1, 943a3fb, a31400d (page `/maquettiste-nantes` avec bureau d'études, prototypes/objets pour marques, 6 atouts, FAQ 13, timeline CSS) + `/maquette-industrielle`. Push seulement sur le « oui » de Nolann (redéploie le site) ; avant : advisor + scan `claude-security` depuis le fil principal. Structure a31400d PAS encore vérifiée visuellement (375/768/1440, build, 0 « € »).

## File des demandes (04/11)
1. [ ] Storyboard v3 d'après les retours de Nolann : **`docs/chantiers/storyboard-retours-v2_2026-11-04.md`** (points 0-10 : titre d'arrivée en blanc « Des maquettes qui s'animent, se manipulent, s'observent. », un seul plan de coupe « Électronique intégrée » avec bandeaux LED à modéliser + ESP + bouton capacitif, retirer la pièce verte de fixation, retirer 2 zooms, temps ESP et compteur 6/8, finition plus texturée sans carré, aimants = lettres noires + hexagones verts du milieu, motion 2D de pression sur le bouton, textes T7 réduits).
2. [ ] Répondre à sa question « comment t'intègres ça à la page existante ? » et LUI MONTRER la page /maquettiste-nantes complète, avec le storyboard intégré (proposition : le storyboard remplace le hero, puis les sections existantes de a31400d), captures 375/768/1440.

## Storyboard « cellule » : v2 publié (Artifact https://claude.ai/artifact/9az7LYrVJrfeLZzEiMFQsU), détail → `docs/chantiers/storyboard-v2-publie_2026-11-04.md` ; v3 en cours ci-dessous.

## Maintenance FUSIONNÉE ici (03/11, décision Nolann « tout ici »)
Branche `claude/nasap3d-maintenance-suite-a237b1` fusionnée localement (centre d'erreurs admin lots 1-3, stock cartons à l'expédition, durcissements Stripe/quotes/admin ; vitest 169, tsc 0 selon elle). SUIVI complet d'origine : `docs/chantiers/suivi-maintenance_2026-11-03.md` (demandes 4, 59, 60, 62-65 : mails shop, bouton avis Google 64, captures centre d'erreurs, lot 4 devis au poids). Avant le push : Nolann coche les 4 événements du webhook Stripe (`docs/note_dev_shop_caddy_ip_2026-11-02.md` §4). Un SEUL push groupé sur son « oui ». Tests/build à relancer sur l'arbre fusionné (testeur) avant push. Conv « NASAP maintenance » supprimée ; conv « maquette B2B » (local_1df33bdf) à supprimer à la demande de Nolann.

## Autres demandes ouvertes
- Ads Google (maquettage B2B) : étapes dans le guide ci-dessus, après la mise en ligne ; rien dépensé sans son feu vert. Vérifier `gratuit|avant paiement` dans ce guide.
- FAQ coût : « devis sur mesure et gratuit » à trancher par Nolann.
- Session maintenance `local_35b3dfd0` (item 57 lien d'avis Google) : pop-up « garder en permanence ou supprimer ».
- À supprimer (liste cumulée) : worktree `maquettage-b2b-propre` / branche `claude/maquettage-b2b` après push+merge ; cette conversation en fin de tâche ; serveur dev port 4350 (PID 22244). Branche maintenance `claude/nasap3d-maintenance-suite-a237b1` : conflit attendu seulement sur SUIVI.md.

## Questions en attente (un seul pop-up au retour de Nolann)
- Torsades jaune/bleue/grise « mal mises » : DIAGNOSTIC 04/11 = le .blend est voulu (vue de dessus `diag_top_el80` : chaque torsade à côté de son étiquette ; elles sont posées dans des logements du sol pei_174 à z 204, comme orange/vert dans des logements du mur). C'est le cadrage el28 : la torsade grise cache « Knock-out » (étiquette 5 mm derrière), le bord du noyau coupe « Rep »/« Helper ». Défaut : aucune correction de position, el28 gardé. Option : passer le gros plan aimants en el plus haute (~50), possible car il suit la vue arrière (coupure déjà là).
- Sens de levée : hexagones + orange/vert vers la caméra ; cyan/jaune/gris levés en +z (vers la caméra elles traverseraient le bord avant du noyau). Défaut = ça ; à confirmer.
- « Électronique intégrée, complice, tu peux mettre » (fin T7) : sens exact ? Défaut sûr : une ligne « Électronique intégrée » dans le texte final.
- Lumière T4 « on verra » : défaut = vue arrière + texture Plaster001 plus fine, lumière inchangée.
- FAQ coût « devis sur mesure et gratuit » : à trancher.
- H1 de la page : storyboard en hero → H1 « Des maquettes qui s'animent… » ou garder le H1 SEO « Maquettiste à Nantes… » ? Défaut sûr : H1 SEO gardé (visible, sous l'animation ou en sur-titre), phrase du storyboard en texte d'accroche ; `<title>`/meta inchangés.

## v3 en cours (04/11, session reprise)
- Décisions : plaque_234 = pièce verte à retirer (groupe bouton) ; labels du plan électronique en HTML sur coords json ; aimants = lettres noir_60..138 + polyedres 6/10/12/250/252, rendu border ×2,5 ; pression bouton en CSS/canvas ; gsap via `npm i gsap` (bundlé), images dans `public/` (mobile < 450 Ko).
- Licences : bandeau LED Sketchfab (CC-BY, compte requis) écarté → primitives ; texture peinture = ambientCG Plaster001 CC0 (`Source machine/glb/textures_cc0/Plaster001_1K/`).
- FAIT : `render_storyboard.py` (hors dépôt, rien à commiter) a `--v3 --sans --sub --n_elec --n_aimant3 --k_aim --outdir`, stages `elec`, `aimant3`, `v3` (eclate3→elec→aimant3). Éclaté sans plaque_234 OK ; tas électronique OK (ruban un peu clair).
- FAIT 04/11 : `stage_aimant3` refait (point 0) : lettres fixes ; 5 hexagones levés ensemble selon l'axe caméra (amp 35, sans décalage) ; 5 torsades amp 25, ×1,15 autour de leur centre puis reclipsage (petit rebond 0,05·amp) ; base.png plein cadre ; json `pieces`. Test `storyboard/out_test/aimant3` (9 images, rect_base [204.2,59.1,287,215.2], 717×538) relu : pas de collision, « Knock-out » se découvre, logements visibles sous les torsades levées.
- FAIT 04/11 : stage lumière arrière `--stage=lumiere3` (dans `stage_lumiere(v3=True)` : vue arrière, normal map Plaster001 + Mapping `--lum_tex_scale`, sortie `lumiere3/` + `coords_lumiere3.json`, `--lum_idx=0,8,15` pour tester). Réglage RETENU (grain bien visible, essai `storyboard/out_test3/lumiere3/l_008.png`) : `--lum_d=260 --lum_beta=28 --lum_k=55 --lum_coat=1.0 --lum_coat_r=0.05 --lum_coat_n=0.6 --lum_sx=40 --lum_sy=400 --micro=2 --lum_tex_scale=3`. Écarté : coat_n 0,08 ou 0,35 (reflet lisse, grain invisible).
- Reste : rendus complets `--stage=v3` (testeur, arrière-plan, une seule instance Blender), webp (`to_webp.py`), page v3 (executant-ui), captures, Artifact, intégration.
- Timeline v3 : 0-0,08 titre ; 0,10-0,26 éclaté ; 0,26-0,42 coupe électronique ; 0,42-0,50 remontage ; 0,50-0,62 finition vue arrière ; 0,62-0,76 aimants ; 0,76-0,88 bouton + LED ; 0,90+ croquis, « Et encore plus », CTA. ~600vh, pas de HUD.

## Prochain pas exact
1. testeur (arrière-plan, une seule instance Blender, depuis `Source machine/glb`) : `blender.exe -b cellule.blend -P storyboard/render_storyboard.py -- --stage=v3 --force` + les paramètres lumière RETENUS ci-dessus (sortie `storyboard/out/`). Attention : supprimer `storyboard/out_test*` seulement (pas `glb/out_test`).
2. Webp (`python to_webp.py <png> <web/...>`, sans -I), page v3 (executant-ui ; base : `docs/chantiers/storyboard.html` v2 + brief `storyboard-cellule-page-brief.md` ; retirer la petite carte bordée du T4), page v3, captures 375/768/1440 + reduced, republier l'Artifact (lire d'abord).
3. Intégrer dans `/maquettiste-nantes`, captures, advisor final, montrer à Nolann.
4. Ensuite : vérif visuelle de a31400d, puis « oui » de push → scan claude-security, `curl.exe -I https://nasap3d.com/maquette-impression-3d` (301), 200 sur les 2 pages, `node scripts/indexnow.mjs`.
