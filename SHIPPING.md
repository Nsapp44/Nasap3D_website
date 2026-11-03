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

**Plusieurs colis** : un seul achat Boxtal par commande (`colis_1…colis_N` repris de `Order.shippingParcels`), un seul bordereau PDF qui contient les étiquettes de tous les colis, et un numéro de suivi par colis, stockés séparés par des virgules dans `trackingNumber`. Vérifié en bac à sable le 27/10/2026 (`scripts/boxtal-sandbox-multi-label.mjs`, qui refuse de tourner hors de `test.envoimoinscher.com`).

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

## Poids, cartons et rangement en plusieurs colis (depuis le 27/10/2026)

Code : `src/lib/server/packing.ts` (`packPieces()`, testé dans `test/packing.test.ts`).

**5 cartons karton.eu** (`BOXES`, intérieur en mm, extérieur en cm envoyé à Boxtal) :

| Carton | Intérieur (mm) | Extérieur (cm) | Charge max | Relais | Locker |
|---|---|---|---|---|---|
| S | 140×140×100 | 15×15×11 | 6 kg | oui | oui |
| M | 200×200×200 | 21×21×21 | 6 kg | oui | oui |
| L | 400×350×300 | 41×36×31 | 6 kg | oui | oui |
| XL | 600×400×300 | 62×42×33 | 25 kg (double cannelure) | oui | non |
| XXL | 786×386×378 | 80×40×40 | 25 kg (double cannelure) | non (Colissimo seul) | non |

