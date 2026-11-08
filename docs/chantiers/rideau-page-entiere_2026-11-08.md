# Rideau « page entière » : /maquettiste-nantes (architecte, 08/11/2026)

Prototype jetable fait et mesuré (Chrome headless, cap.cjs) : 1920/768/375/375×667/740×360 OK, 0 scroll horizontal, reduced-motion = page normale.

## Concept retenu
Le hero ne bouge plus dès que son haut touche le haut de l'écran : il recule (scale 1 → 0,94) et s'éteint (opacité 1 → 0,25),
pendant que **tout le reste de la page** (storyboard + sections + CTA final) remonte par-dessus comme une seule feuille opaque
aux coins hauts arrondis (28 px), filet `--line` et ombre portée vers le haut. Effet « feuille iOS / stacking cards ».
- **Pas de `position:sticky`** : le hero est « épinglé » par `translate: 0 min(100%,100svh)` piloté par `view()` sur la plage `exit`.
  Pendant cette plage la boîte du hero monte exactement de sa hauteur, la translation la compense : il reste à l'écran.
  Aucun changement de hauteur de page (transform seulement), pas de conflit avec le sticky 1000vh du vrai storyboard,
  pas besoin de toucher `body{overflow-x:hidden}` (testé : fonctionne avec).
- Hero plus haut que l'écran (375×667, paysage 740×360) : `exit` ne dure que 100svh de scroll, d'où `min(100%,100svh)`
  (avec 100 % seul, mesuré : le hero glisse de 27 px / 178 px vers le bas). Avec min() il reste fixe, BAS du hero visible (KPI).
- Pas de z-index sur `.rideau` : il peint après le hero (ordre DOM, tous deux « positionnés ») sans créer de contexte
  d'empilement, donc `.mcta` (z 20), `.vbar` (z 50) et le zoom du carrousel gardent leur ordre. Vérifié par `elementFromPoint`.

