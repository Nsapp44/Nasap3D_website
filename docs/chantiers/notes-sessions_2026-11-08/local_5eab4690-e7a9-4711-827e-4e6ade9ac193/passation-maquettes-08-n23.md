# Passation : retours n2 + n3 sur les maquettes 08 (08/11/2026)

De : session Opus « Nasap3D [maquette] carrousel + page, Opus » (local_cabfad4a), fille de local_5eab4690. Passation pour boucle de compaction. Rien n'a encore été modifié dans les 2 maquettes pour n2/n3 (dernier commit maquettes : 79397d5).

## À lire (par extraits, jamais en entier : les maquettes font 56 et 109 Ko)
- `retours-nolann-n2_2026-11-08.md` (points 1-8) + `retours-n2_cartes-chiffres.png`, `retours-nolann-n3_2026-11-08.md` (points 9-12).
- `recherches-n2_animations-transitions_2026-11-08.md` : icônes animées retrouvées (CSS exact), cause du survol cassé, 3 pistes de transition avec références.
- Outils : `outils-maquettes-08/` (cap.cjs, caps_serie.sh, sync_pj.py, seo_diff.py, planches.py ; build_page_0811.py OBSOLÈTE, garde sys.exit).

## Méthode (validée par l'advisor)
- page-08 = base, éditée directement. carrousel-08 = source unique de PJ:CSS/DATA/TPL/JS → `python sync_pj.py --write` puis `python sync_pj.py` (tout « identique »). PJ:HTML à la main dans les deux fichiers.
- Deux `executant-ui` en parallèle, un par fichier, jamais le même fichier. Le fil principal charge `web-design-guidelines` avant, relit les diffs et les captures.
- Serveur : `python -m http.server 4380 --bind 127.0.0.1` à la racine du worktree (PID 46448 au 08/11). cap.cjs : JSON des étapes entre guillemets simples en bash (PowerShell 5.1 mange les doubles). Pas de `python -c` avec guillemets en PowerShell : écrire un script.

## Repères page-08 (avant modifs)
hero 500-517 (`.kpis`/`.kpi` = `<b>`+`<span>`) ; `.sb-ph` 519-525 ; `aside.know` 527-533 ; s-inter 536-558 ; s-be + `details.more` ~568 ; s-types `#types-cards`, `a.card` ~615 ; PJ:HTML 651-771 (h2#s-3d, tuiles `a.t3d[data-pj-spin]` ~760) ; FAQ, CTA, vbar 804-816 ; script variantes ~820-875 (`setText`, `setList`, `setRythme`) ; PJ:CSS 249-426, surcharges page 429-430 (`.sec.pj{--pj-wrap:var(--wrap)}`) ; PJ:DATA 876-909, TPL 912-945, JS 947-1264.
Repères carrousel-08 : PJ:CSS 44-221, HTML 229-342, DATA 346-379, TPL 382-415, JS 422-739 (`geo/range/sync/toCard/go` ~450-485).

## Plan (ordre de l'advisor)
1. **executant-ui A, `carrousel-projets_2026-11-08.html` seul** :
   - 6) un seul badge par carte (garder « 360° » sur les tuiles ; vérifier les badges des cartes du carrousel) ;
   - 7) carrousel centré dans la colonne : fenêtre = la colonne (`--pj-wrap`), k cartes entières la remplissent exactement (largeur de carte calculée, plus `clamp(250px,30vw,300px)` fixe), pas = k × (carte + gap), dernière position bornée à `scrollWidth − clientWidth`, jamais de trou à gauche/droite (aujourd'hui `padding-inline: --pj-edge` + `.track` pleine largeur = trou), traits/compteur = `ceil(N/k)`, recalcul au resize. Tester avec N = 5, 7, 11 (cartes temporaires, retirées ensuite) ;
   - 11) drapeau `fiche: true/false` dans PJ:DATA, « Voir la fiche projet » masqué dans le zoom si false (mettre true seulement aux projets riches) ;
   - rendre la liste des retouches PJ:HTML à reporter à la main dans page-08.
