# Comment le prix du devis instantané est calculé

Ce document explique la formule utilisée par `POST /api/quotes` (voir
`src/lib/server/pricing.ts` pour le code, `src/lib/server/kiriSlicer.ts` pour
l'analyse du fichier). Les exemples chiffrés ci-dessous sont **réellement
exécutés**, pas des calculs à la main — ce sont de vraies réponses de l'API
contre une vraie base de données, obtenues pendant le développement.

## Le principe : jamais confiance au navigateur

Le front-end n'affiche qu'une **estimation indicative** pendant que
l'utilisateur règle ses options. Le prix qui compte — celui envoyé à Stripe —
est **toujours recalculé côté serveur**, à partir du fichier réellement
envoyé, au moment de l'ajout au panier. Un visiteur qui modifierait le prix
affiché dans son navigateur (ou enverrait une requête directement à l'API
avec un prix inventé) n'obtient rien : l'API ignore tout montant venant du
client et ne calcule jamais qu'à partir de ce qu'elle a elle-même mesuré.

## Étape 1 — Analyser le fichier

Le fichier uploadé (STL/OBJ/3MF) est tranché par **Kiri:Moto** (open source,
MIT), en priorité **dans le navigateur du visiteur** — jamais un seul et même
serveur qui trancherait pour tout le monde à la fois, ce qui ne tiendrait pas
la charge à beaucoup de devis simultanés. Trois rôles, un seul moteur (voir
`src/lib/server/kiriSlicer.ts`, `public/kiri-slicer.js`,
`src/lib/kiriProfiles.ts`) :

1. **Client (rôle principal)** — le navigateur du visiteur tranche réellement
   le fichier (poids + temps réels, pas une estimation) via le moteur
   Kiri:Moto vendorisé en fichiers statiques (`public/vendor/kiri/`), chargé
   uniquement au moment de l'analyse.
2. **Serveur — vérification bon marché** — le serveur calcule indépendamment
   le volume réel du maillage (algorithme pur JS, aucun moteur de tranchage,
   quelques millisecondes même sur un maillage à 200k triangles — voir
   `computeMeshVolumeMm3`/`checkManifoldAndParts` dans
   `src/lib/server/orientation.ts`) et compare le poids/temps annoncés par le
   client à ce que ce volume rend plausible (`validateClaimedSlice`). Sert
   aussi de rejet immédiat pour une pièce trop grande pour le plateau de la
   H2C (330×320×325mm) ou dont le maillage n'est pas imprimable, avant même
   de faire confiance à quoi que ce soit venant du client.
3. **Serveur — filet de secours complet** — si le client n'a pas pu produire
   de résultat (WASM indisponible, appareil très faible, timeout) ou si la
   vérification du rôle 2 échoue, le serveur tranche lui-même réellement,
   avec le même moteur Kiri:Moto (vendorisé dans l'image Docker,
   `vendor/grid-apps/` — voir le `Dockerfile`) — rare par construction, donc
   sa lenteur éventuelle sur une pièce très complexe reste acceptable (cas
   rare, pas la charge normale).

Dans tous les cas, le résultat final (poids, temps d'impression estimé)
provient d'un vrai tranchage complet — jamais d'une formule au poids/volume
approximative.

### Échelle, orientation d'impression et supports (nouveau)

Trois choses affectent maintenant réellement le prix, pas seulement l'aperçu
visuel côté client :

- **Échelle** (panneau Unité/Échelle du configurateur, étape 1) — le client
  choisit une unité (mm/cm/pouce/m, pour corriger un fichier mal exporté) et
  un pourcentage ; le facteur combiné est envoyé au serveur (`scale` dans
  `POST /api/quotes`, jamais un fichier déjà redimensionné côté client) et
  appliqué directement sur les sommets du maillage côté serveur
  (`applyTransform` dans `orientation.ts`) avant le calcul de volume/bbox et
  avant le tranchage — que ce soit le résultat client fait confiance ou le
  filet de secours serveur. Borné côté serveur à [0,001 ; 2000]
  (`MIN_SCALE`/`MAX_SCALE` dans `pages/api/quotes/index.ts`).
- **Orientation d'impression** (`lib/server/orientation.ts`) — le fichier
  envoyé est parsé en triangles (STL/OBJ directement, 3MF dézippé+parsé) et
  les 6 orientations orthogonales de la pièce sont notées selon une
  heuristique (surface de surplomb, hauteur, surface de contact avec le
  plateau — surplomb largement prioritaire dans le score). La meilleure est
  appliquée avant analyse/tranchage, donc le prix reflète la vraie
  orientation d'impression, pas celle du fichier tel qu'exporté. Best-effort
  : un échec de parsing n'annule jamais le devis, juste aucune rotation
  appliquée (0°, 0°).
  **Bug corrigé** : la face en contact avec le plateau est par construction
  toujours orientée vers le bas, donc elle validait aussi le test de
  surplomb — chaque orientation candidate voyait sa propre face de contact
  comptée en double comme un faux surplomb, ce qui pénalisait justement les
  orientations avec une grande face d'appui plate (les meilleures en
  pratique) et favorisait des appuis plus petits et moins stables.
  Confirmé en vrai sur une pièce test 30×40×8mm : elle était basculée sur
  la tranche (hauteur 40mm) au lieu de reposer à plat (hauteur 8mm,
  l'orientation évidemment correcte). Les deux tests sont maintenant
  mutuellement exclusifs dans `suggestOrientation()`.
- **Supports activés** (`sliceSupportEnable`, `sliceSupportAngle=30` dans
  `src/lib/kiriProfiles.ts`) — une pièce avec surplombs voit donc son
  temps/poids inclure réellement le matériau/temps de support nécessaire,
  que ce soit le résultat client ou le filet de secours serveur.

Le fichier gardé en stockage (téléchargé plus tard pour la production, et
réutilisé pour tous les aperçus 3D ultérieurs — panier, "Analyse terminée")
a l'échelle **et** l'orientation retenues directement intégrées dans le
maillage, toujours ré-exporté en STL (`exportTransformedStl` dans
`kiriSlicer.ts`) — jamais le fichier brut tel qu'uploadé. Ça évite tout
risque de désaccord entre ce qui a été chiffré et ce qui est effectivement
imprimé.

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
| -------------------- | ------ |
| Poids                | 8 g    |
| Temps estimé         | 15 min |

| Calcul            | Détail                                       | Résultat   |
| ----------------- | -------------------------------------------- | ---------- |
| Coût matière      | 8 g ÷ 1000 × 22,00 €/kg                      | 0,176 €    |
| Coût machine      | 15 min ÷ 60 × 5,00 €/h                       | 1,250 €    |
| Avant plancher    | 0,176 + 1,250                                | 1,43 €     |
| **Prix unitaire** | max(8,90 €, 1,43 €) → le plancher s'applique | **8,90 €** |

C'est le cas typique d'une petite pièce rapide : le calcul brut (matière +
temps machine) tombe largement sous le prix plancher, donc c'est ce dernier
qui fixe le prix affiché — sans que le client ne voie de ligne "minimum"
séparée.

## Exemple chiffré n°2 — pièce plus grosse, PETG, qualité Fine

Cube de test 50×50×50mm, PETG, remplissage 60%, qualité Fine (couche
0,12mm), quantité 1. Taux horaire : 5,00 €/h.

| Mesure par le slicer | Valeur           |
| -------------------- | ---------------- |
| Poids                | 103,16 g         |
| Temps estimé         | 348,9 min (5h49) |

| Calcul            | Détail                                                    | Résultat    |
| ----------------- | --------------------------------------------------------- | ----------- |
| Coût matière      | 103,16 g ÷ 1000 × 26,00 €/kg                              | 2,682 €     |
| Coût machine      | 348,9 min ÷ 60 × 5,00 €/h                                 | 29,074 €    |
| Avant plancher    | 2,682 + 29,074                                            | 31,76 €     |
| **Prix unitaire** | max(8,90 €, 31,76 €) → le calcul dépasse déjà le plancher | **31,76 €** |

On voit bien ici que c'est le **temps machine qui domine largement** le prix
sur une pièce volumineuse en qualité fine — cohérent avec la réalité d'un
atelier où la place sur l'imprimante coûte plus cher que la matière.

## Les valeurs de départ (à ajuster)

Seedées par défaut, modifiables depuis l'admin :

| Paramètre               | Valeur de départ                                                                     | Où l'ajuster     |
| ----------------------- | ------------------------------------------------------------------------------------ | ---------------- |
| Taux horaire atelier    | 5,00 €/h                                                                             | Admin → Réglages |
| Prix plancher par pièce | 8,90 €                                                                               | Admin → Réglages |
| Prix filament           | PLA 22€/kg, PETG 26€/kg, ABS 24€/kg, ASA 28€/kg, TPU 32€/kg, Nylon 45€/kg, PP 30€/kg | Admin → Stock    |

**Ce sont des estimations de départ, pas vos vrais coûts** — ajustez-les à
vos chiffres réels (le taux horaire est le levier le plus direct pour monter
ou baisser tous les prix d'un coup).

## Limites connues

- **Vitesse d'impression : une seule valeur par palier de qualité, pas par
  type de trajectoire.** Contrairement à un profil PrusaSlicer classique
  (vitesse séparée parois/remplissage/déplacements), le process Kiri:Moto
  n'expose qu'un seul `outputFeedrate` (voir `buildKiriProcess` dans
  `src/lib/kiriProfiles.ts`) — 150mm/s pour Rapide/Standard, 60mm/s pour
  Fine. Rapide et Standard utilisent donc toujours la même vitesse
  aujourd'hui, comme avant ; le manque de granularité par trajectoire est
  nouveau (limite du moteur, pas un choix).
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
