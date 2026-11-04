# SUIVI : état courant (04/11/2026)

Archives : `docs/SUIVI_archive_2026-11-03.md` (et autres), SUIVI complet d'avant le storyboard → `docs/chantiers/suivi-avant-storyboard_2026-11-03.md` (items 38-65, index des docs, structure en attente). Maquettage B2B : `docs/chantiers/maquettage-b2b_2026-11-02.md` ; guide Ads : `docs/ads_campagne_maquettage_2026-11-02.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Local, NON poussé, branche `claude/maquettage-b2b` : c59cbb1, 943a3fb, a31400d (page `/maquettiste-nantes` avec bureau d'études, prototypes/objets pour marques, 6 atouts, FAQ 13, timeline CSS) + `/maquette-industrielle`. Push seulement sur le « oui » de Nolann (redéploie le site) ; avant : advisor + scan `claude-security` depuis le fil principal. Structure a31400d PAS encore vérifiée visuellement (375/768/1440, build, 0 « € »).

## File des demandes (04/11)
1. [ ] Storyboard v3 d'après les retours de Nolann : **`docs/chantiers/storyboard-retours-v2_2026-11-04.md`** (points 0-10 : titre d'arrivée en blanc « Des maquettes qui s'animent, se manipulent, s'observent. », un seul plan de coupe « Électronique intégrée » avec bandeaux LED à modéliser + ESP + bouton capacitif, retirer la pièce verte de fixation, retirer 2 zooms, temps ESP et compteur 6/8, finition plus texturée sans carré, aimants = lettres noires + hexagones verts du milieu, motion 2D de pression sur le bouton, textes T7 réduits).
2. [ ] Répondre à sa question « comment t'intègres ça à la page existante ? » et LUI MONTRER la page /maquettiste-nantes complète, avec le storyboard intégré (proposition : le storyboard remplace le hero, puis les sections existantes de a31400d), captures 375/768/1440.

3. [x] **Bandeau LED plus souple et plus long** FAIT (04/11 22 h) : 4 tronçons WS2812B (10 mm, pas 16,7, 3 LED 5050 + résistance chacun, pastilles cuivre 5V/DIN/GND) sur courbe en S Catmull-Rom, ponts de 3 fils rouge/vert/blanc entre tronçons, 3 fils d'alimentation vers l'ESP ; aucun modèle 3D libre exploitable trouvé (BlenderKit licence non confirmée) → modélisé à la main. Sauvegarde du script : `render_storyboard.py.avant_ruban_2026-11-04.bak`. 14 images re-rendues (40 s), webp copiés dans `page_v3/elec/` + `coords_elec.json`.
5. [ ] (04/11 soir) « vas-y continue, intègre dans la page » → executant-ui en cours : composant `src/components/StoryboardCellule.astro` en hero de `/maquettiste-nantes` (H1 SEO gardé, images `public/storyboard/cellule/`, GSAP auto-hébergé `public/vendor/gsap/`, tout sous `.sb`). Puis testeur : captures 375/768/1440 + reduced.
6. [ ] « fais gaffe y a des éléments qui se superposent » : AUCUN chevauchement (pastilles LED/ESP/Bouton, textes, header) à 375/768/1440, à vérifier explicitement sur captures.
4. [x] (retour oral) **Fils jusqu'au bouton** : fils rouge/noir de l'ESP jusqu'aux bornes sous le bouton (objet `blanc_246`, le plus petit `blanc_*`), vérifié sur rendu test.

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

## v3 en cours (04/11)
Détail des rendus, réglages et licences → `docs/chantiers/storyboard-v3-rendus_2026-11-04.md`. Rendus complets + webp FAITS. Page v3 écrite, copie durable `Source machine/glb/storyboard/page_v3/` (index.html + images + capture.cjs ; servir ce dossier par `python -m http.server 4371 --bind 127.0.0.1` ; captures `node capture.cjs <dossier caps>` = Chrome headless CDP, port 9333). 1re série : 375 = 388 Ko, 0 scroll horizontal partout. 5 défauts corrigés par executant-ui (04/11 soir), PAS encore recapturés : LED sur fond `led/cell.webp` (= v2 aimant/f_013, sur lequel glow/rank sont alignés ; anneau (320,296)/640×480) ; lumière en contain + masque radial ; 3 légendes élec visibles 0,325-0,385 ; zoom aimants masque radial (peut rogner les côtés de l'éclaté, sinon 80 %→88 %) ; fin : canvas à 0 avant croquis. À 375 la pastille ESP peut chevaucher « Bandeau LED ».
- Timeline v3 : 0-0,08 titre ; 0,10-0,26 éclaté ; 0,26-0,42 coupe électronique ; 0,42-0,50 remontage ; 0,50-0,62 finition vue arrière ; 0,62-0,76 aimants ; 0,76-0,88 bouton + LED ; 0,90+ croquis, « Et encore plus », CTA. ~600vh, pas de HUD.
- À supprimer par Nolann (suppression refusée en auto) : `Source machine/glb/storyboard/out_test*`, `out_elec_test`, `out_webp_elec` (dossiers de travail ; PAS `glb/out_test`).

## Prochain pas exact
1. Recapturer (`node capture.cjs <caps>` en arrière-plan, puis planche contact PIL) et vérifier les 5 corrections, puis : captures 375/768/1440 + reduced, 0 scroll horizontal, poids (mobile < 450 Ko), 0 « € »/gratuit/avant paiement. Republier l'Artifact (le lire d'abord ; fichiers led/ copiables depuis la v2 côté serveur).
2. Intégrer dans `/maquettiste-nantes` (hero), captures, advisor final, montrer à Nolann + pop-up des questions en attente.
3. Ensuite : vérif visuelle de a31400d, puis « oui » de push → scan claude-security, `curl.exe -I https://nasap3d.com/maquette-impression-3d` (301), 200 sur les 2 pages, `node scripts/indexnow.mjs`.
4. Relancer `delete_session` [local_117c8401, local_e79981e6] quand la mère est inactive.
