# Prompt de reprise — Nasap3D (handoff Claude Code)

> À coller dans Claude Code, à la racine du projet déjà ouvert dans VS Code.

---

## Contexte

Tu reprends le code d'un site **Nasap3D** (impression 3D & fabrication sur-mesure, à Nantes). Le front-end actuel est un **prototype de design** : un ensemble de pages `*.dc.html` (composants « Design Component », HTML + une classe de logique JS par page), plus des modules partagés :

- `stock.js` — stock filament + drapeau « devis en ligne / mode vacances » (`isQuoteEnabled`), stockés en **localStorage** (démo uniquement).
- `cart.js` — panier en localStorage.
- `navguard.js` — masque la navigation Devis/Panier quand le mode vacances est actif.
- `pageloader.js` — overlay de chargement inter-pages.
- Pages clés : `Home.dc.html`, `Devis Instantane.dc.html`, `Services.dc.html`, `About.dc.html`, `Realisations.dc.html`, `Machines.dc.html`, `Contact.dc.html`, `Cart.dc.html`, `Account.dc.html`, `Admin.dc.html`, `404.dc.html`, `Loading.dc.html`, + pages légales.

**Tout l'état « métier » est actuellement simulé en localStorage** (comptes, stock, commandes, panier, factures). Ta mission : construire un **vrai back-end** et brancher le front dessus, sans casser le design existant.

Commence par **lire l'ensemble du code** (les `.dc.html`, `stock.js`, `cart.js`, `Account.dc.html`, `Admin.dc.html`, `Devis Instantane.dc.html`, `Home.dc.html`) et **dresse-moi une cartographie** de ce qui existe avant d'écrire du code. Ne casse aucun rendu visuel.

---

## Stack back-end attendue

Propose et justifie une stack, avec par défaut :
- **API** : Node.js + TypeScript (Fastify ou NestJS), REST (ou tRPC) documentée (OpenAPI).
- **Base de données** : PostgreSQL via Prisma (migrations versionnées).
- **Auth** : sessions httpOnly + refresh, ou JWT courts. **Mots de passe hashés avec Argon2id** (voir plus bas).
- **Paiement** : Stripe (Payment Intents + webhooks).
- **Stockage fichiers** : S3-compatible (uploads STL/STEP/3MF), avec URLs signées.
- **Fichiers d'infra** : `.env.example`, `docker-compose` (db + api), scripts de seed, README d'install.

Garde une séparation nette **front (statique) / API**. Expose une couche `api-client` côté front pour remplacer les accès localStorage un par un.

---

## Tâches

