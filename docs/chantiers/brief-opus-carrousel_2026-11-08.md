# Brief : passe Opus ultracode sur le carrousel + la page /maquettiste-nantes (à coller dans une NOUVELLE conversation)

Dossier : le worktree `.claude/worktrees/maquettage-b2b-propre` (branche `claude/maquettage-b2b`). Modèle : **Opus**, effort **ultracode**. Lire d'abord `SUIVI.md` (file 5, 13, 15) et le `CLAUDE.md` du projet.

## Mission
Repasser en vrai Opus sur les 2 maquettes HTML autonomes (jamais touché au code Astro) :
- `docs/maquettes/carrousel-projets_2026-11-06.html` (v2, faite en Sonnet)
- `docs/maquettes/page-maquettiste-nantes_2026-11-06.html` (v2, faite en Sonnet)
- Versions du 05/11 (faites par agents `architecte` Opus medium) gardées comme « avant ». Nolann les avait trouvées « exactement ce que j'avais en tête ».
- Source du texte SEO : `src/pages/maquettiste-nantes.astro`.

## Retours de Nolann
- Adore : animations, rendus 3D miniatures dans le zoom.
- N'aime pas : les filtres (v2 les a retirés), l'indicateur « 1 sur 8 » pas clair (v2 : repères + compteur « 01–03 sur 08 », à juger sur captures).
- La v2 « n'est pas bien » : à lui redonner le niveau Opus (polish, animation, cohérence avec le design du site).

## Contraintes dures
- Rien du travail SEO supprimé (textes, h1/h2/h3, meta, JSON-LD, URLs, alt, maillage ; le texte de « Lire la suite » reste dans le DOM).
- Design du site : fonds `#161514`/`#1a1917`/`#201d1b`, accent `#ff5a3c`, Space Grotesk + Inter, cartes arrondies bordure `rgba(255,255,255,0.1)`, entrée `translateY(6px)` 0,5 s, `prefers-reduced-motion` respecté.
- Mobile 375, tablette 768 (commerciaux, tactile), grand écran ; aucun scroll horizontal (un `scrollWidth` 1018 vu 1 fois sur 8 à 375 : à élucider).
- Ne rien pousser. Commit local seulement des fichiers de `docs/maquettes/` (git add ciblé, jamais `-A`). Ne pas toucher `public/storyboard/cellule/preview-onde.html`.
- Chrome headless ne descend pas sous ~500 px : iframe de la bonne largeur puis recadrer.

## À rendre
Maquettes mises à jour, captures vérifiées 375/768/1440 (zoom ouvert), rapport court (changements, avant/après), `SUIVI.md` file 5 réécrit, advisor avant « fini ». Points à trancher à noter dans SUIVI (option sûre) : pages `/realisations/<slug>`, 1 carte par projet, périmètre, 4 textes courts, logo real-5 + 2 alts, bouton devis, `h2` du dialog vide au chargement, barre « Variantes » qui couvre les contrôles à 375.
