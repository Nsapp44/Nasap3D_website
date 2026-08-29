# Livraison (Boxtal)

## Ce qui est fait

Au moment de payer, le client :

1. saisit son adresse de livraison (nom, téléphone, adresse, code postal, ville) ;
2. clique sur "Calculer les frais de livraison" — le serveur appelle en
   temps réel l'API de Boxtal et renvoie deux tarifs réels : **Mondial
   Relay (point relais)** et **Colissimo (domicile)** ;
3. choisit une des deux offres. S'il choisit le point relais, un widget
   officiel Boxtal (carte) s'affiche pour qu'il choisisse son point relais ;
4. paie — Stripe facture le panier **+ la livraison**, dans le même paiement.

Le prix de livraison n'est **jamais** fourni par le navigateur : à l'étape
`/checkout`, le serveur relance lui-même la simulation Boxtal et ne facture
que le montant qu'elle vient de renvoyer — même principe que pour le prix
d'une pièce imprimée (voir `PRICING.md`).

## Achat de l'étiquette d'expédition

Sur chaque commande ayant des informations de livraison complètes,
l'admin (`Admin.dc.html`) a un bouton **"Créer l'étiquette"** (avec une
confirmation navigateur avant l'appel, puisque ça facture réellement le
compte Boxtal). Ça appelle `POST /admin/orders/:id/shipping-label`, qui :

1. refuse si une étiquette a déjà été achetée pour cette commande
   (`boxtalOrderRef` déjà rempli — garde-fou anti-double-achat, `409`) ;
2. appelle réellement `api/v1/order` chez Boxtal (`purchaseShippingLabel()`
   dans `src/lib/boxtal.ts`), avec le **même** poids/transporteur/service
   que ceux figés au moment du paiement (jamais recalculés) ;
3. stocke la référence Boxtal et l'URL de l'étiquette sur la commande.

Certains transporteurs génèrent l'étiquette de façon asynchrone : si
`labels/label` est vide dans la réponse de `api/v1/order`, l'admin voit
"Étiquette en cours de génération…" avec un bouton "Vérifier" qui appelle
`GET /admin/orders/:id/shipping-label` (`checkLabelStatus()`, poll
`api/v1/order_status/{reference}/informations`).

**Identité expéditeur** : `api/v1/order` a besoin d'un contact nommé (pas
juste une adresse comme pour la cotation) — voir `BOXTAL_SHIPPER_FIRSTNAME
/_LASTNAME/_COMPANY/_EMAIL/_PHONE` dans `.env`.

**Pas de bac à sable sur ce compte** : comme pour la cotation, seul l'hôte
de production authentifie avec ces clés — `test.envoimoinscher.com` renvoie 401. Contrairement à la cotation (gratuite, sans effet de bord), `api/v1/
order` engage de l'argent réel à chaque appel. Demander à Boxtal des
identifiants sandbox séparés pour ce compte avant de tester ce flux pour de
vrai sans facturation.

## Pourquoi l'API v1 (et pas la v3 "webservice")

Boxtal fournit deux paires de clés (v1 et v3). La v1 est celle utilisée ici
pour tout : simulation de tarif (`api/v1/cotation`) **et** achat
d'étiquette (`api/v1/order`) — le client PHP officiel confirme que les deux
actions vivent sur la même API v1, avec la même authentification. La v3
(clés `BOXTAL_API_KEY_V3` / `BOXTAL_API_SECRET_V3`, stockées mais
inutilisées) n'a jamais été nécessaire.

La documentation officielle (`developer.boxtal.com`) est une SPA qu'on n'a
pas pu récupérer en texte brut. À la place, l'intégration a été construite
en lisant le **client PHP officiel open-source**
(github.com/boxtal/php-library) puis **vérifiée pour de vrai** avec les
clés du compte contre l'API de production (`www.envoimoinscher.com`) —
tous les noms de champs, formats de requête et de réponse dans
`src/lib/server/boxtal.ts` viennent d'appels réels, pas de suppositions.

**Piège découvert en testant** : ces clés v1 n'authentifient QUE contre
l'hôte de production. `test.envoimoinscher.com` renvoie 401 avec ces
identifiants (il faudrait des identifiants sandbox séparés, jamais fournis
pour ce compte). Une simulation de tarif ("cotation") est un appel gratuit
et sans effet de bord — donc sans risque à utiliser en dev — mais il faut
garder ça en tête si un jour on implémente l'achat d'étiquette : cet
appel-là serait, lui, un vrai appel de production.

## Filtrage transporteurs

Le compte Boxtal de Nasap3D est configuré (côté Boxtal) pour ne proposer
que Mondial Relay et Colissimo. `boxtal.ts` ne fait que retenir, parmi les
offres renvoyées, celle Mondial Relay "CpourToi" (point relais) et celle
Colissimo "ColissimoAccess" (domicile, sans signature) — les moins chères
de chaque catégorie.

