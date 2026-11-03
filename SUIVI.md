# SUIVI : état courant (03/11/2026)

Archives : `docs/SUIVI_archive_2026-11-03.md` (et autres), SUIVI complet d'avant le storyboard → `docs/chantiers/suivi-avant-storyboard_2026-11-03.md` (items 38-65, index des docs, structure en attente). Maquettage B2B : `docs/chantiers/maquettage-b2b_2026-11-02.md` ; guide Ads : `docs/ads_campagne_maquettage_2026-11-02.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Local, NON poussé, branche `claude/maquettage-b2b` : c59cbb1, 943a3fb, a31400d (page `/maquettiste-nantes` avec bureau d'études, prototypes/objets pour marques, 6 atouts, FAQ 13, timeline CSS) + `/maquette-industrielle`. Push seulement sur le « oui » de Nolann (redéploie le site) ; avant : advisor + scan `claude-security` depuis le fil principal. Structure a31400d PAS encore vérifiée visuellement (375/768/1440, build, 0 « € »).

## EN COURS : storyboard animé « cellule » (marketing de /maquettiste-nantes)
Brief complet, séquence voulue et faits : `docs/chantiers/storyboard-cellule-brief_2026-11-03.md`. Artifact v1 générique (https://claude.ai/artifact/9az7LYrVJrfeLZzEiMFQsU) = À REFAIRE sur la vraie cellule verte à LED. **Nolann (03/11) : c'est du travail Opus architecte/Fable (conception visuelle), nouvelle conversation Opus ultracode conseillée.** Cette session (Sonnet, lancée par une autre session) ne peut pas en créer une : il ouvre lui-même la conversation Opus et colle : « Lis SUIVI.md et docs/chantiers/storyboard-cellule-brief_2026-11-03.md, puis refais le storyboard. »
Ce qui n'a pas marché : sphère SVG générique (pas la vraie cellule) ; animation de pinceau pour la peinture (il veut jeu de lumière + microtexture). Début de copie d'images (scratchpad) abandonné : `sm` n'existe qu'en avif.

Point 03/11 soir : cette conversation (Opus demandé à Nolann) pilote le storyboard ; `architecte` a posé `Source machine/glb/storyboard/render_storyboard.py` + planche éclaté validée à l'œil (3 états OK), rendus Blender en cours (`out/`), puis `to_webp.py`, page Artifact (`executant-ui`), captures (`testeur`), advisor, UN pop-up.

## Maintenance FUSIONNÉE ici (03/11, décision Nolann « tout ici »)
Branche `claude/nasap3d-maintenance-suite-a237b1` fusionnée localement (centre d'erreurs admin lots 1-3, stock cartons à l'expédition, durcissements Stripe/quotes/admin ; vitest 169, tsc 0 selon elle). SUIVI complet d'origine : `docs/chantiers/suivi-maintenance_2026-11-03.md` (demandes 4, 59, 60, 62-65 : mails shop, bouton avis Google 64, captures centre d'erreurs, lot 4 devis au poids). Avant le push : Nolann coche les 4 événements du webhook Stripe (`docs/note_dev_shop_caddy_ip_2026-11-02.md` §4). Un SEUL push groupé sur son « oui ». Tests/build à relancer sur l'arbre fusionné (testeur) avant push. Conv « NASAP maintenance » supprimée ; conv « maquette B2B » (local_1df33bdf) à supprimer à la demande de Nolann.

## Autres demandes ouvertes
- Ads Google (maquettage B2B) : étapes dans le guide ci-dessus, après la mise en ligne ; rien dépensé sans son feu vert. Vérifier `gratuit|avant paiement` dans ce guide.
- FAQ coût : « devis sur mesure et gratuit » à trancher par Nolann.
- Session maintenance `local_35b3dfd0` (item 57 lien d'avis Google) : pop-up « garder en permanence ou supprimer ».
- À supprimer (liste cumulée) : worktree `maquettage-b2b-propre` / branche `claude/maquettage-b2b` après push+merge ; cette conversation en fin de tâche ; serveur dev port 4350 (PID 22244). Branche maintenance `claude/nasap3d-maintenance-suite-a237b1` : conflit attendu seulement sur SUIVI.md.

## Prochain pas exact
1. Nolann ouvre une conversation Opus ultracode pour le storyboard (brief ci-dessus).
2. Après : vérif visuelle de a31400d, puis « oui » de push → `curl.exe -I https://nasap3d.com/maquette-impression-3d` (301), 200 sur les 2 pages, `node scripts/indexnow.mjs`, Nolann demande l'indexation.
