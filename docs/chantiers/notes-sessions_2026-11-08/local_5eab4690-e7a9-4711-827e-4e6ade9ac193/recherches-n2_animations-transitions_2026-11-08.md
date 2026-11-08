# Recherches pour les retours n2 (08/11/2026, session Opus « carrousel + page »)

## A. Les « petits trucs animés » perdus (point 4) : Explore, TROUVÉS
- Ce sont les 6 cartes « Et encore plus » du storyboard cellule (Écran, Mouvement, Capteur, Son, Connecté, Votre idée), icônes SVG animées en CSS. Jamais dans src/ ni dans les maquettes 05/06/08 (là : `<use href="#i-screen">` statiques).
- Source : commit e5d52b3 (04/11), `docs/chantiers/storyboard.html` : CSS 99-118, markup SVG 200-225, JS 246-259. Copie plus récente hors git : `C:\Users\Nolann\Desktop\Nasap3D website\Source machine\glb\storyboard\page_v3\index.html` (CSS 98-117, markup 189-212).
- Retirées à l'intégration en hero (bd30e19), « doublon des atouts », OK de Nolann 05/11 (6d036dc). Il veut maintenant les retrouver sur Écran / LED / interaction lumineuse de la section s-inter.
- CSS exact :
```
@keyframes dash{to{stroke-dashoffset:-16}}
@keyframes tourne{to{transform:rotate(360deg)}}
@keyframes onde{from{transform:scale(.3);opacity:1}to{transform:scale(2);opacity:0}}
@keyframes barre{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
@keyframes wifi{0%,100%{opacity:.2}25%,60%{opacity:1}}
@keyframes trace{0%{stroke-dashoffset:1}60%,100%{stroke-dashoffset:0}}
html.mo .card .a{animation-play-state:paused;animation-iteration-count:infinite}
html.mo .card.live .a{animation-play-state:running}
html.mo .row{stroke-dasharray:5 3;animation:dash 2s linear infinite}
html.mo .gear{transform-origin:20px 20px;animation:tourne 6s linear infinite}
html.mo .wave{transform-origin:20px 20px;animation:onde 2s ease-out infinite}
html.mo .eq{transform-box:fill-box;transform-origin:50% 100%;animation:barre 1.2s ease-in-out infinite}
html.mo .arc{animation:wifi 2.4s ease-in-out infinite}
html.mo .bulb{stroke-dasharray:1;stroke-dashoffset:1;animation:trace 3s ease-in-out infinite alternate}
```
- SVG viewBox 40×40, `.card svg{width:40px;stroke:var(--accent);stroke-width:1.5;fill:none}`. Écran = rect + 3 `line.a.row` (décalages -.7s, -1.3s) ; Mouvement = `g.a.gear` ; Capteur = 2 `circle.a.wave` (-1s) ; Son = 4 `path.a.eq` ; Connecté = 3 `path.a.arc` ; Votre idée = `path.a.bulb pathLength=1`. `html.mo` posé seulement sans prefers-reduced-motion ; IntersectionObserver ajoute `.live` à la carte visible.
- Pas de carte « LED » animée à l'origine (la chenille LED est dans le canvas du storyboard) : l'ampoule qui se trace est la plus proche. Mapping proposé : Écrans = traits qui défilent ; LED = ampoule tracée ou chenille de 4-5 points qui s'allument en séquence (à dessiner) ; Boutons et capteurs = ondes ; Pièces mobiles = engrenage.

## B. Survol de la carte « Maquette industrielle » (point 5)
- Carte `a.card` dans « Quatre types » (page-08 ~l.615). Règle (page-08 l.121-127) : `a.card:hover{border-color:var(--acc);transform:translateY(-2px)}`.
- Cause probable (non vérifiée au rendu) : `.motion [data-rv].in{opacity:1;transform:none}` (l.170, spécificité 0,3,0) bat `a.card:hover` (0,2,1) ; la carte a `data-rv`, donc le translateY ne s'applique jamais ; son `transition` remplace aussi celui de `.card`. Correctif : sélecteur plus fort ou `translate:` (propriété indépendante de `transform`) + transition commune. Indice tactile : `@media (hover:none)` (flèche/libellé visible en permanence).

## C. Transition hero → storyboard (point 2) : chercheur-web, ~22 recherches
Rien de probant sur « l'image du hero devient la 1re frame ». Références exploitables :
- gsap-motion-lab VideoHero + ImageSequence (MIT, code lu) : https://github.com/vixonoffice/gsap-motion-lab : hero plein cadre → carte arrondie en scrub (`clip-path: inset(7% 5% 7% 5% round 32px)`), séquence épinglée, 1re frame en background CSS ; reduced-motion = aucun trigger.
- Forum GSAP 27594 (rideau, 2 triggers qui finissent au même point, matchMedia < 768) : https://gsap.com/community/forums/topic/27594-can-this-effect-be-achieved-using-scrolltrigger/
- CodePen GreenSock « Overlay Layered Sections » (non ouvert, 403) : https://codepen.io/GreenSock/pen/qEEJBGP
- Codrops SeamTransitions (MIT, lourd) : https://github.com/codrops/SeamTransitions ; StickySections (MIT) : https://github.com/codrops/StickySections
- CSS natif scroll-driven (`animation-timeline: view()`, `animation-range: exit`) : https://scroll-driven-animations.style/demos/cover-to-fixed-header/css/ ; guide Chrome https://developer.chrome.com/docs/modern-web-guidance/guides/ui-behaviors/scrollytelling . Baseline depuis le 27/10/2026 → `@supports` obligatoire.
- Licence GSAP : gratuite même commerciale (pas de facturation de l'accès). Skill officiel greensock/gsap-skills (MIT) non installé.
Pistes pour le pop-up :
- **A. Rideau** (forum 27594 + CodePen qEEJBGP) : le hero recule à peine (scale ~0.95, infos qui s'estompent), la scène 4:3 remonte par-dessus comme un volet puis se fige. 1 trigger GSAP. Difficulté faible. **Recommandée.**
- **B. Hero → carte arrondie → scène** (gsap-motion-lab) : le hero se rétrécit en carte arrondie, la scène s'ouvre dans cette fenêtre jusqu'au plein écran. Moyenne, à prototyper.
- **C. Sortie CSS native** (Builder.io + guide Chrome) : titre et infos se réduisent/estompent en quittant le hero, la scène GSAP prend le relais. Zéro JS, `@supports`. Faible.
Contraintes communes : H1 + 4 infos en HTML à opacity 1 au chargement (LCP), animés seulement au scroll ; reduced-motion = statique ; mobile `ignoreMobileResize`, DPR ≤ 2.
