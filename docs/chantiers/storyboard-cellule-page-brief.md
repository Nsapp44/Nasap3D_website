# Brief : page storyboard animé « cellule » (Artifact claude.ai)

Livrable UNIQUE : `index.html` dans ce dossier (`storyboard/`). Ne copie, ne renomme, ne supprime aucune image (déjà en place). Pas de captures ni de boucle « je regarde » : un autre agent vérifie. Après 3 fois la même erreur, ou en cas de doute sur ce qu'on attend : arrête-toi et rends la main avec le blocage.

## But
Storyboard animé au scroll qui montre à Nolann (fondateur de Nasap3D, Nantes) comment se déroulera la future section marketing de sa page /maquettiste-nantes. L'objet est une vraie maquette pédagogique : une **cellule** (demi-sphère verte imprimée en 3D, pièces de couleur aimantées, bandeau de points LED, carte ESP32 cachée dedans). Rendu « premium », sobre, rien de gadget.

## Contrat Artifact (obligatoire)
- PAS de `<!doctype>`, `<html>`, `<head>`, `<body>` : le fichier commence par `<title>Storyboard cellule</title>` puis `<meta name="claude:viewport-fit-sides" content="cover">`, puis `<link>` Google Fonts (Space Grotesk 500/600/700 + Inter 400/500, `display=swap`), puis `<style>`, puis le contenu, puis les scripts.
- Scripts externes UNIQUEMENT : `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js` et `https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js`, avant le script de la page. Rien d'autre en externe (ni images, ni CSS, ni fetch externe). Les images sont en chemins RELATIFS (`eclate/f_000.webp`…).
- Thème sombre unique assumé : `:root { color-scheme: dark; --bg:#161514; --bg2:#1a1917; --card:#201d1b; --line:rgba(255,255,255,.1); --fg:#f3efe9; --muted:#a8a29b; --accent:#ff5a3c; }`, `body { background: var(--bg); color: var(--fg); margin:0 }`. Toutes les couleurs via ces jetons.
- Gouttière : sur le conteneur extérieur `padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px))` ; vertical en `padding-block`. GARDER le padding top/bottom que le squelette met sur `:root` (ne pas le remettre à 0).
- Aucun scroll horizontal (vérifier `overflow-x: clip` sur le wrapper de scène, pas sur body si ça casse le sticky). Fonctionne à 375, 768, 1440.
- Pas d'`alert/confirm/prompt`, pas de `window.open`, liens normaux `<a href>`.

## Charte (site Nasap3D)
Fonds #161514 / #1a1917 / #201d1b, accent #ff5a3c (boutons, anneau, traits d'icônes), titres Space Grotesk (`text-wrap: balance`, letter-spacing -0.01em), texte Inter (≤ 65 caractères par ligne), cartes arrondies 16 px avec bordure rgba(255,255,255,.1), animation d'entrée standard `translateY(6px)→0` + opacity, 0,5 s. Petites étiquettes en majuscules avec letter-spacing .08em.

## Images disponibles (toutes webp, déjà aplaties sur #161514, fond opaque)
| dossier | fichiers | taille | contenu |
|---|---|---|---|
| `eclate/` | `f_000`…`f_027` (28) | 640×480 | f_000 = boule fermée, petite au centre ; f_027 = éclaté complet (coques écartées, intérieur visible) |
| `eclate/hd_027.webp` | 1 | 960×720 | même image que f_027 en haute déf, pour les zooms (chargée seulement si largeur ≥ 768) |
| `aimant/` | `f_000`…`f_013` (14) | 640×480 | vue rapprochée de la boule ouverte. **f_000 = pièces de couleur SOULEVÉES**, f_013 = pièces EN PLACE (f_011..13 quasi identiques, posé) |
| `esp/` | `f_000`…`f_015` (16) | 640×480 | même vue ; f_000 = carte ESP + petits points LED dehors, éparpillés ; f_015 = tout rentré dans la boule |
| `lumiere/` | `f_000`…`f_015` (16) | 640×426 (3:2 !) | gros plan de la surface peinte, un reflet blanc la traverse de droite à gauche |
| `led/glow.webp`, `led/rank.webp` | 2 | 800×600 | calques LED (chenille) alignés EXACTEMENT sur `esp/f_015` et `aimant/f_013` (même cadrage, vérifié) |
Poster : data URI ci-dessous (160×120, déjà flouté, 0,5 Ko) — à inliner tel quel comme `src` de l'`<img>` du temps 1 (LCP sans requête) :
POSTER_DATA_URI → lire le fichier `poster.txt` de ce dossier et coller son contenu tel quel.

Le poster correspond au recadrage central de `eclate/f_000` : rectangle x=106.7, y=80, l=426.7, h=320 dans l'image 640×480 (la boule y paraît 1,5× plus grande).

