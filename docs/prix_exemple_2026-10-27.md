# Exemple de prix chiffré par le vrai moteur (27/10/2026)

But : remplacer l'exemple à 31,76 € (jugé « ultra cher » par Nolann) par une pièce typique chiffrée par le moteur réel.

Méthode : tranchage Kiri:Moto 4.7.3 côté client (`public/kiri-slicer.js` `sliceWithKiri`, profils `kiriProfiles.ts`) dans Chrome headless, puis formule de `src/lib/server/pricing.ts:40-42` avec les valeurs du seed (PLA 22 €/kg, PETG 26 €/kg, 5 €/h, plancher 8,90 €). Script et sortie brute : dossier de notes partagé de la session (`prix-exemple/price.mjs`, `result.json`).

| Pièce | Réglages | PLA | PETG |
|---|---|---|---|
| Cube 50 mm | Standard 0,20 mm, 40 % (défauts du configurateur) | 86,4 g, 2 h 22, 13,72 € | 87,8 g, 2 h 22, **14,10 €** |
| Cube 50 mm | Fin 0,12 mm, 60 % | 106,9 g, 4 h 47, 26,25 € | 108,6 g, 4 h 47, 26,72 € |
| Cube 50 mm | Rapide 0,28 mm, 15 % | plancher 8,90 € | plancher 8,90 € |
| Plaque 60×40×5, 2 trous Ø5 | tous | plancher 8,90 € | plancher 8,90 € |

- **Choix de Nolann (pop-up 27/10) : cube PETG Standard 40 % = 14,10 €.**
- Panier sous 18 € : + 5 € de frais petite commande (`cart.ts:67-69`). Le cube seul revient donc à 19,10 €.
- L'ancien 31,76 € (PRICING.md, 5 h 49) venait d'une autre configuration du moteur : le moteur actuel donne 4 h 47 pour la même pièce.
- À vérifier avant de remplacer : que le prix facturé vienne bien de ce moteur client (le tranchage serveur `sliceModel()` dépend de `vendor/grid-apps`, présent seulement sous Linux/Docker).
- Défaut mineur relevé : `G1 XNaN YNaN` dans le gcode exporté (`extOffset` absent de `kiriProfiles.ts`), sans effet sur le poids, le temps ou le prix.