## Poids et emballage

- Poids facturé = poids réel des pièces (issu du calcul de devis) **+ 20%**
  pour l'emballage, avec un plancher de 50g (même une pièce très légère
  part dans un vrai carton).
- **Un seul carton par commande.** Le carton est choisi parmi 3 formats
  réels (`PARCEL_BOXES_CM` dans `boxtal.ts`, en cm) :
  12×12×10, 20×20×20, 40×35×30. `pickParcelCm()` prend le plus petit qui
  satisfait à la fois :
  - l'encombrement réel (longueur/largeur/hauteur, avec rotation autorisée)
    de la pièce la plus grosse du panier, plus **1cm de marge de chaque
    côté** sur chaque dimension (`PARCEL_MARGIN_MM`) ;
  - le volume total de **toutes** les pièces du panier (somme, quantités
    incluses) qui doit rester sous 95% du volume **utile** du carton — le
    carton une fois qu'on lui retire les mêmes 1cm de marge par face que
    ci-dessus (donc 2cm de moins sur chaque dimension), pas son volume brut.
    Marge des 5% volontairement petite : la marge de 1cm par face est déjà
    retirée du volume, pas besoin d'en rajouter une deuxième par-dessus.
    Sert surtout à éviter qu'une commande avec par exemple 2 grosses pièces
    - 1 petite tienne "sur le papier" pièce par pièce mais pas une fois
      regroupées dans le même carton (pas de vrai bin-packing 3D ici, ce sont
      des pièces imprimées irrégulières, pas des blocs).
      Si aucun des 3 formats ne convient (`pickParcelCm()` renvoie `null`), voir
      "Pièces hors gabarit" plus bas.
- **1,50 € de frais d'emballage** (`PACKAGING_FEE_CENTS` dans `boxtal.ts`)
  ajoutés au prix brut du transporteur dans `quoteShippingRates()` — donc
  répercutés à la fois sur l'aperçu affiché en panier et sur le montant
  réellement facturé au checkout (même fonction pour les deux). Il n'y a
  actuellement aucune option "retrait à l'atelier" dans le tunnel de
  commande en ligne (seulement RELAY/HOME, tous deux de la vraie
  expédition) — ce frais s'applique donc à toute commande passée en ligne.

## Pièces hors gabarit (aucun des 3 cartons ne convient)

Rare en pratique (`pickPrinter()` dans `slicer.ts` refuse déjà la plupart
des pièces trop grandes pour le plateau H2C), mais possible pour une pièce
volumineuse presque cubique, ou plusieurs grosses pièces dans la même
commande. Le client n'est **jamais** bloqué : `quoteShippingRates()` utilise
quand même le plus grand carton (40×35×30cm) comme estimation raisonnable —
le prix Boxtal dépend surtout du poids, donc l'écart reste faible — et
marque `oversized: true`, figé sur la commande (`Order.shippingOversized`)
au moment du paiement.