**Rangement** : chaque quantité du panier devient une pièce (`getCartPieces()` dans `cart.ts`, bbox mise à l'échelle + poids). `packPieces()` :
- une pièce rentre dans un carton si sa bbox + 1 cm de marge par face (`PARCEL_MARGIN_MM`) tient dans l'intérieur, rotation autorisée ;
- le volume cumulé des pièces d'un colis reste sous 95 % du volume utile (`PACKING_EFFICIENCY`) ; pas de vrai rangement 3D (pièces irrégulières) ;
- poids d'un colis = (pièces + carton vide) × 1,1, arrondi au gramme (pas au 0,5 kg), plancher 300 g ; c'est ce même poids qui sert à la limite 25 kg, au devis et à l'étiquette. Cartons vides (karton.eu) : S 50 g, M 130, L 380, XL 950, XXL 1140 ;
- tri par volume décroissant, premier colis ouvert où la pièce tient, sinon nouveau colis ; à la fin chaque colis est ramené au plus petit carton qui le contient. Résultat : le moins de colis possible, puis les plus petits cartons.
- le carton indiqué est un **format maximum** : à l'atelier, un carton plus petit convient si les pièces y rentrent.

**Prix client** : un seul prix = somme des tarifs Boxtal des colis (devis `colis_1…colis_N` en une requête) + **1,50 € d'emballage par colis** (`PACKAGING_FEE_CENTS`). Mondial Relay (point relais) n'est proposé que si **aucun** colis n'est XXL (S, M, L, XL passent) ; sinon Colissimo seul. Locker : seulement si **tous** les colis sont S, M ou L.

**Plafond 25 kg par colis** (plus petite limite transporteurs : Mondial Relay et locker 25 kg ; Colissimo 30 kg). XL et XXL sont prévus pour 30 kg mais plafonnés à 25 kg (`maxWeightG`). Règles : XL = relais oui, locker non ; XXL (L+l+h = 160 > 150) = Colissimo seul.

**Messages du panier** (`GET /api/cart` renvoie `parcelCount`, `relayOk`, `lockerOk`) : « N colis » au-delà d'un colis, « Locker impossible pour cette commande », « Colissimo seulement ». Chaque message finit par « contactez-nous ».

**Stockage** : `Order.shippingParcels` (JSON : carton, extérieur, poids, pièces de chaque colis), figé à la commande. `shippingWeightG` = total, `shippingParcel*Cm` = 1er colis (compatibilité). Les anciennes commandes (`shippingParcels` vide) gardent l'affichage d'avant.

**Stock de cartons** : table `ShippingBoxStock`, onglet admin « Expédition » (`ShippingTab.tsx`, `GET/PATCH /api/admin/shipping-boxes`). Baisse **automatique au paiement** (`boxStockAuto.ts`, appelée une seule fois dans le webhook Stripe au passage AWAITING_PAYMENT → PENDING, d'après les cartons de `shippingParcels`, jamais sous 0, retrait sans carton = rien) + correction **manuelle** (+/−, jamais sous 0) pour les commandes emballées autrement ; à 0, la carte commande affiche « Stock à 0 : acheter ce carton » avec le lien karton.eu.

## Commande impossible (pièce trop grande)

Si une seule pièce ne rentre dans aucun carton (même le XXL), `packPieces()` renvoie `piece_too_big`. Cas rare (les machines impriment 30×30 cm au maximum), gardé au cas où. `GET /api/cart` renvoie alors `tooBigPiece` et le panier **grise « Expédition »** : seul le **retrait à l'atelier** reste possible, avec le message « Expédition impossible pour cette commande : la pièce « … » est trop grande pour nos colis. Retrait à l'atelier possible, ou contactez-nous ». Côté serveur, `POST /api/shipping/rates` et `POST /api/checkout` en mode RELAY/HOME répondent `409 { error: "order_too_big" }` ; PICKUP passe (décision de Nolann, 27/10, qui remplace « bloqué même en retrait »). Il n'y a plus de commande « hors gabarit » : `Order.shippingOversized` reste en base mais n'est plus écrit à `true`.

**Remise en main propre** : après paiement, passer la commande en « En impression » puis « Livré » (pas de numéro de suivi).

### Taille du carton et prix : test du 27/10/2026

Appels de devis uniquement (`api/v1/cotation`, hôte bac à sable
`test.envoimoinscher.com`), Nantes → Paris, même poids, seules les
dimensions changent. Prix TTC transporteur, sans les 1,50 € d'emballage :

| Carton (cm) | L+l+h | Mondial Relay point relais (8,4 kg) | Colissimo domicile (8,4 kg) | Colissimo (2 kg) |
|---|---|---|---|---|
| 40×35×30 | 105 | 14,36 | 17,90 | 10,92 |
| 60×40×40 | 140 | 14,36 | 17,90 | 10,92 |
| 100×25×20 | 145 | 14,36 | 17,90 | |
| 101×25×20 (côté > 100) | 146 | 14,36 | 25,10 | |
| 121×15×10 (côté > 120) | 146 | aucune offre | 25,10 | |
| 70×45×35 | 150 | 14,36 | 25,10 | |
| 70×45×36 | 151 | aucune offre | 25,10 | |
| 80×50×50 | 180 | aucune offre | 25,10 | 18,12 |
| 100×50×50 | 200 | aucune offre | 25,10 | |
| 100×51×50 | 201 | aucune offre | aucune offre | |
| 100×60×50 | 210 | aucune offre | aucune offre | |

Conclusions :
- **La taille exacte ne change pas le prix** : seul le poids compte, plus un
  palier de taille (pas de poids volumétrique chez ces deux transporteurs).
- Mondial Relay point relais : proposé tant que L+l+h ≤ 150 et côté ≤ 120.
- Colissimo : prix normal si L+l+h ≤ 150 et côté ≤ 100 ; **+7,20 € TTC**
  sinon, jusqu'à L+l+h = 200 ; refusé au-delà de 200.
- Bizarrerie notée : avec un côté > 100 et une somme ≤ 150, le bac à sable
  applique déjà le supplément Colissimo (cohérent avec La Poste).
- Limite : bac à sable, à recouper avec un vrai devis de production.

### Plusieurs colis : test du 27/10/2026 (bac à sable, cotation seule)

L'API v1 `cotation` accepte `colis_1.*`, `colis_2.*`, `colis_3.*` dans une même requête et renvoie un prix total. Nantes → Paris, Colissimo Access TTC : 61×41×32 4 kg = 13,07 € ; 80×40×40 4 kg = 20,27 € ; les deux ensemble = 33,34 € (somme exacte). 3 × (61×41×32, 3 kg) = 35,93 € Colissimo, 20,59 € Mondial Relay. Mondial Relay reste proposé en multi-colis si chaque colis respecte ses limites. À recouper avec un devis de production.

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