## Architecture de la page
1. **Bandeau d'intro** court (hors scène) : étiquette « STORYBOARD · /maquettiste-nantes » + une ligne grise « Faites défiler : voici la future section, sur la vraie cellule. » (C'est un document de travail pour Nolann, sobre.)
2. **Scène épinglée** (`section` de ~700vh sur desktop, ~600vh sous 768) avec un `div.stage` sticky `top:0; height:100svh` contenant :
   - un `<canvas>` centré, boîte 4:3, largeur `min(92vw, 133svh*… )` : la boîte doit tenir en hauteur à côté du texte ; desktop ≥ 1024 : canvas à droite (~58 % de largeur), texte à gauche ; < 1024 : canvas en haut (≈ 55 svh), texte en dessous.
   - l'`<img>` poster par-dessus le canvas au départ (même boîte, `object-fit: cover`, recadrage déjà fait).
   - un calque texte : un bloc par temps (titre h2 + phrase), un seul visible à la fois (opacity + y 6px).
   - une petite barre de progression fine (2 px, accent) en bas de la scène + numéro du temps « 02 / 08 » discret.
3. **Après la scène** (défilement normal) : temps 7 (récit + « Et encore plus » + 6 cartes), temps 8 (CTA), lien galerie.

## Les 8 temps (textes FINALS, à recopier exactement)
Progression de la timeline maîtresse (ScrollTrigger `scrub: 0.6`, `pin` via sticky CSS ou `pin:true`) ; labels aux % indiqués de la scène.

