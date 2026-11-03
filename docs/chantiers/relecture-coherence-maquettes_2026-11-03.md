# Relecture de cohérence des 2 pages maquette (agent Fable, 03/11/2026)

M = src/pages/maquettiste-nantes.astro, I = src/pages/maquette-industrielle.astro. Lignes d'avant la fusion des types (à relocaliser par grep). Aucune correction ne retire un mot-clé SEO. Contrôles OK : 0 « € », 4 types = 4 cartes, offerTypes = types, FAQPage/Service cohérents, 360° actifs.

## MOYEN
1. M : ordre des étapes. Mettre : 1 « Vous décrivez le projet » / 2 « Expertise gratuite » (« Nous étudions la faisabilité et vous répondons avant tout paiement. ») / 3 « Idéation et modélisation 3D » / 4 inchangé. (I est déjà dans le bon ordre.)
2. I : cas « Cellule avec animation LED… médiation scientifique » sous le h2 « Maquettes industrielles réalisées » = cas pédagogique. Remplacer par « Bioréacteur en inox » (« Maquette d'équipement de procédé avec vannes, leviers et manomètres à l'échelle, rendu inox. », photo real-19) ou retitrer le h2 « Maquettes réalisées avec LED et pièces mobiles ».
3. I : 5 FAQ sur 8 quasi identiques à M (démontable, délais, coût, NDA, livraison). Retirer de I les FAQ NDA et livraison ; reformuler délais/coût (« Comptez d'une semaine à un mois selon la complexité de la machine ; une urgence se traite si vous donnez l'échéance dès le départ. »).
4. Mêmes photos, légendes différentes (real-1, 2, 19, 21) : aligner M sur les légendes de I (plus précises).
5. M : retirer « produit ou gamme » de la carte industrielle/commerciale et « et produits » de l'offerType (chevauche « design produit »).
6. M : deux sections « processus » ; garder la prose, supprimer la note finale (redite de réactivité/urgences).

## BAS
7. « gratuit / avant tout paiement » ~10 fois sur M : supprimer la redite en fin des textes (étude, confirmation, « Chaque commande… acceptée », prose « Chaque projet… paiement ») ; garder une seule des deux phrases dans l'étape 2. I : fin de la FAQ livraison redondante.
8. M prose : « maquette d'architecture, <a>maquette industrielle</a>, commerciale et de salon, maquette pédagogique ou scientifique, maquette de design produit ».
9. M JSON-LD description : « Atelier de maquettiste à Nantes : idéation, conception, modélisation 3D et fabrication de maquettes sur mesure (industrielles, architecture, salon, pédagogiques, design produit), avec LED et pièces mobiles. Étude de faisabilité gratuite avant tout paiement, livraison en France. »
10. M hero : « puis fabrication (impression 3D, ponçage, peinture, LED et pièces mobiles). » ; « Ce qui distingue notre maquettiste » → « notre atelier de maquettiste ».
11. I : usage salon : couper « remplace une machine trop grosse ou trop lourde à déplacer » (redite du hero).
12. Vocabulaire : « expertise gratuite » vs « étude de faisabilité » (CLAUDE.md impose « expertise ») : unifier si voulu.
