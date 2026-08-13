# Comment le prix du devis instantané est calculé

Ce document explique la formule utilisée par `POST /quotes` (voir
`src/lib/pricing.ts` pour le code, `src/lib/slicer.ts` pour l'analyse du
fichier). Les exemples chiffrés ci-dessous sont **réellement exécutés**, pas
des calculs à la main — ce sont de vraies réponses de l'API contre une vraie
base de données, obtenues pendant le développement.

## Le principe : jamais confiance au navigateur

Le front-end n'affiche qu'une **estimation indicative** pendant que
l'utilisateur règle ses options. Le prix qui compte — celui envoyé à Stripe —
est **toujours recalculé côté serveur**, à partir du fichier réellement
envoyé, au moment de l'ajout au panier. Un visiteur qui modifierait le prix
affiché dans son navigateur (ou enverrait une requête directement à l'API
avec un prix inventé) n'obtient rien : l'API ignore tout montant venant du
client et ne calcule jamais qu'à partir de ce qu'elle a elle-même mesuré.

## Étape 1 — Analyser le fichier

Le fichier uploadé (STL/OBJ/STEP) est passé à **PrusaSlicer**, en ligne de
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
prix unitaire  = max(prix plancher, coût matière + coût machine)

sous-total     = prix unitaire × quantité
remise %       = palier atteint par la quantité (5/15/50/100/500 → -5/-10/-15/-20/-30%)
total          = sous-total × (1 - remise %)
```

Volontairement simple, à la demande : **pas de marge ni de frais fixe
séparés**. Si vous voulez de la marge, mettez-la directement dans le prix au
kg de chaque matériau (écran Stock de l'admin) — c'est là qu'elle vit
naturellement, pas dans un multiplicateur caché.

Trois paramètres pilotent tout :
- `pricePerKgCents` — un par matériau, modifiable depuis l'écran Stock de
  l'admin.
- `hourlyRateCents` — le taux horaire atelier, modifiable depuis l'écran
  Réglages de l'admin.
- `minUnitPriceCents` — le **prix plancher par pièce** (8,90 € par défaut) :
  une pièce dont le calcul tombe en dessous affiche directement ce prix,
  sans ligne "frais minimum" visible — le client ne voit qu'un prix normal.
  Différent du frais de petite commande (`smallOrderFeeCents`), qui lui
  s'applique au niveau du panier et **est** affiché avec une explication.

### Pourquoi pas de « multiplicateur qualité » ou « multiplicateur matériau » séparé ?

Un vrai calcul physique les rend inutiles et plus honnête :
- La **qualité** (hauteur de couche) influence déjà directement le temps
  d'impression mesuré par le slicer — une pièce en « Fine » (0,12mm) prend
  mécaniquement plus de temps qu'en « Rapide » (0,28mm), donc coûte déjà plus
  cher via le coût machine, sans coefficient arbitraire à définir à la main.
- Le **matériau** influence déjà le coût matière (prix/kg propre à chaque
  matériau).

## Exemple chiffré n°1 — petite pièce rapide, PLA, qualité Standard

Petite pièce (proche d'un benchy à échelle réduite), PLA, qualité Standard,
quantité 1. Taux horaire : 5,00 €/h.

| Mesure par le slicer | Valeur |
|---|---|
| Poids | 8 g |
| Temps estimé | 15 min |

| Calcul | Détail | Résultat |
|---|---|---|
| Coût matière | 8 g ÷ 1000 × 22,00 €/kg | 0,176 € |
| Coût machine | 15 min ÷ 60 × 5,00 €/h | 1,250 € |
| Avant plancher | 0,176 + 1,250 | 1,43 € |
| **Prix unitaire** | max(8,90 €, 1,43 €) → le plancher s'applique | **8,90 €** |

C'est le cas typique d'une petite pièce rapide : le calcul brut (matière +
temps machine) tombe largement sous le prix plancher, donc c'est ce dernier
qui fixe le prix affiché — sans que le client ne voie de ligne "minimum"
séparée.

## Exemple chiffré n°2 — pièce plus grosse, PETG, qualité Fine

Cube de test 50×50×50mm, PETG, remplissage 60%, qualité Fine (couche
0,12mm), quantité 1. Taux horaire : 5,00 €/h.

| Mesure par le slicer | Valeur |
|---|---|
| Poids | 103,16 g |
| Temps estimé | 348,9 min (5h49) |

| Calcul | Détail | Résultat |
|---|---|---|
| Coût matière | 103,16 g ÷ 1000 × 26,00 €/kg | 2,682 € |
| Coût machine | 348,9 min ÷ 60 × 5,00 €/h | 29,074 € |
| Avant plancher | 2,682 + 29,074 | 31,76 € |
| **Prix unitaire** | max(8,90 €, 31,76 €) → le calcul dépasse déjà le plancher | **31,76 €** |

On voit bien ici que c'est le **temps machine qui domine largement** le prix
sur une pièce volumineuse en qualité fine — cohérent avec la réalité d'un
atelier où la place sur l'imprimante coûte plus cher que la matière.

## Les valeurs de départ (à ajuster)

Seedées par défaut, modifiables depuis l'admin :

| Paramètre | Valeur de départ | Où l'ajuster |
|---|---|---|
| Taux horaire atelier | 5,00 €/h | Admin → Réglages |
| Prix plancher par pièce | 8,90 € | Admin → Réglages |
| Prix filament | PLA 22€/kg, PETG 26€/kg, ABS 24€/kg, ASA 28€/kg, TPU 32€/kg, Nylon 45€/kg, PP 30€/kg | Admin → Stock |

**Ce sont des estimations de départ, pas vos vrais coûts** — ajustez-les à
vos chiffres réels (le taux horaire est le levier le plus direct pour monter
ou baisser tous les prix d'un coup).

## Limites connues

- **Vitesses d'impression : données officielles Bambu Lab, mais génériques.**
  Les vitesses/accélérations viennent directement des profils BambuStudio
  publiés par Bambu Lab eux-mêmes (dépôt public `bambulab/BambuStudio`,
  profils H2C — pris comme référence pour les 3 machines) : ce ne sont donc
  pas des estimations inventées, mais les vraies valeurs d'usine. Elles
  restent génériques (pas *vos* réglages personnels calibrés dans
  BambuStudio).
- **Rapide et Standard utilisent actuellement les mêmes vitesses**
  (`src/lib/slicer.ts`, `QUALITY_SPEEDS`) — seule la hauteur de couche
  diffère entre les deux. Un vrai profil « Rapide » plus rapide que
  « Standard » reste à définir si vous voulez une distinction de vitesse
  entre ces deux paliers, pas seulement de finesse de couche.
- **PP sans profil officiel.** Bambu Lab ne publie pas de profil pour le PP —
  ses températures restent une estimation raisonnable, pas une donnée
  constructeur.
- **Assemblages multi-pièces complexes** (ex. un fichier CAO avec plusieurs
  corps mal positionnés) peuvent échouer à l'analyse — l'API renvoie une
  erreur claire plutôt qu'un prix faux.
- **Pas de date d'expiration séparée sur le prix d'un devis.** Un prix reste
  valable aussi longtemps que la ligne de panier qui le porte existe — et une
  ligne de panier ne survit pas indéfiniment : elle est nettoyée après 1h
  d'inactivité pour un invité, 48h pour un compte connecté (voir
  `lib/cartCleanup.ts`). Ça évite qu'un prix basé sur d'anciens tarifs
  matière ne traîne indéfiniment, sans avoir besoin d'un minuteur séparé sur
  le devis lui-même.
