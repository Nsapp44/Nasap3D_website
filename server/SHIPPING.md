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
de production authentifie avec ces clés — `test.envoimoinscher.com` renvoie
401. Contrairement à la cotation (gratuite, sans effet de bord), `api/v1/
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
`server/src/lib/boxtal.ts` viennent d'appels réels, pas de suppositions.

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
- Les dimensions du colis sont fixes (30×22×15cm, "carton générique") —
  aucune donnée d'emballage réelle n'est suivie par commande aujourd'hui.
  Le prix de ces offres dépend surtout du poids, donc c'est une
  simplification raisonnable à affiner plus tard si besoin.

## Code contenu Boxtal

`content_code = 50150` ("Pièces de rechange et accessoires (autres)") —
choisi en interrogeant réellement `GET /api/v1/contents` sur ce compte et
en prenant la catégorie la plus proche d'une pièce imprimée sur mesure.

## Widget point relais

`vendor/boxtal-parcel-point-map.js` est le paquet npm officiel
`@boxtal/parcel-point-map` (MIT), vendorisé tel quel (ce projet n'a pas
d'étape de build front-end). Il affiche une carte dans un iframe Boxtal et
renvoie le point choisi par `postMessage` — voir `Cart.dc.html`.

`BOXTAL_MAP_API_KEY` sert de jeton d'accès côté navigateur (même catégorie
que la clé de site hCaptcha : pensée pour être publique). Le secret
correspondant (`BOXTAL_MAP_API_SECRET`) est stocké mais non utilisé — rien
dans le widget officiel n'en a besoin.

## Variables d'environnement à vérifier

`BOXTAL_SHIPPER_*` (adresse de départ des colis) a été pré-rempli avec
l'adresse du siège social telle qu'elle apparaît dans
`MentionsLegales.dc.html` (29 rue Mellier, 44100 Nantes). À corriger dans
`server/.env` si les colis partent réellement d'ailleurs.