2. **executant-ui B, `page-maquettiste-nantes_2026-11-08.html` hors blocs PJ:CSS/DATA/TPL/JS** :
   - 3) retirer `aside.know` (+ son CSS si orphelin) ; recaser « cellule biologique à chenille lumineuse LED » dans la légende/alt de la photo cellule (real-8) ou la FAQ, pas en prose dans s-inter ; `seo_diff.py` avant/après ;
   - 4) h2 s-inter + « et design produit » (ex. « Maquettes interactives, intégration électronique et design produit ») ; texte réduit, photos gardées ; icônes animées Écran (traits) / LED (ampoule ou chenille de points) / Boutons et capteurs (ondes) / Pièces mobiles (engrenage), CSS de `recherches-n2…md`, `.live` par IntersectionObserver, rien sous reduced-motion ;
   - 5) survol de `a.card` qui marche (voir cause dans recherches) + indice `@media (hover:none)` ;
   - 6) tuiles 3D (PJ:HTML de la page) : un seul badge « 360° » ;
   - 8) `details.more` : ouverture ET fermeture en hauteur douce (JS : mesurer, animer `height`, `open` retiré à la fin de la fermeture ; ou `interpolate-size`/`::details-content` en amélioration progressive) ; instantané sous reduced-motion ;
   - 9) « Blocs courts » + « Animé au scroll » par défaut (sans paramètre d'URL) ; retirer `max-width:52ch` de `body.t-short .p, .more p, .usages` (les blocs suivent leur colonne) ; chaque bloc commence par une majuscule (« nous intégrons… » → réécrire en phrase complète) ; vérifier tous les blocs ;
   - 10) `#types-cards` : `display:flex;flex-wrap:wrap;gap` + `flex:1 1 <min ~260px>` (la dernière ligne s'étire, jamais d'orpheline étroite), tester 5/6/7 cartes temporaires de 375 à 1920 ; retirer la variante « Liste » et le bouton `setList` ; garder le h2 « Quatre types… ».
3. `sync_pj.py --write`, puis `sync_pj.py` : identique.
4. **Point 1** (cartes chiffres du hero) : le fil principal conçoit (4 faits gardés, « 1 sem. – 1 mois » ne doit plus casser sur 2 lignes : ex. chiffre court + unité en petit, ou liste horizontale à séparateurs), executant-ui écrit. Voir `retours-n2_cartes-chiffres.png`.
5. **Pop-up unique** à Nolann : a) transition hero → storyboard : A rideau (recommandée) / B carte arrondie / C sortie CSS native, chaque piste avec sa référence ; b) « Lire la suite » revient-il pour les blocs longs en Blocs courts ? c) renommer le h2 « Quatre types… » (ex. « Nos types de maquettes sur mesure ») ?
6. Point 2 selon la réponse (`.sb-ph` = emplacement du storyboard ; H1 et infos à opacity 1 au chargement).
7. Fin : seo_diff (rien perdu, ou dit) ; 0 débordement 375/768/1024/1180×820/1440/1920 (`caps_serie.sh planches-maquettes-08/apres-n23`) ; planches avant/après (planches.py) ; commit local de `docs/maquettes/` seulement ; SUIVI.md réécrit ; advisor avant « fini » ; rapport à Nolann.

## Contraintes
Rien poussé. `git add <fichier>` ciblé, jamais `-A`. Ne pas toucher `public/storyboard/cellule/preview-onde.html`, `src/`, ni la page 05. Jamais stash/reset/changement de branche. Rien de SEO retiré sans le dire. Design : #161514/#1a1917/#201d1b, accent #ff5a3c, Space Grotesk + Inter, bordure rgba(255,255,255,.1), entrée translateY(6px) 0,5 s, reduced-motion.

## Conversations à supprimer (cumul)
local_2827b498 (fille « maquettes 08 » coincée en boucle de compaction, n'a appliqué que n1), puis l'ancienne de cette passation (titre suffixé « (à supprimer) »).
