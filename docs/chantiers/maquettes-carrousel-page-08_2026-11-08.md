# Passe Opus des maquettes carrousel + /maquettiste-nantes (08/11/2026)

Session fille Opus lancée par « NASAP [maquettage B2B] storyboard en page, finitions ». Brief : `brief-opus-carrousel_2026-11-08.md`.
Code écrit par le fil principal Opus (pas executant-ui), la mission exigeant un design de niveau Opus.

## Fichiers
- `docs/maquettes/carrousel-projets_2026-11-08.html` : maquette autonome, repart de la v05 validée par Nolann.
- `docs/maquettes/page-maquettiste-nantes_2026-11-08.html` : page 05 + blocs PJ:CSS/HTML/DATA/TPL/JS du carrousel 08 recopiés tels quels.
  Générée par `build_page_0811.py` (scratchpad de la session ; chaque ancre est vérifiée, rien d'autre de la page 05 ne change).
- Commit local d5b7044 (4 fichiers de docs/maquettes/, non poussé). Les v05 y sont ajoutées comme « avant » ; les v06 (commit 845fad7) servent de référence.
- Serveur de maquette : `python -m http.server 4380 --bind 127.0.0.1` à la racine du worktree, puis `http://127.0.0.1:4380/docs/maquettes/…`.
- Planches avant/après : dossier de notes partagé `local_5eab4690…/planches-maquettes-08/` (1 carrousel 1440, 2 carrousel 375+768, 3 page 1440, 4 page 375+768).

## Ce qui change par rapport à la v06
- Base 05 conservée : animations d'entrée, rendus 3D fixes gardés en slides dans le zoom.
- Filtres retirés. L'ordre est éditorial : les projets 3D viennent en tête.
- Le « 1 sur 8 » peu clair est remplacé par :
  - un compteur « 01–03 sur 08 » collé aux flèches ;
  - 8 repères cliquables en tête (un par projet).
- Le zoom contient :
  - des vignettes (photos, rendu 3D, vue 360°) ;
  - une visionneuse 360° (glisser, flèches, rotation auto) ;
  - le projet précédent/suivant avec miniature.
- Pas de rangée du bas.
- Le h2 du dialog n'est plus vide dans le DOM : le zoom est un `<template id="pj-zoom-tpl">`.
- Fermeture et bouton Retour sont fiables (drapeau `closing` sur popstate).
- Page : la section 08 « Nos maquettes » devient le carrousel réel. Le placeholder `<MaquetteCarousel />` est remplacé par 3 tuiles « Faire tourner en 3D » (#s-3d) qui ouvrent le zoom directement sur la vue 360°. Le texte SEO du bloc 3D est recopié à l'identique.
- Tokens du site partout : #161514 / #1a1917 / #201d1b, accent #ff5a3c, Space Grotesk + Inter, bordure rgba(255,255,255,.1). Entrée en translateY(6px) sur 0,5 s. prefers-reduced-motion est respecté (vérifié par capture).

## SEO : rien de retiré (diff automatique `seo_diff.py`)
- **Page 05 → 08** :
  - title : seule la date change ;
  - meta : 4/4 ;
  - JSON-LD identique ;
  - h1-h3 : rien de perdu, 8 h3 en plus (cartes) ;
  - liens : rien de perdu, 12 href en plus ;
  - alts : rien de perdu, 11 en plus, dont 3 alts vides sur les tuiles 3D décoratives ;
  - textes : 3 fragments absents, qui sont des notes de dev du placeholder ;
  - « Lire la suite » ×2 et les 14 `details` sont identiques.
- **Carrousel 05 → 08** :
  - le filtre « Tous » est retiré (demandé) ;
  - le h2 du zoom, « Voir la fiche projet », « Un projet similaire ? », `#` et `/contact` sont déplacés dans le `<template>`, pas supprimés.

## Le scrollWidth 1018 à 375 (vu le 06/11) : expliqué et corrigé
- **Cause** : bug hérité de la page 05, sans lien avec le carrousel.
  - Sur mobile, `.split` passe en `grid-template-columns: 1fr`, et `1fr` = `minmax(auto, 1fr)`.
  - Quand une image ne charge pas (real-2 / real-17 en ERR_CONNECTION_REFUSED dans le navigateur intégré, au 1er chargement), l'`<img width=600>` affiche son alt. Sa largeur min-content (~1000 px) élargit alors la colonne à 1002 px, d'où sw = 1018/1019.
  - Reproduit à volonté en bloquant ces 2 images (v05, v06 et v08 avant correctif).
- **Correctif maquette** : `.split > *{min-width:0}`.
  - Vérifié : sw = cw à 375, 768 et 1440, avec 2 images bloquées et avec TOUTES les images bloquées.
- **Correctif carrousel** : `.z-grid` mobile passe de `1fr` à `minmax(0, 1fr)` (débordement fugace 384/375 pendant l'ouverture du zoom).
- **À reporter dans Astro** : `min-width:0` sur les enfants de `.split` (ou `minmax(0,1fr)`) dans le vrai CSS de `/maquettiste-nantes`.

## Vérifications
- 0 scroll horizontal à 375, 768 et 1440, sur les 2 fichiers.
- Les 8 zooms ouverts un par un à 375 : propres. Seul `#z-strip`, défileur interne voulu, déborde.
- 0 erreur JS, hors favicon 404 du serveur de maquette.
- Captures 375/768/1440 haut, tuiles, zoom ouvert, 360°, plus reduced-motion à 1440.

## Écarts connus (assumés)
- À 375, les noms précédent/suivant (`.zp b`) sont coupés à 2 lignes avec une ellipse : voulu.
- La barre de maquette `.vbar` repliée (pastille) recouvre un coin de carte à 375. À 768 elle est ouverte. C'est un outil de maquette, non livré.
- Les 3 tuiles 3D ont un alt vide : elles sont décoratives, et leur titre texte est juste à côté.

## Décisions prises par défaut (option sûre, à confirmer par Nolann)
- Vraies pages `/realisations/<slug>` : oui (audit SEO).
- 1 carte par projet : oui.
- Les 8 projets : tous gardés.
- 4 textes d'une ligne : inchangés dans la maquette, à étoffer au branchement.
- Logo real-5 et ses 2 alts : inchangés dans la maquette (diff alts 05→08 = 0), à corriger au branchement.
- Bouton devis « Un projet similaire ? » : libellé gardé.
- h2 vide du dialog : réglé par le `<template>`.
- `.vbar` à 375 : repliée au départ.

## Notes pour le branchement Astro
- Données : `src/data/realisations.ts`. HTML serveur : `ProjectsCarousel.astro`, `<script>` inline, sans React.
- `history.pushState` vers `/realisations/<slug>` (dans la maquette : `#projet-<slug>`, file:// oblige). Images : `<Image>` avec srcset 400/800/1200.
- « Rythme : Sobre » de la barre Variantes ne calme pas le carrousel : il suit seulement prefers-reduced-motion.
