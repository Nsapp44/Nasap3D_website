# Campagne Google Ads « Maquettage B2B » : à copier dans Google Ads (mis à jour le 03/11/2026)

Prépare le choix du 02/11 (`docs/chantiers/maquettage-b2b_2026-11-02.md` §5 et §7), révisé le 03/11 : **une seule campagne, un seul groupe d'annonces** (« Maquettes sur mesure »), mots-clés en requête large, page d'arrivée `/maquettiste-nantes`. Ce guide suit l'ordre du formulaire Google Ads de création de campagne. Les libellés peuvent différer un peu selon la version de l'interface : en cas de doute sur un écran, envoie-moi une capture.

## 0. Pré-requis (à vérifier avant de commencer)
- **Pages en ligne** : la page d'arrivée `/maquettiste-nantes` (l'ancienne adresse `/maquette-impression-3d` est redirigée en 301 vers elle) et `/maquette-industrielle` (page ciblée par un lien annexe). À vérifier APRÈS le push : `curl -I https://nasap3d.com/maquettiste-nantes` et `curl -I https://nasap3d.com/maquette-industrielle` doivent répondre `200` ; `curl -I` sur l'ancienne adresse doit répondre `301` avec `Location` vers `/maquettiste-nantes`. Tant que ce n'est pas le cas, on ne publie pas.
- **Compte Google Ads de Nolann** (ads.google.com).
- **Budget** : 3 €/jour pendant 3 semaines (≈ 63 €). **Rien n'est dépensé tant que Nolann n'a pas donné son feu vert et cliqué sur « Publier ».**
- **Pas de balise Google sur le site** (décision du 02/11) : le suivi se fait par les UTM dans Plausible (§5).

Faits utilisés dans les textes (tous vrais) : atelier à Nantes (quartier Canclaux), étude de faisabilité gratuite / expertise avant tout paiement, devis sur mesure, maquettes visibles en 360° en ligne, LED et pièces mobiles, démontable et transportable, livraison partout en France, équipe très réactive (urgences possibles), idéation et modélisation 3D avec le client. **Interdit dans les titres, descriptions, accroches et liens annexes** : le mot « impression » (quel qu'il soit), tout prix, le signe « € », « à partir de », un nom de client.

## 1. Création de la campagne, écran par écran
1. **Nouvelle campagne** : ads.google.com > **Campagnes** > bouton bleu **+ Nouvelle campagne**.
   - Objectif : **Créer une campagne sans indiquer d'objectif** (ou, si tu préfères, l'objectif **Trafic vers le site Web**).
   - Type de campagne : **Recherche**.
2. **Résultats souhaités** :
   - Coche **Visites sur le site** et saisis le site : `https://nasap3d.com`.
   - Coche **Appels téléphoniques** si Google le propose : saisis le numéro de la fiche Google Business Profile (pays : France). Je n'écris pas le numéro ici volontairement.
   - Si Google propose de créer une action de conversion ou d'installer la balise Google : **ignore** (pas de balise).
