# Comment le prix du devis instantané est calculé

Ce document explique la formule utilisée par `POST /quotes` (voir
`src/lib/pricing.ts` pour le code, `src/lib/slicer.ts` pour l'analyse du
fichier). Les deux exemples chiffrés ci-dessous sont **réellement exécutés**,
pas des calculs à la main — ce sont de vraies réponses de l'API contre une
vraie base de données, obtenues pendant le développement.

## Le principe : jamais confiance au navigateur

Le front-end n'affiche qu'une **estimation indicative** pendant que
l'utilisateur règle ses options. Le prix qui compte — celui envoyé à Stripe —
est **toujours recalculé côté serveur**, à partir du fichier réellement
envoyé, au moment de l'ajout au panier. Un visiteur qui modifierait le prix
affiché dans son navigateur (ou enverrait une requête directement à l'API
avec un prix inventé) n'obtient rien : l'API ignore tout montant venant du
client et ne calcule jamais qu'à partir de ce qu'elle a elle-même mesuré.

## Étape 1 — Analyser le fichier

Le fichier uploadé (STL/3MF/OBJ/STEP) est passé à **PrusaSlicer**, en ligne de
commande, avec un profil propre à la machine choisie automatiquement selon la
taille de la pièce (`server/slicer-profiles/`) :

1. `--info` donne l'encombrement (bounding box) — sert à choisir la machine
   (X1C/X2D 256×256×256mm, H2C 350×320×325mm) et à rejeter immédiatement une
   pièce trop grande pour toutes vos imprimantes, avant même de trancher.
2. `--export-gcode` tranche réellement le modèle avec les réglages du devis
   (matériau, qualité/hauteur de couche, taux de remplissage) et produit un
   G-code dont l'en-tête contient le **temps d'impression estimé** et le
   **poids de filament utilisé** — les mêmes informations que vous verriez
   dans votre propre logiciel de tranchage.

## Étape 2 — La formule de prix

```
coût matière   = (poids en g / 1000) × prix au kg du matériau
coût machine   = (temps estimé en minutes / 60) × taux horaire atelier
avant marge    = coût matière + coût machine + frais fixes (setup)
prix unitaire  = avant marge × (1 + marge %)

sous-total     = prix unitaire × quantité
remise %       = palier atteint par la quantité (5/15/50/100/500 → -5/-10/-15/-20/-30%)
total          = sous-total × (1 - remise %)
```

Tous les paramètres (`pricePerKgCents` par matériau, `hourlyRateCents`,
`setupFeeCents`, `marginPct`, les paliers de remise) sont des lignes en base
(`Material`, `Settings`, `DiscountTier`) — modifiables depuis l'admin (à
brancher côté écran dans la phase suivante), sans toucher au code.

### Pourquoi pas de « multiplicateur qualité » ou « multiplicateur matériau » séparé ?

Le cahier des charges initial envisageait des multiplicateurs qualité et
matériau en plus. En pratique, un vrai calcul physique les rend inutiles et
plus honnête :
- La **qualité** (hauteur de couche) influence déjà directement le temps
  d'impression mesuré par le slicer — une pièce en « Fine » (0,12mm) prend
  mécaniquement plus de temps qu'en « Rapide » (0,28mm), donc coûte déjà plus
  cher via le coût machine, sans coefficient arbitraire à définir à la main.
- Le **matériau** influence déjà le coût matière (prix/kg propre à chaque
  matériau) et peut aussi influencer le temps si vous réglez des vitesses
  différentes par matériau plus tard.

## Exemple chiffré n°1 — petite pièce, PLA, qualité Standard

Cube de test 30×30×30mm, PLA, remplissage 40%, qualité Standard (couche
0,2mm), quantité 3.

| Mesure par le slicer | Valeur |
|---|---|
| Poids | 16,98 g |
| Temps estimé | 33,7 min |

| Calcul | Détail | Résultat |
|---|---|---|
| Coût matière | 16,98 g ÷ 1000 × 22,00 €/kg | 0,374 € |
| Coût machine | 33,7 min ÷ 60 × 15,00 €/h | 8,425 € |
| Frais fixes | — | 3,00 € |
| Avant marge | 0,374 + 8,425 + 3,00 | 11,80 € |
| Prix unitaire | 11,80 € × 1,30 (marge 30%) | **15,34 €** |
| Sous-total (×3) | 15,34 € × 3 | 46,02 € |
| Remise | qté 3 < 5 → 0% | — |
| **Total** | | **46,02 €** |

## Exemple chiffré n°2 — pièce plus grosse, PETG, qualité Fine

Cube de test 50×50×50mm, PETG, remplissage 60%, qualité Fine (couche
0,12mm), quantité 1.

| Mesure par le slicer | Valeur |
|---|---|
| Poids | 102,36 g |
| Temps estimé | 241,47 min (4h01) |

| Calcul | Détail | Résultat |
|---|---|---|
| Coût matière | 102,36 g ÷ 1000 × 26,00 €/kg | 2,661 € |
| Coût machine | 241,47 min ÷ 60 × 15,00 €/h | 60,367 € |
| Frais fixes | — | 3,00 € |
| Avant marge | 2,661 + 60,367 + 3,00 | 66,03 € |
| **Total (qté 1)** | 66,03 € × 1,30 | **85,84 €** |

On voit bien ici que c'est le **temps machine qui domine largement** le prix
sur une pièce volumineuse en qualité fine — cohérent avec la réalité d'un
atelier où la place sur l'imprimante coûte plus cher que la matière.

## Les valeurs de départ (à ajuster)

Seedées par défaut, modifiables en base dès maintenant et bientôt depuis
l'admin :

| Paramètre | Valeur de départ |
|---|---|
| Taux horaire atelier | 15,00 €/h |
| Frais fixes (setup) | 3,00 € |
| Marge | 30% |
| Prix filament | PLA 22€/kg, PETG 26€/kg, ABS 24€/kg, ASA 28€/kg, TPU 32€/kg, Nylon 45€/kg, PP 30€/kg |

**Ce sont des estimations de départ, pas vos vrais coûts.** Une fois l'écran
admin de prix branché (prochaine étape), ajustez-les à vos chiffres réels.

## Limites connues

- **Vitesses d'impression approximées.** Les profils PrusaSlicer utilisent des
  vitesses génériques « imprimante CoreXY rapide », pas un calibrage réel de
  vos machines. Vous nous avez proposé de fournir vos réglages BambuStudio
  réels (au moins pour la H2C) — une fois reçus, `server/slicer-profiles/`
  sera mis à jour pour coller à vos temps réels.
- **Assemblages multi-pièces complexes** (ex. un fichier CAO avec plusieurs
  corps mal positionnés) peuvent échouer à l'analyse — l'API renvoie une
  erreur claire plutôt qu'un prix faux.
- **Devis à durée limitée** (`quoteExpiryMinutes`, 60 min par défaut) : au-delà,
  le devis doit être refait avant achat, pour ne jamais facturer un prix basé
  sur d'anciens tarifs matière.
