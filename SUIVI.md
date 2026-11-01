# SUIVI : état courant (01/11/2026)

Archives (texte d'origine intact) : `docs/SUIVI_archive_2026-10-29.md` (SUIVI complet avant allègement), `docs/SUIVI_archive_2026-10-25.md`, `docs/SUIVI_archive_2026-10-27.md`.
Index : multi-colis (récap validé, maquette, recette, pourquoi) → `docs/chantiers/multi-colis_2026-10-29.md` ; décisions SEO national (France d'abord, Nantes gardé, pied de page, textes, interdits) → `docs/chantiers/seo-national-decisions_2026-10-29.md` ; file des demandes 31-45 + état technique + « ce qui n'a pas marché » → `docs/chantiers/seo-national-file-et-etat_2026-10-29.md` ; plan SEO → `docs/plan_seo_national_2026-10-27.md`.

## État global
Multi-colis + SEO national fusionnés (merge ef300b5), `master` LOCAL avancé, recette faite (vitest 63/63, build OK, parcours commande en local). **RIEN poussé sur origin.** Nolann teste http://localhost:3000 (Docker) ; push seulement sur son « oui » explicite (redéploie le site). Branche courante : `claude/gracious-cori-4121bd` (SEO + multi-colis + maquettes).

## CHANTIER maquettes 360° (/maquette-impression-3d)
Liste pilotée par `src/data/maquettes.ts` (cellule, purification, caravane ; `enabled`). Rendus Cycles hors dépôt (`Source machine/glb/render_obj.py`, `run_both.sh`), convertis par `node scripts/build-maquette-frames.mjs "<dossier base>" <id>` (base+sm, ~18 Mo/modèle). Aucun nom de marque dans le dépôt (code, alt, docs).
Matières (validées 01/11) : tout FDM mat/satin à strates fines, sauf plexi (vitres, feux) brillant modéré ; exposition -0.5, bandes plexi `--strip 10` (22 = vitres de côté blanches/dégradées, 8 = noir plat), `--silk_m 0.15 --silk_r 0.42`, PVC laiteux (Principled transmission IOR 1.54 + Translucent, `--tube_milk 0.1 --tube_t 1.0`), barre avant caravane gris soie, accroche/dessous caravane blancs, pommeau levier gris + tête noire, roues noires/jantes soie, petites pièces inox séparées. Strates finales `--layer 0.06 --ampv 0.5` (wob 1.6). Rendus finaux faits le 01/11 (216 images/modèle, 1600x1200) puis convertis ; commande : `--exposure=-0.5 --key=2.6 --rim=1.8 --fill_s=0.3 --world=0.08 --strip=10 --samples=128 --full` (+ `--fill=0.94` caravane), script `glb/run_final.sh`. Leçons : skill `rendu-360-maquettes`.

### Supprimer une maquette (retrait sur demande)
1. `src/data/maquettes.ts` : `enabled:false` (ou supprimer l'entrée).
2. Supprimer `public/assets/maquettes/<id>/` (ids : `purification`, `caravane`).
3. `npm run build`, redéployer. Aucun titre, JSON-LD, sitemap ni lien interne ne dépend des maquettes ; sans maquette, la section disparaît.
4. L'historique git garde les images : retrait définitif = filter-repo + purge cache.
5. Source des rendus : `Source machine/` (hors dépôt), à supprimer aussi si demandé.
À signaler à Nolann : lettrage de marque et logo des roulettes gravés dans la géométrie ; feux rouges arrière de la caravane en FDM (plexi possible).

## Ce qui n'a pas marché
Reflets plexi : soleil seul = invisible/gris plat ; bandes de lumière avec énergie mise à l'échelle R² (R=0,1 m) = trop faibles ; 250 W et plus = vitres blanches cramées ; 20 W = gris plat ; 45-60 W = bon dégradé. Orange translucide = noir (rien derrière) : orange opaque brillant. `Stop-Process` par motif dans la ligne de commande s'est tué lui-même : tuer par PID.

## File des demandes ouvertes
38. [ ] Fresque moche (accueil ?) + mettre en avant Bambu Lab H2C / X2D / X1C : confirmer la page par capture.
39. [ ] À propos : contenu SEO, proposition à valider avant d'écrire.
43. [ ] Capture 375 px du menu Guides ; décision « Europe » dans cgu/confidentialité/panier (à lui).
45. [x] Maquettes purification + caravane : rendus finaux, conversion, test retrait/restauration (OK : 2 maquettes, 0 requête, build OK), captures 375/768/desktop (pas de scroll horizontal), commit local. En attente : Nolann teste en local, push sur son « oui ».
Nettoyage avant prod (annoncer d'abord) : commandes d'exemple N3D-2001..2009 en base locale (http://localhost:3000/admin).

## Prochain pas exact
1. Nolann regarde http://localhost:4321/maquette-impression-3d (3 maquettes) ; retours éventuels = retouche des rendus (`Source machine/glb`).
2. Sur son « oui » explicite seulement : push (redéploie le site).
