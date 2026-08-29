# Profils PrusaSlicer par imprimante

Un fichier `.ini` par machine, au format "config plat" que PrusaSlicer écrit
avec `--save` (clé = valeur, sans en-têtes de section — voir
`server/PRICING.md` pour comment ces fichiers sont testés).

Ces profils ne couvrent que ce qui est **propre à la machine** (plateau,
hauteur max, diamètre de buse). Tout ce qui dépend du devis (matériau,
qualité, remplissage, quantité) est injecté par `src/lib/slicer.ts` à chaque
requête, à partir des valeurs en base (`Material`, `QualityProfile`).

**Ce sont des valeurs de départ raisonnables, pas un calibrage de vos
machines.** Pour un résultat vraiment fidèle à ce que vous obtenez sur
BambuStudio, le mieux est d'exporter les réglages vitesse/accélération de vos
profils BambuStudio réels et de les reporter ici (`max_print_speed`,
`perimeter_speed`, `infill_speed`, `travel_speed`, accélérations...) — dites-le
moi et on affine ensemble une fois que le reste tourne.

| Fichier   | Machine       | Plateau (mm) | Hauteur max (mm) |
| --------- | ------------- | ------------ | ---------------- |
| `x1c.ini` | Bambu Lab X1C | 256×256      | 256              |
| `h2c.ini` | Bambu Lab H2C | 330×320      | 325              |
| `x2d.ini` | Bambu Lab X2D | 256×256      | 256              |
