# SUIVI : état courant (03/11/2026)

Archives : `docs/SUIVI_archive_2026-11-03.md` (et autres), SUIVI complet d'avant le storyboard → `docs/chantiers/suivi-avant-storyboard_2026-11-03.md` (items 38-65, index des docs, structure en attente). Maquettage B2B : `docs/chantiers/maquettage-b2b_2026-11-02.md` ; guide Ads : `docs/ads_campagne_maquettage_2026-11-02.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Local, NON poussé, branche `claude/maquettage-b2b` : c59cbb1, 943a3fb, a31400d (page `/maquettiste-nantes` avec bureau d'études, prototypes/objets pour marques, 6 atouts, FAQ 13, timeline CSS) + `/maquette-industrielle`. Push seulement sur le « oui » de Nolann (redéploie le site) ; avant : advisor + scan `claude-security` depuis le fil principal. Structure a31400d PAS encore vérifiée visuellement (375/768/1440, build, 0 « € »).

## Storyboard « cellule » : v2 PUBLIÉ (04/11), en attente du retour de Nolann
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

## Prochain pas exact
1. Retour de Nolann sur le storyboard v2 (pop-up envoyé le 04/11) : retouches ou intégration au site.
2. Ensuite : vérif visuelle de a31400d, puis « oui » de push → `curl.exe -I https://nasap3d.com/maquette-impression-3d` (301), 200 sur les 2 pages, `node scripts/indexnow.mjs`, Nolann demande l'indexation.