3. **Nom de l'établissement** : `Nasap3D` (25 caractères maximum). Si Google demande un logo : celui de la fiche Google Business Profile.
4. **Nom de la campagne** : `Maquettage B2B`
5. **Enchères** :
   - « Ce que vous voulez que les clients fassent » : **Clics**.
   - Coche **« Définir un prix maximal par clic »** (c'est le CPC manuel) et laisse l'option **« Optimiser votre enchère au CPC » décochée**.
   - Prix maximal : **1,50 €**. Si le champ du montant n'apparaît pas ici, tu le saisis à l'étape du groupe d'annonces (enchère max. au CPC, étape 8) ; s'il existe aux deux endroits, mets 1,50 € aux deux.
6. **Paramètres de campagne** :
   - **Réseaux** : **décoche** « Inclure les partenaires de recherche Google » ET « Inclure le Réseau Display Google ». Il ne doit rester que la Recherche Google.
   - **Zones** : **France**. Dans « Options de ciblage », choisis **Présence : personnes situées dans les zones ciblées ou régulièrement dans ces zones** (et pas « Présence ou intérêt »). Une seule zone, car 7 mots-clés sur 8 ne contiennent pas « Nantes » ; la requête « maquettiste nantes » reste locale par son texte.
   - **Langue** : retire « Anglais » s'il est coché, laisse uniquement **Français**.
   - **Dates** (dans **Autres paramètres** ou **Plus de paramètres**) : début = le jour du feu vert ; fin = début + 21 jours (test de 3 semaines).
   - **Calendrier de diffusion** > Ajouter : **lundi à vendredi, 8:00 à 19:00** (on cible des professionnels en journée).
   - Si le formulaire propose un réglage « correspondance large pour la campagne » : **laisse la valeur par défaut** (les mots-clés sont de toute façon en requête large, voir §2).
7. **AI Max pour les campagnes sur le Réseau de Recherche** : **Désactivé**, et **« Expansion de l'URL finale » désactivée**. Raison : on garde la page d'arrivée et les textes (sans « impression 3D ») sous contrôle ; AI Max pourrait envoyer vers une autre page du site et réécrire les annonces.
8. **Mots-clés et annonces** : le groupe d'annonces unique, décrit au §2 (nom, mots-clés, URL finale, chemins, titres, descriptions). Si le formulaire propose les composants (liens annexes, accroches, extraits, appel, lieu) à ce stade, le détail est au §4 ; sinon tu les ajoutes après la création.
9. **Budget** : **3,00 €** par jour. Méthode de diffusion : standard.
10. **Vérification et publication** : relis le récapitulatif (nom `Maquettage B2B`, Recherche seule, France, Français, 3 €/jour, dates sur 21 jours, lundi-vendredi 8:00-19:00, CPC max 1,50 €, 8 mots-clés, 1 annonce, AI Max désactivé). **Ne clique sur « Publier » qu'avec le feu vert de Nolann.** Ajoute ensuite les mots-clés négatifs du §3 **le jour même, avant la première journée de diffusion** (en requête large, sans négatifs, l'argent part sur des termes hors sujet).

## 2. Le groupe d'annonces unique : « Maquettes sur mesure »
- **Nom du groupe** : `Maquettes sur mesure`
- **CPC max du groupe** : 1,50 € (si le champ est demandé).
- **Mots-clés** : requête **large**, donc **sans guillemets ni crochets**. Colle-les un par ligne :

```
maquettiste nantes
maquette sur mesure
maquette industrielle
maquette de machine
maquette pédagogique
maquette salon professionnel
maquette en coupe
maquette démonstrateur
```

- **URL finale** :
`https://nasap3d.com/maquettiste-nantes?utm_source=google&utm_medium=cpc&utm_campaign=maquettage`

### Annonce responsive
Dans « Annonce » > **Annonce responsive sur le Réseau de Recherche**. Colle l'URL finale ci-dessus. Les deux chemins s'écrivent dans « Chemin d'affichage » (à droite de nasap3d.com/). Les nombres sont de vrais comptages de caractères (limites : chemin 15, titre 30, description 90).

#### Chemins d'affichage
| Chemin | Car. |
|---|---|
| `maquettiste` | 11 |
| `nantes` | 6 |

#### Titres (15)
| N° | Titre | Car. |
|---|---|---|
| 1 | `Maquettiste à Nantes` | 20 |
| 2 | `Maquette sur mesure` | 19 |
| 3 | `Maquette industrielle` | 21 |
| 4 | `Maquette de machine` | 19 |
| 5 | `Maquette pédagogique` | 20 |
| 6 | `Maquette salon professionnel` | 28 |
| 7 | `Maquette en coupe` | 17 |
| 8 | `Maquette démonstrateur` | 22 |
| 9 | `Maquette d'architecture` | 23 |
| 10 | `Maquette design produit` | 23 |
| 11 | `De l'idée à la maquette` | 23 |
| 12 | `Étude de faisabilité gratuite` | 29 |
| 13 | `Maquettes 360° en ligne` | 23 |
| 14 | `LED et pièces mobiles` | 21 |
| 15 | `Démontable et transportable` | 27 |

**Épinglage : non** (aucun titre épinglé). Raison : la zone est la France et 7 mots-clés sur 8 ne contiennent pas « Nantes » ; épingler « Maquettiste à Nantes » en position 1 l'afficherait aussi à un industriel de Lyon qui cherche « maquette de machine ». Si tu préfères qu'il apparaisse toujours, épingle-le en position 1 (l'« efficacité de l'annonce » affichée par Google baissera sans doute).