Options écartées : sticky hero + margin-top négatif (casse avec `overflow-x:hidden`, change la hauteur, se bat avec le sticky
1000vh du storyboard) ; clip-path sur `.sb-frame` seul (actuel : ne touche pas « toute la page ») ; GSAP/JS (inutile) ;
`filter:brightness` (coût GPU sur grand bloc mobile, l'opacité sur fond #161514 donne le même assombrissement).

## Modifications dans `docs/maquettes/page-maquettiste-nantes_2026-11-08.html`
1. **Retirer** le bloc provisoire l.81-88 (commentaire « Transition rideau… » + `@supports` avec `.sb-frame{animation:sb-rideau…}`
   et `@keyframes sb-rideau`). Ne pas toucher l.80 (`.sb-ph`) ni l.89 (`.sb-frame`).
2. **Insérer** à la place :
```css
  /* Rideau page entière : le hero recule et s'éteint sur place (épinglé par translate, sans sticky) pendant que .rideau
     (storyboard -> fin de main) remonte par-dessus. Hors @supports ou reduced-motion : page normale, aucune règle. */
  @supports (animation-timeline: view()){
    @media (prefers-reduced-motion:no-preference){
      .motion header.hero{transform-origin:50% 0;animation:hero-recul linear both;animation-timeline:view();animation-range:exit 0% exit 100%}
      @keyframes hero-recul{from{translate:0 0;scale:1;opacity:1}to{translate:0 min(100%,100svh);scale:.94;opacity:.25}}
      .rideau{position:relative;background:var(--bg);border-radius:28px 28px 0 0;border-top:1px solid var(--line);
              box-shadow:0 -28px 60px -12px rgba(0,0,0,.65);padding-top:28px}
    }
  }
```
3. **HTML** : ouvrir `<div class="rideau">` juste avant `<!-- 2. STORYBOARD` (l.556) ; le fermer `</div>` juste avant `</main>`
   (l.829, après le `</div>` du `.wrap` du CTA final l.828). Aucun texte, titre ni attribut SEO modifié.
4. `.motion` (posée par le JS l.853, absente en « Sobre », `#static`, sans JS) ne garde QUE l'animation du hero : la feuille
   `.rideau` reste en « Sobre » pour que basculer Sobre/Animé ne change pas la hauteur (+29 px).
5. Ne PAS mettre d'animation sur `.hero-in` (les enfants gardent `animation:up .5s`), ni de transform/overflow sur `.rideau`
   (casserait le sticky du vrai storyboard).
6. Commentaire d'en-tête de la maquette : une ligne « v08b : rideau page entière (hero épinglé par translate) ».

## Jonctions (sobriété)
- **J1 hero → storyboard** : la seule vraie « tombée de rideau ». À livrer d'abord et faire valider.
- **J2 optionnelle, après validation J1 : avant `#nos-maquettes` (l.681)**. Même recette en plus légère : section
  `aria-labelledby="s-dist"` (l.666) `animation:… view(); exit 0% exit 100%` avec `translate:0 40%; opacity:.5` (sans scale) ;
  `.sec.pj` reçoit `position:relative;background:var(--bg);border-radius:28px 28px 0 0;border-top:1px solid var(--line)`
  (remplace le `background:none` de l.466 dans le bloc @supports seulement). À prototyper et mesurer comme J1.
- Pas de rideau storyboard → section 01 : le décrochage du sticky 1000vh est déjà un temps fort ; deux pins se battraient.

## Report dans la vraie page (plus tard)
`src/pages/maquettiste-nantes.astro` : `header.hero` ↔ hero de la page (`.lp-hero` aujourd'hui) ; `<div class="rideau">`
autour de `<StoryboardCellule />` (l.152) jusqu'à la dernière section. `.sb` garde son `overflow-x:clip` : compatible.

## Risques
- Support : Chrome/Edge 115+ ; Safari : récent (26, à confirmer sur caniuse) ; Firefox (sans flag) = page normale, bords arrondis absents (règles dans @supports).
- `padding-top:28px` n'existe qu'avec support : +29 px de hauteur dans ce cas (mesuré 10545 → 10574 à 1440), jamais de saut en cours de page.
- Hero à 0,25 d'opacité sous la feuille : si Nolann trouve le contraste faible, monter l'ombre, pas changer le fond (les WebP du storyboard sont composés sur #161514 exact : `.rideau` doit rester `var(--bg)`).
- Pas de `will-change` : Chrome compose déjà les animations scroll-driven de transform/opacity.

## Vérification chiffrée (cap.cjs + eval)
Script : `docs/chantiers/rideau-page-entiere_2026-11-08.eval.js` (mesure H, exit 0 %/100 %, puis scroll à k = 0 / 0,5 / 1 / 1,3).
```
EV=$(python -c "import json;print(json.dumps([{'eval':open('docs/chantiers/rideau-page-entiere_2026-11-08.eval.js').read()}]))")
node <outils-maquettes-08>/cap.cjs "file:///C:/…/page-maquettiste-nantes_2026-11-08.html" out 375 740 "$EV"   # puis 768 1024, 1920 1080, RM=1, 375 667, 740 360
```
Critères (valeurs du prototype) :
| largeur | H hero | k=0,5 : translate / scale / opacité | k=1 : heroVisTop / hit | sbTop k=1 |
|---|---|---|---|---|
| 1920 | 518 | 49,9 % / 0,970 / 0,63 | 0 / rideau | 30 |
| 768 | 541 | 50,0 % / 0,970 / 0,62 | 0 / rideau | 29 |
| 375 | 694 | 49,9 % / 0,970 / 0,63 | 0 / rideau | 30 |
| 375×667 | 694 | heroVisTop −27 constant à k 0/0,5/1 | −27 / rideau | 30 |
| 740×360 | 538 | heroVisTop −178 constant | −178 / rideau | 30 |
- `heroVisTop` constant aux k 0, 0,5, 1 (0, ou vh−H si hero > écran) ; `sbTop` décroît ; `hit` = « rideau » à k=1 ; à k=1,3 le hero repart vers le haut.
- `RM=1` : translate/scale `none`, opacité 1, hauteur = sans rideau. Ligne `scrollWidth` de cap.cjs : `sw == cw`, `bad: []`.
- Captures 375 / 1440 à k=0,5 côte à côte avant/après pour Nolann ; .hero-in, [data-rv] et carrousel inchangés (rejouer les captures existantes).