### 1. Modèle de données + migrations
Modélise au minimum : `User` (email unique, `passwordHash`, `customerNo`, rôle `client|admin`, timestamps), `Order` (réf `N3D-xxxx`, statut `pending|printing|ready|delivered`, lignes, montant **calculé serveur**, dates), `Invoice` (réf au format **`FA00X-AAAA_MM_JJ_NuméroClient`**, où `00X` = compteur de factures **du jour**, PDF), `Filament`/`Stock` (matériau, couleur, hex, `inStock`), `QuoteJob` (fichier uploadé, options, résultat d'analyse, prix), `Setting` (drapeau `quoteEnabled` = mode vacances).
- Le **numéro de client** et le **format de facture** doivent être générés **côté serveur** (le front ne fait qu'afficher).

### 2. Auth + sécurité mots de passe
- Remplace le système localStorage de `Account.dc.html` (inscription / connexion / mot de passe oublié / changement email / changement mot de passe / suppression de compte) par de vrais endpoints.
- **Hash Argon2id** (lib `argon2`), paramètres raisonnables (mémoire ≥ 19 MiB, itérations ≥ 2, parallélisme adapté), **jamais** de mot de passe en clair ni en log. Sels gérés par la lib. Prévois une politique de rotation/upgrade des paramètres.
- Validation mot de passe : ≥ 8 caractères, ≥ 1 majuscule, ≥ 1 caractère spécial (déjà appliquée côté front, à revalider côté serveur).
- Rôle admin : la page `Admin.dc.html` doit être protégée par un vrai contrôle d'accès serveur (aujourd'hui c'est un e-mail/mot de passe en dur dans le front — à supprimer).
- Compte de démo en dur (identifiants codés dans le front) : à retirer, à remplacer par un vrai compte de test seedé.

### 3. reCAPTCHA Google
- Remplace **tous les faux captchas « Je ne suis pas un robot »** (cases à cocher) par **Google reCAPTCHA** (v3 de préférence, ou v2 invisible) sur : **inscription**, **connexion**, et les **formulaires de contact** (`Contact.dc.html` et la section contact de `Home.dc.html`).
- Vérifie le token **côté serveur** (`siteverify`) avant de traiter la requête ; clés en variables d'environnement ; rejette si score trop bas (v3).

### 4. Devis instantané — grande passe + prix côté serveur (IMPORTANT)
C'est le cœur. Aujourd'hui le prix est calculé **dans le front** (`Devis Instantane.dc.html` et `Home.dc.html`) : prix unitaire fixe de 14 € × quantité × (1 − remise), avec paliers de remise `≥5:−5% / ≥15:−10% / ≥50:−15% / ≥100:−20% / ≥500:−30%`. Le remplissage, la qualité et le matériau **n'influencent pas encore le prix**. C'est un placeholder.

**Exigence de sécurité (réponds-y explicitement) :** le calcul de prix **doit se faire côté serveur**, jamais dans le navigateur. Le client peut modifier le HTML/JS ou le payload et donc « forcer » un prix. Donc :
- Le front n'affiche qu'une **estimation indicative**.
- Le backend **recalcule le prix faisant autorité** à partir du **fichier réellement uploadé** (analyse serveur du STL/STEP : volume, boîte englobante, temps estimé) + options (matériau, couleur, remplissage, qualité/hauteur de couche, quantité) + paliers de remise.
- Le **montant envoyé à Stripe = montant serveur**, recalculé au moment du paiement (ne jamais faire confiance au montant venant du client). Idéalement, le devis serveur est signé/stocké (`QuoteJob`) et référencé par id lors du checkout, avec une date d'expiration.
- Analyse géométrique : propose une lib (ex. parsing STL maison pour volume/bbox, ou service dédié) et documente la formule.

Ensuite, **explique-moi en détail et par écrit comment tu calcules le prix** : la formule complète (coût matière = volume effectif × densité matériau × prix/kg ; coût machine = temps estimé × taux horaire ; marge ; frais fixes/setup ; multiplicateur qualité ; multiplicateur matériau ; application des remises quantité), avec des exemples chiffrés. Rends les paramètres (prix/kg par matériau, taux horaire, marges, paliers) **configurables en base** et éditables depuis l'admin.

### 5. Stock, commandes, admin, mode vacances
- Branche `stock.js` sur la base (matériaux/couleurs `inStock`), et le drapeau **mode vacances** (`quoteEnabled`) sur `Setting` : quand OFF, l'API refuse tout nouveau devis/commande et le front masque déjà la nav (garder ce comportement, mais la source de vérité devient le serveur).
- Gestionnaire de commandes admin : accepter (→ printing), **refuser (→ supprime/masque la commande)**, changer d'étape, **filtres par étape** — reproduire le comportement actuel côté API.
- Panier (`cart.js`) : persistance serveur par utilisateur (et fusion panier invité → compte à la connexion).

### 6. Factures + Stripe
- Génère les factures (PDF) au bon format serveur, rattachées au compte et au numéro de client, téléchargeables depuis `Account.dc.html`.
- Stripe : Payment Intent créé côté serveur avec le montant serveur ; webhooks pour confirmer le paiement et créer la commande + la facture.

---

## Contraintes
- **Ne dégrade pas le design** ni l'UX existants ; remplace la logique, pas l'apparence.
- Tout secret en `.env` (jamais commité). Fournis `.env.example`.
- Écris des tests sur : hash/verify Argon2, vérification reCAPTCHA, et surtout **le calcul de prix serveur** (anti-tampering : un prix client falsifié doit être ignoré).
- Livre un **README** : install, migrations, seed (dont le compte de test), lancement, et la **doc de la formule de prix**.

## Ordre de livraison suggéré
1. Cartographie du code + choix de stack (validation avec moi).
2. Schéma DB + migrations + seed.
3. Auth (Argon2) + reCAPTCHA.
4. Devis serveur + calcul de prix + doc de la formule.
5. Stock / commandes / admin / mode vacances.
6. Stripe + factures.
7. Tests + README.

Commence par les points 1 et 2, puis attends ma validation avant d'attaquer la suite.