#### Descriptions (4)
| N° | Description | Car. |
|---|---|---|
| 1 | `Idéation, conception, modélisation 3D et fabrication : votre maquettiste à Nantes.` | 82 |
| 2 | `Maquettes sur mesure : architecture, industrie, salon, pédagogie, science, design produit` | 89 |
| 3 | `Étude de faisabilité gratuite avant tout paiement. Devis sur mesure. Livraison en France.` | 89 |
| 4 | `Atelier à Nantes (Canclaux). LED, pièces mobiles, vues 360° en ligne. Urgences possibles.` | 89 |

La description 2 n'a pas de point final (pour rester sous 90 avec marge).

#### Couverture (contrôle)
- **8 mots-clés** : maquettiste nantes (titre 1), maquette sur mesure (2), maquette industrielle (3), maquette de machine (4), maquette pédagogique (5), maquette salon professionnel (6), maquette en coupe (7), maquette démonstrateur (8).
- **4 types** (fusion du 03/11) : architecture (titre 9, description 2), industrielle, commerciale et de salon (titres 3 et 6, description 2), pédagogique et scientifique (titre 5, description 2), design produit (titre 10, description 2).
- **Métier** : idéation, conception, modélisation 3D, fabrication (description 1 ; titre 11).
- **Autres faits** : faisabilité gratuite et expertise avant paiement (titre 12, description 3), devis sur mesure et livraison (description 3), 360° (titre 13, description 4), LED et pièces mobiles (titre 14, description 4), démontable et transportable (titre 15), atelier Canclaux et urgences (description 4).

## 3. Mots-clés négatifs (au niveau campagne)
**Avec la requête large, ces négatifs sont indispensables : sans eux, les 8 mots-clés attirent modélisme, loisirs, emploi, formation, graphisme et web.**

