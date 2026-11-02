# Maquettage B2B : veille, requêtes, pistes (02/11/2026, items 60 et 63)

Base existante : `docs/ads_maquettage_2026-10-27.md` (proposition Ads du 27/10, reprise ici). Retour grand groupe client (nom hors dépôt) : « jamais trouvé quelqu'un qui fait ça ».
Limites de la veille : Google inaccessible aux agents (mur de consentement) → SERP lues sur Bing, puis **contrôlées sur Startpage (résultats Google) le 02/11** ; aucun volume ni CPC public trouvé (à relever dans le Planificateur de mots-clés Google Ads du compte de Nolann).
Ancien interdit levé : `docs/chantiers/seo-national-decisions_2026-10-29.md` l.24-25 classait `/maquette-impression-3d` « à ne pas toucher » (liste de la session shop). **Levé par l'item 60 (Nolann, 02/11).**

## 0. Google réel (Startpage, 02/11)
- **« maquettiste Nantes »** : 1. Maquettes BERTHO (vrai atelier nantais : naval + architecture, label Entreprise du patrimoine vivant ; site faible, sans title, sans industriel) ; 2. Agence Cub ; 3. Ari Maquette ; **4. nasap3d.com/maquette-impression-3d (déjà là, avec le title actuel sans « maquettiste »)** ; 5. PagesJaunes ; puis LinkedIn emplois, Tag immo, modélisme loisir. → Gagner 3 places est réaliste avec title/h1 « Maquettiste à Nantes » + preuves.
- **« maquettage Nantes »** : intention mélangée (agences web/UX, design thinking, CHU atelier prototypage, graphisme), **et l'accueil nasap3d.com est déjà 3e** (sa meta dit « maquettage »). → Le mot reste utile, mais en titre de page il tirerait vers un public web/graphisme ; on le garde dans la meta et le texte de la page maquette, et l'accueil le porte déjà.

## 1. Concurrents (« maquettiste Nantes » et voisins)
| Nom | Page | Ce qu'ils montrent | Preuves | Points faibles |
|---|---|---|---|---|
| Agence Cub | agence-cub.com/maquettiste-nantes/ + /maquette-industrielle/ | Architecture, animées, pédagogiques, industriel (alternateur d'éolienne animé), salons | 40 ans, clients nommés (Radio France, Parlement européen, Enedis, SNCF…), atelier SLA/laser/CNC | Bureaux Lille/Paris : page Nantes « fantôme ». Ni délai ni prix. Texte répétitif |
| L'Atelier (Atelier Concept) | atelierconcept.fr/maquettiste-model-maker-a-nantes-44000 | Stands, scénographie, industriel didactique animé, naval, ferroviaire | 34 ans, 1 206 maquettes, 198 clients, témoignages (Suez, GTT…) | Atelier à Argenteuil (95) : page Nantes fantôme. Ni délai ni prix. Bourrage de mots-clés |
| Agence Tag | agencetag-1.fr/studio3d/maquettiste-Nantes | Immobilier, concours, architecture, 360, prototypage | Catalogue PDF, aucun client nommé | Fautes, liens cassés, rien d'industriel |
| Ari Maquette | maquettes-architecture.fr/modliste-nantes | Architecture, historique, éducatif | Aucune visible | Adresse dans l'Yonne : page Nantes générique |
| Atelier SCALE | atelier-scale.com | Maquettisme en impression 3D : naval, industriel, salons, archi | Fastned, Black Pepper Yachts | Saint-Malo, site 2023, ni délai ni prix. Le plus proche de notre modèle |
| La Fabrique du Poulpe | (Vendée) | Maquettes industrielles et navales | non lu | non lu |
| CAP Maquettes / New Cap Maquettes | cap-maquettes.com | Boutique de modélisme (loisir) | — | Pas un concurrent B2B, occupe « maquette Nantes » côté loisir |
| Sculpteo, 3DEXPERIENCE Make, Hubs, freelances (Malt…) | — | Pièces en ligne, mise en relation | Devis instantané | Pas de maquette fonctionnelle, pas d'atelier local |

| Maquettes BERTHO | maquettes-bertho.com | Naval, architecture, promotion immobilière, « industrie Grand Ouest » | Label EPV | Vrai local, mais site minimal (pas de title, pas de photos de projets industriels, ni délai ni prix). N°1 Google sur « maquettiste Nantes » |

**Constat principal** (corrigé après Startpage) : un seul vrai local, BERTHO (naval/archi, site faible) ; aucun maquettiste industriel nantais avec preuves. Les pages « Nantes » qui rankent sont des pages locales d'agences parisiennes/lilloises. Personne ne montre : maquette de machine avec LED/pièces mobiles, maquette 360° en ligne, expertise de faisabilité avant paiement, délai ou prix indicatif. L'industriel est quasi vide à Nantes (seul Cub, depuis Paris/Lille).

## 2. Requêtes à viser (volumes introuvables, estimations)
| Requête | Estimation | Commentaire |
|---|---|---|
| maquettiste Nantes | moyen/faible, très qualifiée | **Cible n°1** |
| maquette industrielle (Nantes / sur mesure) | faible, très forte valeur | Océan bleu ; SERP nationale encombrée de formations/emplois |
| maquette architecture Nantes | moyen | Cub/Tag présents ; beaucoup d'étudiants |
| maquette salon / maquette de stand / maquette commerciale | moyen | Ambigu (salons du modélisme) |
| maquette promoteur immobilier | moyen | |
| maquette pédagogique sur mesure, démonstrateur, maquette de machine | faible | Notre point fort (cellule LED, bioréacteur) |
| maquette impression 3D | moyen/fort, brouillé | Titre actuel de la page |
| **maquettage Nantes** | piège | Google le comprend surtout comme wireframe/UX web. On garde le mot dans le texte, mais le titre vise « maquettiste » |

CPC : estimation d'agence 2-8 € en B2B industriel (kolonell.com) → à 2-5 €/jour ≈ 1 clic/jour.

## 3. Page actuelle (`src/pages/maquette-impression-3d.astro`)
Title « Maquette sur mesure : architecture, produit, pédagogique | Nasap3D » (sans Nantes) ; h1 4 types ; 4 cartes, 4 étapes, 6 photos, carrousel 360°, 7 FAQ, JSON-LD Service + FAQPage + BreadcrumbList. Manques : aucun lien interne sortant (sauf /contact), aucune preuve client, aucun délai, rien « pour qui » (B2B), pas de Nantes dans le title.

## 4. Pistes (à choisir par Nolann)
**Commun aux 3** : URL `/maquette-impression-3d` gardée (pas de casse SEO) ; title « Maquettiste à Nantes : maquettes industrielles et pro | Nasap3D » ; meta avec atelier Canclaux, expertise avant paiement, livraison France ; h1 « Maquettiste à Nantes : maquettes industrielles, d'architecture et de présentation » ; section « Pour qui » (bureaux d'études, industriels, architectes/promoteurs, exposants, labos/écoles) ; section preuves (grand groupe international anonymisé + cas : filtration, bioréacteur, cellule LED, caravane, avec secteur/usage) ; délais en fourchette (chiffres à donner par Nolann) ; FAQ enrichie (délais, confidentialité/NDA, démontable/transport salon, coût) ; JSON-LD Service avec `serviceType` par type + `hasOfferCatalog` ; liens depuis accueil, services, impression-3d-nantes, footer (déjà là) ; liens sortants vers /impression-3d-nantes, /services, maquettes 360°. Indexation demandée par Nolann APRÈS le push.