**T1 (0→8 %) « Arrivée »** — Titre H1 : « Maquettage professionnel à Nantes » ; phrase : « Des maquettes qui s'allument, bougent et se démontent. »
Image : poster flouté, petit : `scale(.55)` + `filter: blur(10px)` ; au fil de T1 → `scale(1)`, blur 0 (le blur n'est appliqué qu'à l'img, jamais au canvas). Le texte entre dès le chargement (pas besoin de scroller).

**T2 (8→30 %) « Mise au point puis éclaté »** — H2 : « Tout est pensé de l'intérieur. »
Fin de la mise au point (8→12 %) : fondu poster → canvas affichant `eclate/f_000` dessiné avec le recadrage ×1,5 (même cadrage que le poster, donc aucune saute). Puis 12→30 % : index éclaté 0→27 ET le recadrage passe de ×1,5 à ×1 (on voit la boule entière qui s'ouvre). Le recadrage se fait en `drawImage` (source rect), pas en CSS.

**T3 (30→42 %) « Trois zooms »** — Trois étiquettes successives (une par arrêt, ~4 % chacun), sous forme de petite pastille avec un trait accent :
  1. « Électronique intégrée » — centre (dans l'image 640×480) **(403.9, 358.9)**
  2. « Pièces qui s'emboîtent » — centre **(318.5, 193.6)**
  3. « Imprimée en 3D, finie à la main » — centre **(405.5, 141.8)**
  (pour `hd_027` 960×720 : multiplier ces centres par 1,5.)
Zoom ×2,2 vers chaque centre en `drawImage` (source rect centré sur le point, borné à l'image), image = `hd_027` si chargée et largeur ≥ 768, sinon `f_027`. Entre deux arrêts, interpolation douce du centre. Fin de T3 : retour ×1.

**T4 (42→55 %) « Lumière »** — H2 : « Une finition qui se touche. » ; phrase : « Ponçage, apprêt, peinture : la lumière ne ment pas. »
Fondu enchaîné (0,3 s de scroll) vers la séquence `lumiere/f_000..015` (index suit le scrub). Image 3:2 : la dessiner en « contain » dans un cadre arrondi 16 px, bordure var(--line), sans bandes noires visibles (le fond est déjà #161514, donc dessiner centré suffit). Léger `scale 1.04→1`.

**T5 (55→72 %) « Aimants, bouton, LED »** — c'est le moment fort, l'idée de Nolann : « tu scrolles, ça la soulève rapidement, tu scrolles vers le bas, ça la remet en place, et t'as un petit clic autour, un peu en motion, pour dire : c'est ré-aimanté ». Sans en faire trop.
  - 55→57 % : retour à la boule (`aimant/f_013`, pièces en place). Texte H2 « Aimantées, amovibles. » + phrase « On les retire, on les remet : clac. »
  - 57→60 % : index 13→0 RAPIDE (ease `power3.out` sur cette portion) : les pièces se soulèvent.
  - 60→65 % : index 0→13 (ease `power2.in`, elles retombent et se clipsent).
  - **Le « clac »** : quand l'index atteint 13 en REVENANT (on est passé par 0 juste avant, dans un sens de scroll ou l'autre), jouer UNE fois une animation hors scrub (gsap.to, ~0,45 s) : un anneau fin 2 px couleur accent, centré sur le noyau (centre image **(318.5, 193.6)** mis à l'échelle du canvas), `scale .6→1.4`, `opacity .9→0` + un deuxième anneau plus pâle décalé de 80 ms ; et la pièce « tape » : canvas `scale 1→1.012→1` en 0,18 s. Réarmer le déclencheur seulement si l'index repasse sous 4. Le petit texte « clac » n'apparaît pas à l'écran : seul l'anneau le dit. Les aimants ne se voient pas : la phrase explique.
  - 65→72 % : H2 « Un bouton, et elle s'éclaire. » ; chenille LED : sur `aimant/f_013`, allumage progressif t 0→1 piloté par le scrub (voir LED ci-dessous).

**T6 (72→84 %) « L'ESP rentre »** — H2 : « Le cerveau rentre dedans. » ; phrase : « Microcontrôleur, LED, câblage : intégrés dès la conception. »
Index `esp` 0→15. À la dernière image : la chenille entière (t=1) apparaît en flash d'opacité 0→1→0,6 (gsap, une fois, réarmé si on remonte sous l'image 12).

Fin de la scène (84 %→100 %) : la chenille reste allumée à 0,6, le canvas descend en opacité à 0,25 pendant que le premier bloc de texte du temps 7 monte (transition vers le défilement normal). Barre de progression pleine.

**T7 (après la scène, défilement normal, PEU de hauteur)** — Récit, 3 lignes qui entrent une par une (y 6px, 0,5 s, décalage 120 ms, IntersectionObserver ou ScrollTrigger simple) :
  « Tout part d'une idée, parfois d'un simple croquis. »
  « On la conçoit pièce par pièce, électronique comprise. »
  « Elle arrive prête à être montrée, manipulée, allumée. »
Puis H2 « Et encore plus » + grille de 6 cartes (3 colonnes ≥ 1024, 2 colonnes ≥ 560, sinon 2 colonnes compactes — PAS 1 colonne, pour limiter le défilement) ; carte = fond var(--card), bordure var(--line), rayon 16 px, padding 20 px, micro-SVG 40×40 trait 1,5 px accent (stroke, pas de remplissage, `stroke-linecap: round`), titre Space Grotesk 600 + une ligne Inter muted :
  - Écran — « Afficher une donnée, un texte, une image. » — SVG : petit écran, 3 rangées de pixels qui défilent (boucle 2 s).
  - Mouvement — « Un moteur, une pièce qui tourne ou se lève. » — engrenage qui tourne (6 s linéaire).
  - Capteur — « Elle réagit quand on approche ou qu'on touche. » — point + 2 ondes qui s'élargissent.
  - Son — « Une voix, un bruitage, une ambiance. » — 4 barres d'égaliseur.
  - Connecté — « Pilotée depuis un téléphone ou un écran. » — 3 arcs wifi qui s'allument tour à tour.
  - Votre idée — « Une envie précise ? On l'étudie avec vous. » — ampoule qui se trace (`stroke-dasharray/dashoffset`).
  Entrée des cartes décalée de 60 ms. Boucles SVG en CSS pur, en pause hors écran (`animation-play-state` via IntersectionObserver) .

**T8 (CTA)** — Carte centrée large : H2 « Parlons de votre maquette. » + phrase « Décrivez votre projet : on revient vers vous avec une proposition. » + bouton accent « Décrire mon projet » → `<a href="https://nasap3d.com/contact">` (fond #ff5a3c, texte #161514, rayon 999 px, padding 14px 22px, focus visible 2 px outline accent offset 3 px, hover légèrement plus clair) + lien secondaire texte « Explorez la cellule en 3D → » vers `https://nasap3d.com/maquettiste-nantes` avec la note muted « (la galerie 3D existante de la page, non dupliquée ici) ».

## Chargement (page légère)
- `const small = innerWidth < 768`. Sur `small`, ne charger qu'1 image sur 2 de chaque séquence (indices pairs + la dernière) et dessiner l'image chargée la plus proche ; `hd_027` jamais.
- Préchargement progressif : au chargement, seulement `eclate/f_000` ; dès que la scène approche (IntersectionObserver rootMargin 50 %), éclaté ; quand la progression passe 20 %, lumière + aimant + led ; à 45 %, esp. `img.decoding='async'`, `new Image()` puis `await img.decode()` ; cache des images dans des tableaux.
- **Petit loader** : tant que les images du temps courant ne sont pas prêtes, un mini anneau 16 px qui tourne (accent, 1 s) dans le coin bas-droit de la boîte canvas, avec texte sr-only « Chargement ». Il disparaît (opacity) dès que c'est prêt. Jamais d'écran bloquant.
- Dessin : une fonction `render()` appelée par `onUpdate` de la timeline, qui calcule l'état (séquence, index, recadrage, alpha LED) et ne redessine QUE si cet état a changé (comparer une clé). `canvas` dimensionné `clientWidth × dpr` (dpr max 2), recalculé au resize (`ResizeObserver`). Transform/opacity seulement pour les éléments DOM.

## LED chenille (reprendre cette méthode du site, adaptée)
Une seule extraction, faite quand `led/rank.webp` et `led/glow.webp` sont décodées (pas dans le scrub) :
```js
const LED_W = 800, LED_H = 600, LED_FADE = 0.12;
// canvas hors écran sc (800x600), lc (800x600) ; idat = lctx.createImageData(800,600)
// R = pixels de rank, G = pixels de glow (drawImage puis getImageData)
// RK[p] = R[p*4]/255 si alpha R > 0, sinon -1 ; 6 passes : un pixel de glow sans rang prend le plus petit rang voisin (8 voisins) ;
// L = { n, pos: Uint32Array, rank: Float32Array, rgba: Uint8Array } avec les pixels où glow alpha>0 et RK>=0
function paintLed(L, t) {
  const d = idat.data, te = t * (1 + LED_FADE); d.fill(0); if (te <= 0) return false;
  for (let j = 0; j < L.n; j++) { const vis = (te - L.rank[j]) / LED_FADE; if (vis <= 0) continue;
    const o = L.pos[j], q = j*4, f = vis >= 1 ? 1 : vis;
    d[o]=L.rgba[q]; d[o+1]=L.rgba[q+1]; d[o+2]=L.rgba[q+2]; d[o+3]=L.rgba[q+3]*f; }
  lctx.putImageData(idat, 0, 0); return true; }
```
Puis dans `render()` : après avoir dessiné l'image de base (même rectangle de destination dx,dy,dw,dh), `ctx.globalCompositeOperation='lighter'; ctx.globalAlpha=alphaLed; ctx.drawImage(lc, dx,dy,dw,dh)` ; plus un halo : copie de lc réduite à 160×120 redessinée à l'échelle à 0,7 d'alpha ; puis remettre `source-over` et alpha 1. Mettre `paintLed` en cache par valeur de t arrondie à 1/200 pour ne pas recalculer. Les calques LED ne se dessinent QUE sur `aimant/f_013` et `esp/f_015` (même cadrage) — jamais sur l'éclaté.
Si `getImageData` lève une SecurityError (fichier ouvert en file://), attraper l'erreur et dessiner simplement `glow.webp` en `lighter` avec l'alpha (pas de chenille, mais rien ne casse).

## prefers-reduced-motion (et GSAP absent)
Pas de pin ni de scrub : la scène devient une suite verticale de 6 blocs (texte + une image fixe en `<img>` loading=lazy, cadre 4:3 arrondi) : T1 `eclate/f_000` (pas de flou), T2 `eclate/f_027`, T3 trois vignettes recadrées de `eclate/f_027` (CSS `object-position`/scale dans un cadre `overflow:hidden`) avec leurs étiquettes, T4 `lumiere/f_008`, T5 `aimant/f_013` + `led/glow.webp` superposé en `mix-blend-mode: screen`, T6 `esp/f_015` + glow pareil. Cartes T7 sans boucle d'animation, entrée sans mouvement. Tester aussi le cas `typeof gsap === 'undefined'` → même rendu.

## Accessibilité / qualité (checklist web-design-guidelines + design-critique)
- Hiérarchie : un seul H1 (T1), H2 pour chaque temps ; les textes de la scène restent dans le DOM (pas seulement dans le canvas), le canvas a `role="img"` + `aria-label` qui décrit le temps courant (mis à jour au changement de temps seulement).
- Contraste ≥ 4,5:1 pour le texte (muted #a8a29b sur #161514 OK) ; tailles : H1 clamp(2rem, 5vw, 3.6rem), H2 clamp(1.5rem, 3.4vw, 2.4rem), corps 1.05rem/1.6.
- Cibles cliquables ≥ 44 px ; focus visible ; `:focus-visible` seulement.
- Pas de texte coupé à 375 ; pas de veuves de 1 mot sur les H2 (`text-wrap: balance`).
- Espacement par grille/flex + `gap`, pas de marges en cascade.
- Pas d'emoji, pas d'icône gadget, pas d'ombre lourde ; l'objet flotte sur le fond (pas de cadre autour du canvas hors T4).
- Mots INTERDITS dans tout le fichier (textes, commentaires, alt) : le symbole euro, « gratuit », « paiement », « Aptatio », tout nom de client. Ne rien ajouter comme texte visible au-delà de ce brief.

## Ce que tu rends
Le chemin de `index.html`, sa taille, et en 10 lignes max : la structure (sections), les points du brief que tu n'as pas pu faire exactement (avec la raison), et la liste des endroits où tu as dû choisir toi-même.