C'est seulement à l'achat réel de l'étiquette (`POST
/admin/orders/:id/shipping-label`, argent réel) que ce flag bloque l'appel
automatique : la route renvoie `409 { error: "parcel_oversized" }` au lieu
d'appeler `purchaseShippingLabel()`. Dans `Admin.dc.html`, ça affiche une
alerte "Hors gabarit" au clic sur "Créer l'étiquette" — à cette commande
précise, il faut alors passer par le site Boxtal directement (choisir soi-
même le vrai emballage) plutôt que par ce bouton.

## Délai de production

`productionBusinessDays()` dans `boxtal.ts` calcule combien de jours ouvrés
sont nécessaires avant que la commande puisse être remise au transporteur,
à partir du temps d'impression total du panier (`getCartTotalPrintMinutes`
dans `cart.ts`, qty-weighted — même principe que le poids) :

- moins de 12h d'impression : 2 jours fixes ;
- 12h ou plus : 2 jours + le temps d'impression converti en jours calendaires
  pleins en supposant une impression continue (`ceil(heures / 24)`) — ex.
  40h → 2 + ceil(40/24) = 2 + 2 = 4 jours.

Ce nombre de jours ouvrés est ajouté à la date du jour pour obtenir
`collection_date`, envoyée à Boxtal dans `quoteShippingRates()` — c'est
Boxtal qui calcule ensuite la vraie date de livraison (`delivery.date` dans
la réponse) à partir de cette date de collecte, pas nous : pas besoin
d'estimer le délai transporteur nous-mêmes. Affiché dans `Cart.dc.html`
("Livraison estimée le …").

## International (UE)

Le tunnel de commande accepte les 27 pays de l'UE (voir `EU_COUNTRIES` dans
`Cart.dc.html`), pas seulement la France. Vérifié pour de vrai contre le
compte sandbox (cotation **et** achat réel d'étiquette, gratuit en sandbox) :

- **Codes d'offre différents** : Boxtal choisit lui-même l'offre selon
  `recipient.country`, mais avec un code de service différent du domestique
  — `quoteShippingRates()` reconnaît les deux formes pour chaque
  transporteur : Mondial Relay `CpourToi` (FR) / `CpourToiEurope` (UE),
  Colissimo `ColissimoAccess` (FR) / `ColissimoAccessInternational` (UE).
  `delivery.type.code` (PICKUP_POINT / HOME) reste fiable dans les deux cas
  pour distinguer point relais et domicile — pas besoin de brancher sur le
  pays pour ça, juste de reconnaître les deux orthographes de code.
- **Champs supplémentaires obligatoires pour l'achat réel** (`api/v1/order`)
  dès que `recipient.country !== "FR"` — ce ne sont **pas** de vraies
  déclarations douanières (l'UE est une union douanière, pas de VRAI
  document douanier entre pays membres), juste des champs standards que
  Boxtal exige pour ces offres : `expediteur.civilite`/`destinataire.civilite`
  (fixés à `"M."`, aucune donnée de civilité collectée côté client),
  `colis.description` (texte fixe `INTL_CONTENT_DESCRIPTION` dans
  `boxtal.ts` — toujours des pièces imprimées 3D, rien à saisir côté
  client), `colis.valeur` (valeur déclarée, `order.subtotalCents` de la
  commande — jamais devinée).
- **Format de téléphone** : vérifié pour de vrai que `api/v1/order` **rejette**
  `shipper.phone`/`recipient.phone` sans le `+` — y compris le format local
  français brut (`"0661430506"`), pas seulement le préfixe `"0033..."` comme
  supposé initialement (erreur réelle rencontrée en prod : `shipper.phone: Le
numéro de téléphone n'est pas valide: 0661430506`) — mais **accepte**
  `"+33..."` (avec ou sans espaces). `BOXTAL_SHIPPER_PHONE` reste en format
  local français dans `.env` (plus lisible à configurer) mais est désormais
  **toujours** converti en `+33...` (`toInternationalFrPhone()`) avant envoi,
  FR ou non-FR. Côté client, le champ téléphone (`Cart.dc.html`) est géré par
  [intl-tel-input](vendor/intl-tel-input) (vendorisé, pays par défaut FR) —
  `iti.getNumber('E164')` renvoie directement `+33XXXXXXXXX`, aucune
  conversion supplémentaire nécessaire. L'ancien `phone.js` maison
  (FR-only, sans détection de pays) a été retiré.