Menu **Mots clés** > **Mots clés à exclure** > **+** > « Campagne Maquettage B2B » > colle la liste (un par ligne ; mets chaque ligne entre guillemets si tu veux l'expression exacte, sinon laisse tel quel = large). À faire le jour de la création, avant la première journée de diffusion.

```
gratuit
pdf
notice
tuto
stl
fichier
occasion
emploi
formation
école
salaire
cap
bts
diplôme
modélisme
kit
train
avion
bateau
voiture
revell
heller
tamiya
playmobil
lego
jouet
collection
papier
carton
minecraft
figma
web
site
application
logo
flyer
template
wireframe
ux
logiciel
cours
diy
comment faire
thingiverse
cults
stage
alternance
recrutement
offre d'emploi
bricolage
dessin
poupée
imprimante
tinkercad
blender
sketchup
autocad
cinema
```

#### Ajouts 03/11 (requête large)
```
musique
chanson
album
studio
graphique
graphiste
livre
magazine
journal
affiche
carte de visite
mariage
gâteau
```

Contrôle : 58 négatifs d'origine + 13 ajouts = 71, aucun doublon, et aucun ne bloque l'un des 8 mots-clés (vérifié par script).

## 4. Composants (anciennement « extensions »)
Menu **Composants** > **+** pour chaque type. Applique-les au niveau campagne. Aucun texte ne contient le mot « impression ».

### Liens annexes (4)
Texte du lien ≤ 25 car. ; deux lignes de description ≤ 35 car. chacune. Chaque URL pointe vers une page qui existe dans `src/pages` (vérifié) et porte `?utm_source=google&utm_medium=cpc&utm_campaign=maquettage&utm_content=<court-nom>`.

| N° | Texte (car.) | Ligne 1 (car.) | Ligne 2 (car.) | URL finale |
|---|---|---|---|---|
| 1 | `Maquettes industrielles` (23) | `Machines, démonstrateurs, salons` (32) | `Maquettes sur mesure en atelier` (31) | `https://nasap3d.com/maquette-industrielle?utm_source=google&utm_medium=cpc&utm_campaign=maquettage&utm_content=industrielle` |
| 2 | `Nos réalisations` (16) | `Maquettes avec LED et mobiles` (29) | `Vues 360° en ligne` (18) | `https://nasap3d.com/realisations?utm_source=google&utm_medium=cpc&utm_campaign=maquettage&utm_content=realisations` |
| 3 | `Parler de mon projet` (20) | `Étude de faisabilité gratuite` (29) | `Réponse rapide` (14) | `https://nasap3d.com/contact?utm_source=google&utm_medium=cpc&utm_campaign=maquettage&utm_content=contact` |
| 4 | `Nos services` (12) | `Conception et maquettage` (24) | `Atelier à Nantes` (16) | `https://nasap3d.com/services?utm_source=google&utm_medium=cpc&utm_campaign=maquettage&utm_content=services` |

La page maquette est déjà la page d'arrivée de l'annonce : pas de lien annexe vers elle. S'il y en avait un, l'URL serait `https://nasap3d.com/maquettiste-nantes?utm_source=google&utm_medium=cpc&utm_campaign=maquettage&utm_content=<court-nom>`.

### Accroches (6, ≤ 25 car.)
| N° | Accroche | Car. |
|---|---|---|
| 1 | `Atelier à Nantes` | 16 |
| 2 | `Expertise avant paiement` | 24 |
| 3 | `Maquettes 360° en ligne` | 23 |
| 4 | `Devis sur mesure` | 16 |
| 5 | `Urgences possibles` | 18 |
| 6 | `Livraison en France` | 19 |

### Extraits structurés
Type d'en-tête : **Types**. Valeurs (3 minimum, 10 maximum, ≤ 25 car.), les 4 types de maquettes (industrielle, commerciale et de salon = un seul type depuis le 03/11) :

| N° | Valeur | Car. |
|---|---|---|
| 1 | `Architecture` | 12 |
| 2 | `Industrielle et salon` | 21 |
| 3 | `Pédagogie et science` | 20 |
| 4 | `Design produit` | 14 |

### Appel
**Composants > Appels > +** : saisis **ton numéro** (pays : France), le même qu'à l'étape 2 du formulaire. Case « Compter comme conversion » : non (pas de balise). Je ne mets pas ton numéro ici volontairement.

### Lieu
**Composants > Lieux > +** : associe la fiche **Google Business Profile** de Nasap3D (compte Google de la fiche, autorise le lien). Vérifie que la catégorie secondaire « maquettiste » et des photos de maquettes sont sur la fiche.

## 5. Suivi et décision
- **Plausible** : filtre `utm_campaign = maquettage`, page `/maquettiste-nantes` (arrivée de l'annonce principale, sans `utm_content`). Sous-filtre `utm_content` (`industrielle`, `realisations`, `contact`, `services`) pour voir ce que rapportent les liens annexes. Regarde les pages vues, la durée, et les visites qui vont vers `/contact`. Google Ads ne verra pas les contacts (pas de balise) : compare avec le nombre de messages reçus.
- **J+7 et J+21** : Google Ads > **Mots clés** > **Termes de recherche**. Contrôle important en requête large. Pour chaque terme : pertinent (maquette pro) ou non. **Ajoute en négatif tout terme hors sujet** : loisir (modélisme, trains, avions), emploi, formation, logiciel/web, graphisme, fichier gratuit, et les autres villes si « maquettiste nantes » ressort sur une ville qui n'est pas la nôtre. Mets en pause un mot-clé qui a dépensé plus de 10 € sans qu'un message de contact n'arrive.
- **Critère d'arrêt/poursuite** (à J+21, soit environ 63 € dépensés) : ne rien conclure avant environ 100 clics ou 1 contact qualifié.
  - **Poursuivre** si au moins 1 demande sérieuse (formulaire ou appel) est arrivée, ou si les termes de recherche sont à 80 % pertinents et que les visites passent par `/contact`.
  - **Arrêter** si 0 contact ET les termes de recherche sont majoritairement hors sujet, ou si le CPC moyen dépasse nettement 3 € sans visite utile. Dans ce cas, garder le SEO et la fiche Google, couper la campagne.
- **Ne pas toucher** aux campagnes « Devis instantané » et ChatGPT Ads.

## 6. Contrôle des limites
Longueurs recomptées par script PowerShell (`"texte".Length` sur chaque texte, fichier lu en UTF-8) : voir les colonnes « Car. » ci-dessus.

Résultat : **44 textes contrôlés** (15 titres, 4 descriptions, 2 chemins, 4 textes de liens annexes, 8 lignes de description de liens annexes, 6 accroches, 4 valeurs « Types », 1 nom d'établissement), **0 dépassement**. Limites : titres 30, descriptions 90, chemins 15, liens annexes 25, lignes de liens annexes 35, accroches 25, extraits 25, nom d'établissement 25. Les plus proches de la limite : titre 12 (29/30), titre 6 (28/30), descriptions 2 à 4 (89/90). Contrôle des mots interdits sur les 44 textes : « impression » 0, « € » 0, « prix » 0, « à partir de » 0, nom de client 0.
