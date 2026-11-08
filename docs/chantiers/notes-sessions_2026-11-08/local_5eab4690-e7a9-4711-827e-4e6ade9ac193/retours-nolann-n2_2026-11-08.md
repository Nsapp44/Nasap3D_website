# Retours n°2 de Nolann sur la page 08 (08/11/2026, dictés, reçus par la session Opus « maquettes 08 »)

Capture jointe : `retours-n2_cartes-chiffres.png` (cartes chiffres du hero, ~448 px de large).
Page regardée : `http://127.0.0.1:4380/docs/maquettes/page-maquettiste-nantes_2026-11-08.html`.

## À changer
1. **Cartes chiffres du hero** (« 1 sem. – 1 mois », « 6 étapes », « 360° », « France ») : « j'aime pas, ça fait bizarre ». Sur la capture : « 1 sem. – 1 mois » casse sur 2 lignes, gros chiffres orange, légendes petites avec un interligne très large. Garder les 4 infos, refaire la forme.
2. **Transition hero → storyboard cellule** : en descendant, il faut « arriver sur » le storyboard, pas voir ce qu'il y a dessous, taper dedans, puis continuer. Il veut « une belle transition ». Le hero reste tel quel (Atelier maquettiste à Nantes, partout en France, 6 étapes…). C'est du travail créatif : recherche, puis 2-3 pistes avec références dans un pop-up.
3. **« Le saviez-vous » après le storyboard : à retirer** (« on vient de se taper le storyboard complet, donc ils le savent »). Règle SEO : lancer seo_diff et lui dire ce qui disparaît. Si une phrase porte un mot-clé, la recaser ailleurs plutôt que la perdre.
4. **Section « Maquettes interactives et intégration électronique »** :
   - Titre : ajouter « design produit ». Le système de filtration et le bioréacteur ne sont ni interactifs ni électroniques.
   - Trop de texte : réduire à une description rapide (texte retiré = même règle SEO qu'au 3).
   - Photos gardées : il fournira d'autres maquettes interactives.
   - « Écran, affichage, interaction lumineuse : normalement tu avais les petits trucs animés, pourquoi tu les as enlevés ? » Dans les maquettes 05/06/08 et dans `src/pages/maquettiste-nantes.astro`, les 4 cartes (Écrans et affichages, LED, Boutons et capteurs, Pièces mobiles) ont des icônes fixes. Les animations viennent donc d'ailleurs : chercher dans l'Artifact 9az7LYrVJrfeLZzEiMFQsU (page_v3), `git log -S`, les autres conversations. Les remettre, sinon le lui dire.
5. **Carte « Maquette industrielle »** (bloc « Ce qui nous distingue », seule carte cliquable, mène à /maquette-industrielle) : elle se distingue par sa couleur, mais il faut qu'elle « bouge un peu » au survol, « comme c'était le cas », pour qu'on comprenne qu'elle est cliquable. Sur tactile : un indice visible sans survol.
6. **Tuiles « Explorez nos maquettes en 3D »** (il adore) : pourquoi « 3D » ET « 360° » ? C'est pareil, il n'en faut qu'un des deux. Vérifier aussi le badge des cartes du carrousel.
7. **Carrousel « Nos maquettes »** (« j'adore, l'animation est vraiment cool ») : il faut qu'il reste **au milieu**, centré dans la colonne (« pour le responsive ce sera plus simple »), et qu'il **avance par bloc selon le nombre de projets**, sans jamais de trou : aujourd'hui il y a un trou à droite à la fin et un trou à gauche avant. Il ajoutera des projets : rien ne doit dépendre de 8. Option sûre : fenêtre centrée sur la colonne, première position calée à gauche, dernière calée à droite (dernier pas raccourci), compteur et repères recalculés.

8. **« Lire la suite » / « Réduire »** : l'idée lui plaît (« ça cache le texte qui sert à rien », et on garde le texte pour le SEO), mais l'animation d'ouverture et de fermeture est « nulle à chier ». La refaire : hauteur animée en douceur, sans saut ni clignotement, à l'ouverture comme à la fermeture, avec prefers-reduced-motion respecté.

## Validé (ne pas toucher)
- Zoom : se ferme en cliquant à côté ou sur la croix (« très bien, très agréable »).
- « De l'idée à la maquette » et ses étapes (idéation, étude de faisabilité, fabrication, livraison en France) : « j'aime beaucoup ».
- Bouton « Demander un devis sur mesure » et lien « comment ça se passe ».
- « Un bureau d'études et un atelier sous le même toit », « Nous faisons plus que des maquettes », « Design produit, modélisation et maîtrise de nos outils ».
- « Usage », « Voir nos maquettes industrielles », « Toutes nos réalisations » (→ /realisations).
- « Ce qui nous distingue », « De la maquette à la petite série », carte « Maquette de design produit » (bonne photo, il en ajoutera).
- Zoom : projet suivant / précédent, « Voir la fiche projet » (1 lien par page /realisations/<slug>).

## Question posée par Nolann (réponse faite par la session Opus, voir son message)
« Un projet similaire ? » mène où ? Les pages projet sont-elles utiles, ou est-ce trop ?

## Méthode
- Rappel : `build_page_0811.py` repart de la page 05, qui sert de référence « avant ». Les retouches de la page elle-même (points 1 à 6) ne doivent donc pas se faire dans la 05 : ajouter des remplacements au script, ou fixer une nouvelle base datée.
- Points 1, 2 et 7 = design sans base : `architecte` conçoit et vérifie par captures (déclencheur 6) ; `executant-ui` écrit.
- Captures avant/après côte à côte à 375, 768, 1024 et 1440, plus la tablette en paysage ; 0 débordement ; seo_diff ; commit local ciblé de docs/maquettes/ seulement, rien poussé, ne pas toucher `preview-onde.html` ni `src/`.