- **Adresse** : autocomplétion via Photon (photon.komoot.io, données
  OpenStreetMap, gratuit et sans clé, couvre la France et le reste de l'UE)
  — voir `_searchAddress()`/`_normalizeSuggestion()` dans `Cart.dc.html`.
  Utilisait auparavant l'API française api-adresse.data.gouv.fr pour la
  France et Photon pour le reste de l'UE ; simplifié sur un seul fournisseur
  pour éviter deux comportements différents à déboguer en parallèle.

## Tester sans facturer le compte de production

Le compte a maintenant de vrais identifiants **sandbox V1**, distincts du
compte de production : mettre `BOXTAL_BASE_URL="https://test.envoimoinscher.com/"`
dans `.env` avec les `BOXTAL_API_KEY_V1`/`BOXTAL_API_SECRET_V1` sandbox
(reçus après inscription sur https://redirect.boxtal.build/iam/redirect/register?profile=developer).
Les commandes passées dans cet environnement ne sont pas facturées. Laisser
`BOXTAL_BASE_URL` vide utilise l'hôte de production par défaut.

`BOXTAL_API_KEY_V3`/`BOXTAL_API_SECRET_V3` (avec, pour le sandbox,
`https://api.boxtal.build`) restent stockées mais inutilisées : la V3 est
une API JSON entièrement différente (auth Bearer/Basic, pas d'endpoint de
cotation gratuite — la création de commande passe directement par
`POST /shipping/v3.1/shipping-order`), donc migrer vers elle serait une
réécriture, pas juste un changement de config.

## Code contenu Boxtal

`content_code = 50150` ("Pièces de rechange et accessoires (autres)") —
choisi en interrogeant réellement `GET /api/v1/contents` sur ce compte et
en prenant la catégorie la plus proche d'une pièce imprimée sur mesure.

## Widget point relais

`vendor/boxtal-parcel-point-map.js` est le paquet npm officiel
`@boxtal/parcel-point-map` (MIT), vendorisé tel quel (ce projet n'a pas
d'étape de build front-end). Il affiche une carte dans un iframe Boxtal et
renvoie le point choisi par `postMessage` — voir `Cart.dc.html`.

Le widget attend un vrai token temporaire (JWT, valable ~1h), pas une clé
statique : `GET /shipping/map-token` (route serveur, auth requise) appelle
`POST https://api.boxtal.com/iam/account-app/token` en Basic Auth avec
`BOXTAL_MAP_API_KEY`/`BOXTAL_MAP_API_SECRET`, met le résultat en cache
mémoire jusqu'à expiration (voir `getBoxtalMapAccessToken()` dans
`lib/boxtal.ts`), et le sert au front (`Cart.dc.html` `_apiToken()`). Avant
cette correction, `BOXTAL_MAP_API_KEY` était passé directement comme
`accessToken` au widget côté navigateur : la carte se chargeait sans erreur
apparente, mais ne renvoyait jamais aucun point relais, car ce n'était
simplement pas un token valide aux yeux de Boxtal (confirmé par leur
support, avec leur spec OpenAPI de ce endpoint). `BOXTAL_MAP_API_SECRET` ne
doit jamais atteindre le navigateur, contrairement à `BOXTAL_MAP_API_KEY`
avant.

## Variables d'environnement à vérifier

`BOXTAL_SHIPPER_*` (adresse de départ des colis) a été pré-rempli avec
l'adresse du siège social telle qu'elle apparaît dans
`MentionsLegales.dc.html` (29 rue Mellier, 44100 Nantes). À corriger dans
`.env` si les colis partent réellement d'ailleurs.

## Numéro de suivi et passage automatique en "Livré"

`GET api/v1/order_status/{ref}/informations` (déjà utilisé pour
`label_available`/`label_url`) renvoie aussi deux champs jusqu'ici ignorés,
confirmés en testant en réel sur le sandbox :

- `carrier_reference` — le vrai numéro de suivi transporteur (ex.
  `CR260813000000000NT3`), jamais présent dans la réponse d'achat initiale
  (`POST api/v1/order`), seulement récupérable après coup via cet endpoint.
- `state` — statut transporteur en texte libre (ex. "Commande validée par
  le transporteur"). Une seule valeur observée en test, pas la liste
  complète des états possibles côté Boxtal.

`checkLabelStatus()` (`lib/boxtal.ts`) extrait maintenant les deux, plus un
`isLikelyDelivered` heuristique (regex sur "livré"/"livrée" dans `state`,
en excluant volontairement "livraison"/"livrer" qui ne veulent pas dire que
c'est arrivé — attention au piège JS : `\b` ne reconnaît pas les
caractères accentués comme des lettres, un lookahead est utilisé à la
place). Comme il n'y a qu'un seul état observé, c'est un best-effort à
vérifier si un vrai passage en livraison ne se détecte pas correctement.

`lib/orderTracking.ts` centralise tout ça :

- `refreshOrderTrackingStatus(orderId)` — un appel Boxtal, met à jour le
  numéro de suivi, et passe la commande en DELIVERED (+ purge, voir plus
  bas) si `isLikelyDelivered`. Appelé par le bouton "Vérifier" de l'admin
  et par le sweep quotidien.
- `sweepOrderTracking()` — tourne une fois par jour (`index.ts`,
  volontairement pas plus souvent : pas besoin d'un appel Boxtal par
  commande toutes les 15 minutes) sur toutes les commandes PRINTING/READY
  avec un `boxtalOrderRef`.

**Numéro de suivi obligatoire avant "Expédié / Prêt"** : pour toute
commande expédiée (pas retrait atelier), `PATCH /admin/orders/:id` refuse
`{status: "READY"}` tant qu'aucun `trackingNumber` n'existe (auto-récupéré
ou saisi à la main par l'admin — cas d'une étiquette achetée hors système,
ex. colis hors gabarit).

**Purge à la livraison** : dès qu'une commande passe en DELIVERED (à la
main ou automatiquement), tout le bloc adresse/téléphone/point
relais/transporteur/étiquette/suivi est mis à `null`
(`SHIPPING_DATA_PURGE` dans `lib/orderTracking.ts`) — plus aucune utilité
une fois le colis arrivé. Seuls `recipientName` et `shippingMode` sont
gardés (contexte minimal, non identifiant), ainsi que le ref/prix/factures
et le détail des pièces (`OrderItem`, juste du texte : matériau/couleur/
qté). **DELIVERED est un état terminal** : `PATCH` refuse tout changement
de statut une fois atteint (409 `order_already_delivered`) — cohérent
avec le fait que les données nécessaires pour revenir en arrière n'existent
plus de toute façon.
