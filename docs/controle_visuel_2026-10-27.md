# Contrôle visuel 27/10/2026 : constats restant à traiter

Source : critique `lecteur` sur les captures `out-all/` (avant corrections E1-E5, donc à revérifier après rebuild).

## Composants du chantier (corrigeables sans demander)
- **Prix, exemples** (GuidePriceCards.astro:25-27) : prix à des hauteurs différentes (libellé 1 ou 2 lignes) → `.gprice{display:flex;flex-direction:column;justify-content:space-between}` + `.gwhat{flex:1}`.
- **« Nos autres guides »** (GuideRelated.astro:47) @768 : titre sur 2 lignes, descriptions désalignées → `.grel-name{min-height:2.6em}` à ≥ 640 px (ou subgrid).
- **Tableaux** (GuideTable.astro:58) : « 103 / g », « 90- / 100 °C » coupés → vérifier `fr()` (nbsp avant g/°C/€/%) + tiret insécable U+2011 dans les plages, sinon `white-space:nowrap` sur les colonnes courtes.
- **Sommaire** (GuideToc.astro:22,25) @1280 : marqueurs « 10. » « 11. » plus larges que le retrait → `padding-left:2.2em` ; `@media (hover:hover) and (pointer:fine){.gtoc a{min-height:32px}}`.
- **h2 orphelin** « …livraison / et emballage » (prix@768) : vérifier le `text-wrap:balance` d'E4 sur GuideSection.
- **ExpertiseSteps.astro:45-46** : `.es-text` 12 px rgba .6 → 13 px rgba .7 (composant existant mais partagé : petit changement de lisibilité, à montrer).

## Design existant : décision de Nolann (pop-up)
- **Pied de page** (Footer.astro, toutes pages, reparer compris car partagé) : gouttière 40 px contre 24 px pour le contenu et 16 px pour l'en-tête (:26,38,44) ; texte 10 px rgba .35/.4, contraste ≈ 2,9:1 (:29-30,40-41,48-49,52) → 12 px rgba .6 ; lignes 1-2 centrées, ligne 3 gauche/droite (:28,39,45-46).
- **Page machines @1280** : hauteurs de photos 318/315/314 contre 200/200/297 (machines.astro:5-15, `height` inline) → une hauteur ou `aspect-ratio:4/3;object-fit:contain` ; « Autres machines » 5 cartes sur 3 colonnes (rangée finale incomplète) → grille 6 colonnes `span 2` centrée ; fonds photo gris/blanc mélangés ; textes 9,5-10,5 px rgba .5 ; CTA centré sur page alignée à gauche.
- **Réalisations** (realisations.astro:6-7, RealisationsCarousel.tsx:5-6) : « filtration systems — … » sans majuscule.

## À vérifier
- compte@768 : ~400 px de vide sous le pied (probable artefact de capture ; vérifier `main{flex:1}` dans BaseLayout.astro:90-99).
- machines@375 accueil : `@media (max-width:420px)` force 1 colonne (index.astro fin du `<style>`).
- Non regardé : maquettes@375 pleine page, compte/réalisations/reparer@375 pleine page, boutons < 44 px à 375.
- reparer-piece-3d : défauts notés (carte prix ≈ 590 px contre CTA ≈ 710 px, orphelin « les cotes ») mais **ne pas toucher**.
