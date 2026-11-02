# Chantier : analyse Search Console (02/11/2026, item 51)

Lecture seule de Search Console (propriété domaine, compte `/u/2/`), données jusqu'au 31/10. Aucun réglage changé.
Décisions SEO en vigueur : `docs/chantiers/seo-national-decisions_2026-10-29.md` (inchangées).

## Chiffres clés
- Site entier, clics par semaine : août ~14 ; pic 28/sem. du 30/08 au 12/09 ; puis 11-17/sem. (15, 17, 13, 13, 14, 11, 15). Dernière semaine (25-31/10) : 15 clics, 799 impressions, meilleures impressions depuis début septembre.
- « -27 % sur 28 jours » (53 contre 73 clics) = la période précédente (7/09-4/10) contient le pic. Pas d'effondrement.
- Titres « France » en ligne le 01/11 à 23:04 : APRÈS la fenêtre de données. Ils n'expliquent rien de la baisse (toutes les données portent sur l'ancien titre « Impression 3D à Nantes — Devis Instantané »).
- Vraie perte = fiche Google Business Profile (pack local), visible sous `https://www.nasap3d.com/` (page « avec redirection », non indexée, mais 1 578 impressions sur 28 j : seule la fiche GBP pointe vers www). Clics/sem. : 14-19 (août-début sept., 600-1 043 impr.) → 7 (sem. du 13/09) → 1-6 depuis le 27/09 (370-460 impr.). Coïncide avec la mise en ligne du nouveau site (sitemap apex envoyé le 8/09, anciennes URL en 404).
- Requêtes de la fiche GBP : surtout « imprimante 3d » (584 impr., 0 clic : des gens qui veulent acheter une imprimante) → CTR faible de la page d'accueil, inévitable.
- 28 j, accueil apex : 1 112 impr. / 32 clics ; www (GBP) : 1 578 / 19. Le « 1 300 impr. / 3 clics » de Nolann vient d'une autre vue (à préciser).
- Requêtes : « impression 3d nantes » pos. 5,5 sur l'accueil (216 impr.), alors que `/impression-3d-nantes` est à 14,7 (47 impr.) : cannibalisation, l'accueil n'a AUCUN lien vers la page Nantes dans le corps (pied de page seulement). « impression 3d nantes particulier » pos. 4,1. « service impression 3d » 128 impr. pos. 27,5. « devis impression 3d » pos. 35,8. « impression 3d cholet » 62 impr. pos. 5, 0 clic (Cholet inchangé, décision). Marque « nasap3d » CTR 16,7 % (35,3 % avant).
- Indexation : 15 URL indexées, sitemap en ligne = 20. Non indexées (en ligne depuis le 01/11) : 4 guides, `/cgv`, `/maquette-impression-3d`. Dernière lecture du sitemap par Google : 30/10.
- Liens externes : 3 au total, tous vers l'accueil (hardware.fr, service-impression-3d.com, zoominfo). Aucune ancienne URL n'a de lien externe.
- Bing : seul avertissement = meta descriptions trop courtes (pages légales).

## 404 (anciennes URL)
- 301 proposées (équivalent exact) : `/mentions-légales` → `/mentions-legales` (encore indexée, 32 impr., 1 clic ; aujourd'hui chaîne 301 www → 404) ; `/politique-de-confidentialité` → `/confidentialite` ; `/politique-en-matière-de-cookies` → `/cookies` ; `/conditions-d-utilisation` → `/cgu` ; `/service-impression-3d`, `/retro-conception`, `/maintenance-machine`, `/initiation-impression-3d` → `/services` (la page services décrit ces 4 services).
- À laisser mourir : `api.nasap3d.com/*` (hôte de Florian/Caddy), `{{ nav.href }}`.
- Jamais de 301 vers l'accueil (Google le traite en soft 404).
- Moyen : `redirects` dans `astro.config.mjs` (seule voie dans le dépôt, le middleware est interdit) ; tester au curl les clés accentuées et le code 301 en local avant de commiter. Alternative : Caddy via Florian.

## Textes proposés (longueurs vérifiées)
- `/impression-3d-nantes` titre (58) : « Impression 3D à Nantes pour particuliers et pros | Nasap3D ». Variante : « Impression 3D à Nantes — Atelier, devis en ligne | Nasap3D ».
- `/impression-3d-nantes` meta (151) : « Atelier d'impression 3D à Nantes (Canclaux) : pièces, prototypes et maquettes pour particuliers et pros. Devis en ligne, expertise avant tout paiement. »
- `/confidentialite` meta (145) : « Données collectées par Nasap3D (compte, commandes, contact), usage, hébergement OVH, paiement Stripe, livraison, conservation et vos droits RGPD. »
- `/cookies` meta (148) : « Cookies utilisés sur nasap3d.com : cookies nécessaires à la connexion et au panier, mesure d'audience, durée de conservation et comment les refuser. »
- `/mentions-legales` meta (149) : « Mentions légales de Nasap3D, atelier d'impression 3D à Nantes : éditeur, directeur de la publication, hébergeur, propriété intellectuelle et litiges. »
- `/services` titre (58, actuel « Services : Impression 3D, Conception, Maquettage | Nasap3D ») : « Service d'impression 3D, conception et maquettes | Nasap3D ».
- Accueil : lien dans le corps vers `/impression-3d-nantes`, ancre « impression 3D à Nantes », section h2 « Un atelier d'impression 3D à Nantes » (`src/pages/index.astro` ~L140).
- Titre de l'accueil : NE PAS retoucher avant 3-4 semaines (en ligne depuis le 01/11, aucune donnée).
- JSON-LD : bloc LocalBusiness (réutiliser `@id https://nasap3d.com/#business`) sur la page Nantes ; `sameAs` avec l'URL Google Maps de la fiche (à demander à Nolann). À nettoyer, priorité basse : `aggregateRating` 5.0/54 écrit en dur sur l'accueil (avis auto-déclarés : pas d'étoiles, risque de règle Google).
- Sitemap : mettre les `lastmod` des pages modifiées les 27/10, 29/10 et 01/11 à leur vraie date.

## Actions de Nolann (hors code)
- Fiche Google Business Profile : site web → `https://nasap3d.com/` (au lieu de www) ; catégorie principale = service d'impression 3D ; photos et posts réguliers ; demander un avis après chaque commande ; liste des services.
- Demander à Florian : date d'ajout du 301 www → apex dans Caddy ; modification de la fiche GBP entre le 8 et le 27/09 ?
- Search Console : renvoyer `sitemap.xml` ; « Demander une indexation » (8, une dizaine par jour) : `/`, `/impression-3d-nantes`, `/impression-3d-en-ligne`, `/prix-impression-3d`, `/impression-3d-particuliers`, `/materiaux-impression-3d`, `/maquette-impression-3d`, `/cgv` (puis `/devis-instantane`, `/services` après retouche). Ancienne entrée `www.nasap3d.com/sitemap.xml` (2022) : à supprimer par lui.
- Bing : `node scripts/indexnow.mjs` seulement après mise en ligne des corrections et avec son accord.

## À remesurer dans 3-4 semaines (vers le 30/11)
« impression 3d nantes » (accueil 5,5 / page Nantes 14,7), « service impression 3d » (27,5), « devis impression 3d » (35,8), « impression 3d en ligne », « prix impression 3d », impressions de `www.nasap3d.com/` (fiche GBP), CTR de la marque.
