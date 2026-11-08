# Retours n°3 de Nolann sur la page 08 (08/11/2026, dictés + pop-up, reçus par la session Opus)

Suite de `retours-nolann-n2_2026-11-08.md` (points 1 à 8). Numérotation continue.

## Décisions
9. **Texte : « Blocs courts » retenu** (préféré à « Chapeau + suite »). « Animé au scroll » : il aime, on garde.
   - Bug : un bloc est « ratatiné dans un coin ». C'est « Usages : retail et PLV… » : 492 px de large dans une colonne de 1009 px, à 1440 (cause : `body.t-short .usages{max-width:52ch}`). En « Chapeau + suite », il était bien. Les blocs courts doivent suivre la largeur de leur colonne à toutes les tailles. Mesuré aussi : « Caravane de présentation… » et « nous intégrons… » font 525 px dans une colonne de 760 px.
   - Majuscules : chaque bloc doit commencer par une majuscule. Le bloc « nous intégrons l'électronique directement dans la… » commence en minuscule (c'était la fin d'une phrase coupée). Vérifier tous les blocs.
   - Faire de « Blocs courts » + « Animé au scroll » le rendu par défaut de la page.
10. **« Quatre types de maquettes »** : la barre proposait Grille 2×2 / Liste. Il répond : « il y en aura de plus en plus, donc prévois que cela bouge facilement ».
    - Faire une grille qui s'adapte au nombre de cartes (5, 6, 7…) : pas de trou bizarre et pas de carte seule sur sa ligne, de 375 à 1920. Retirer la variante « Liste ».
    - Le titre « Quatre types… » deviendra faux dès la 5e carte. Il est référencé (h2) : le garder tel quel pour l'instant et poser la question à Nolann (ex. « Nos types de maquettes sur mesure »).
11. **Pages par projet `/realisations/<slug>` : GO**, à condition que ça ne pollue pas le SEO (réponse : pas polluant si chaque page a son propre contenu).
    - Règle : une page seulement pour un projet qui a assez à dire (~300 mots : besoin, contraintes, solution, matière, taille, délai), avec un titre, une meta et des alts uniques.
    - Les projets trop maigres n'ont pas de page tant que le texte n'existe pas : dans le zoom, « Voir la fiche projet » est masqué pour eux.
    - Branchement Astro plus tard, pas dans la maquette.
12. **« Un projet similaire ? »** : `/contact` simple, sans pré-remplissage. Rien ne change.
