# Nasap3D

Site web de [Nasap3D](https://nasap3d.com) — impression 3D et fabrication sur-mesure à Nantes.
Devis instantané avec tranchage réel du fichier, paiement en ligne, livraison, et espace client
complet, adossés à un vrai back-end (plus aucun état simulé en `localStorage`).

## Aperçu

- **Devis instantané réel** : le client dépose son fichier STL / OBJ / STEP, l'aperçu 3D affiche
  la pièce réelle (pas un cube générique), et le prix est calculé à partir d'un vrai tranchage
  PrusaSlicer côté serveur — jamais fait confiance à un prix envoyé par le navigateur.
- **Paiement réel** : Stripe Checkout, montant recalculé côté serveur au moment du paiement.
- **Livraison réelle** : simulation de tarif et sélection d'un point relais via Boxtal.
- **Comptes clients réels** : inscription/connexion avec vérification d'email par code à 6
  chiffres, changement d'email/mot de passe sécurisé, historique de commandes et factures PDF.
- **Espace admin** : gestion du stock filament, des tarifs, et des commandes.
- **Anti-robot** : hCaptcha (formulaires de contact, connexion, inscription).

## Architecture

Le front-end est un site **statique** — des pages `*.dc.html` (composants « Design Component » :
HTML + une classe de logique JS par page, voir `support.js`) qui appellent une **API séparée**
dans `server/`.

```
├── *.dc.html            Pages du site (front-end statique)
├── api-client.js        Client JS partagé vers l'API (server/)
├── viewer3d.js           Aperçu 3D réel (three.js + occt-import-js pour le STEP)
├── vendor/               Dépendances front vendorisées (three.js, occt-import-js)
├── server/                API réelle (Fastify + TypeScript + PostgreSQL/Prisma)
│   ├── PRICING.md         Formule de calcul de prix (détaillée, avec exemples)
│   ├── SHIPPING.md         Intégration Boxtal
│   └── README.md           Installation, variables d'environnement, tests
└── HANDOFF_CLAUDE_CODE.md  Brief d'origine ayant cadré la construction du back-end
```

## Démarrer en local

```bash
# 1. Base de données + API (conteneurs Docker — le build inclut PrusaSlicer,
#    donc le devis instantané tranche réellement, comme en prod)
cp server/.env.example server/.env   # puis remplir les variables (voir server/README.md)
docker compose --profile full up -d --build   # http://localhost:3000

# 2. Migrations + données de départ (une fois, depuis server/)
cd server
npm install
npx prisma migrate deploy
npm run seed

# 3. Front-end statique (autre terminal, à la racine du dépôt)
python -m http.server 8080   # http://localhost:8080/Home.dc.html
```

`--build` peut être remplacé par `pull` pour récupérer l'image déjà construite
(`ghcr.io/nsapp44/nasap3d-api`) au lieu de la reconstruire localement.

Détails complets (variables d'environnement, comptes de test, tests automatisés, déploiement) :
voir [`server/README.md`](server/README.md).

## Documents associés

- [`server/README.md`](server/README.md) — installation, variables d'environnement, tests.
- [`server/PRICING.md`](server/PRICING.md) — formule de prix, avec exemples chiffrés.
- [`server/SHIPPING.md`](server/SHIPPING.md) — intégration Boxtal (tarifs + point relais).
- [`HANDOFF_CLAUDE_CODE.md`](HANDOFF_CLAUDE_CODE.md) — brief d'origine du projet.
