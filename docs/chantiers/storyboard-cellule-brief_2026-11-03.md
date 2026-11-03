# Brief storyboard « cellule » pour /maquettiste-nantes (Nolann 03/11) : À FAIRE EN OPUS (architecte/Fable), nouvelle conversation

Artifact v1 (générique, À REFAIRE) : https://claude.ai/artifact/9az7LYrVJrfeLZzEiMFQsU ; source : scratchpad de la session `fa43e866…/storyboard.html` (copie conseillée dans `docs/chantiers/`).

## Séquence voulue par Nolann (scroll)
1. Arrivée : texte « maquettage professionnel… » + la maquette FLOUE, loin, on ne comprend pas ce que c'est.
2. Au défilement : elle devient nette puis ÉCLATE (tout l'intérieur visible).
3. Petits zooms : électronique, intégration, impression 3D.
4. Zoom finition peinture : très beau produit, JEU DE LUMIÈRE sur la qualité de surface + microtexture (pas d'animation de pinceau).
5. Retour sur la boule : pièces amovibles AIMANTÉES (jaune, verte, bleue, grises du centre = déjà des pièces aimantées dans la vraie maquette), petit bouton, animation LED chenille pour finir.
6. ESP + bandeau/points LED « arrivent et rentrent dans la boule » pour se combiner. Très réaliste ; « faut que ça claque ».
7. Ensuite retour au site avec le texte (le texte devient une histoire), puis « Et encore plus » (écran, mouvement, capteur, son, connecté, votre idée) : il adore, juste des visuels moins moches ; peu de défilement pour ne pas lasser.
8. Garder les petits loaders, page légère (pas « 10 ans à charger »). La scène « Explorez en 3D » = la galerie existante (MaquetteCarousel), à ne pas dupliquer.

## Faits sur la vraie maquette (déjà existante, ne pas refaire de rendus en masse)
- `Source machine/glb/` (hors dépôt) : `cellule.blend`, `cellule.glb`, `build_cellule.py`, `renders_base/`, close-ups `cellule-led/bouton/face/grain.png`.
- Dépôt : `public/assets/maquettes/cellule/{base,sm,glow,rank}` : 216 images e12_a000…a215 ; `sm` = **avif seulement** (3 webp), base/glow/rank en webp ; méthode LED chenille = `src/components/MaquetteCarousel.astro` (rank ≤ t, glow).
- Nolann : le modèle contient peut-être déjà les LOGEMENTS de l'ESP (à vérifier dans le blend) ; les points LED lumineux existent déjà (bouchons verts émissifs) = chemin du bandeau ; pas de bandeau LED ni d'ESP modélisés : mettre juste de petits points LED si le bandeau est trop. Il peut colorier dans Blender les faces où le bandeau doit passer.
- ESP32 : modèle libre à chercher en ligne (vérifier licence). GSAP : vérifier licence. Éclaté = à rendre depuis `cellule.blend` (skill `blender-anim-web`, une seule instance Blender).

## Contraintes
Aucun client cité, pas d'Aptatio, 0 « € », pas de « gratuit / avant paiement ». Design du site (#161514, #ff5a3c…). reduced-motion, poids mobile < ~450 Ko, poster pour le LCP. Un seul pop-up de validation à la fin.