- **A. Page unique renforcée** : tout sur la même page. Rapide, aucune page mince. Limite : une seule page pour Nantes + industriel + archi + salons.
- **B. Page renforcée + `/maquette-industrielle`** (recommandé) : 2e page dédiée machines, démonstrateurs, salons (l'océan bleu), avec ses propres cas, FAQ et JSON-LD ; lien croisé ; elle sert de page d'arrivée à la pub industrielle. Ajout au sitemap.
- **Option `/maquettiste-nantes`** (page locale courte, citée par la tâche comme « éventuelle page maquettage Nantes ») : NON recommandée. La page maquette est déjà 4e sur « maquettiste Nantes » ; une 2e page sur la même requête se cannibaliserait et serait mince. Le title/h1 « Maquettiste à Nantes » sur l'URL existante fait le même travail sans risque.
- **Fiche Google Business** (plus gros levier probable sur le pack local, invisible à la veille) : vérifier/ajouter une catégorie secondaire « maquettiste » + photos de maquettes (à faire par Nolann).
- **C. Page renforcée + 3 sous-pages** (industrielle, architecture/promoteur, salon) : couverture maximale ; risque de pages minces sans assez de photos par sujet ; plus long.

## 5. Campagne Google Ads « Maquettage B2B » (séparée de « Devis instantané »)
- Search seul (pas Performance Max), CPC manuel plafonné (point de départ 1,50 €, à ajuster sur le Planificateur), budget à décider (2-5 €/jour), 3 semaines de test, zone : France sur mots-clés industriels, Nantes + 50 km sur « maquettiste ».
- Groupes : 1) Maquettiste Nantes (maquettiste nantes, maquette nantes sur mesure, maquette architecture nantes) → page principale ; 2) Maquette industrielle (maquette industrielle, maquette de machine, maquette salon professionnel, démonstrateur, maquette pédagogique sur mesure) → `/maquette-industrielle` si piste B, sinon page principale. Correspondance expression + exacte.
- Négatifs : gratuit, pdf, notice, tuto, stl, fichier, occasion, emploi, formation, école, salaire, cap, bts, diplôme, modélisme, kit, train, avion, bateau, voiture, revell, heller, tamiya, playmobil, lego, jouet, collection, papier, carton, minecraft, figma, web, site, application, logo, flyer, template, wireframe, ux.
- Annonces responsives (titres ≤ 30 car., descriptions ≤ 90) : à rédiger après le choix de piste, uniquement avec des faits vrais.
- Composants : liens annexes, accroches (Atelier à Nantes, Expertise avant paiement, Maquettes 360° en ligne), extraits structurés (types), lieu (fiche Google), appel.
- Mesure : pas de balise Google (décision 59) → Google Ads ne voit pas les contacts ; suivi via UTM `utm_campaign=maquettage` dans Plausible + clics d'appel comptés par Google. Optimisation manuelle (termes de recherche à J+7, J+21).

## 6. Questions pour Nolann
Délais réels (fourchettes), prix « à partir de » (ou non), droit de citer le grand groupe (nom/logo ou anonymisé), avis Google à montrer, budget Ads.

Sources : agence-cub.com, atelierconcept.fr, agencetag-1.fr, maquettes-architecture.fr, atelier-scale.com, 3dnatives.com, 118000.fr, kolonell.com, support.google.com (annonces responsives, Smart Bidding, appels).
