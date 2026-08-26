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

Le front-end est un site **Astro** (`output: 'static'`, îlots React pour tout ce qui est
interactif — devis, panier, compte, admin) qui appelle une **API séparée** dans `server/`. Les
deux sont fusionnés dans **une seule image Docker** en production : `server/Dockerfile` construit
le site Astro dans un stage dédié et Fastify le sert directement (`@fastify/static`, en secours de
toute route qui ne correspond à aucune route API) — plus de conteneur reverse-proxy séparé.

```
├── src/                   Site Astro (pages, composants React, hooks, styles)
│   ├── pages/              Routage par fichier
│   ├── components/         Composants Astro + îlots React (devis, panier, compte, admin, accueil)
│   ├── hooks/               État/logique des îlots (un hook par flux : devis, panier, compte...)
│   └── lib/                 Client API, utilitaires partagés
├── public/                 Fichiers servis tels quels (assets, vendor JS non-bundlé, robots/sitemap)
├── astro.config.mjs
├── docker-compose.yml      Toute la stack (db, api — l'api sert aussi le site) — voir server/README.md
├── server/                 API réelle (Fastify + TypeScript + PostgreSQL/Prisma)
│   ├── Dockerfile           Multi-stage : API + build Astro, assemblés dans une seule image
│   ├── PRICING.md           Formule de calcul de prix (détaillée, avec exemples)
│   ├── SHIPPING.md           Intégration Boxtal
│   └── README.md             Installation, variables d'environnement, tests
└── HANDOFF_CLAUDE_CODE.md   Brief d'origine ayant cadré la construction du back-end
```

## Déploiement (OVH)

Une image pré-construite, publiée sur GitHub Container Registry à chaque push sur `master` qui la
concerne (`.github/workflows/docker-publish.yml`, déclenché par `server/**` et le code Astro
`src/`/`public/`/`astro.config.mjs`). Le serveur OVH n'a donc besoin que de Docker installé — pas de
Node/npm/PrusaSlicer, et pas besoin non plus que le dépôt soit cloné/à jour sur l'hôte pour que le
site soit servi, tout est déjà dans l'image :

```bash
cp server/.env.example server/.env   # remplir les variables de prod (voir server/README.md)
docker compose --profile full pull
docker compose --profile full up -d   # API + site sur :3000 (interne), PostgreSQL en conteneur
```

C'est tout : le conteneur API applique lui-même les migrations et le seed (catalogue
matières/couleurs, compte admin) à chaque démarrage — pas de `npm install` ni de commande Prisma à
lancer à la main sur le serveur, voir [`server/README.md`](server/README.md#déploiement-ovh).

Le reverse proxy déjà en place côté serveur OVH (gère aussi le HTTPS) doit joindre le conteneur par
son nom Docker sur le réseau `nasap3d_network` : `api:3000` — pas de port publié publiquement.

Le paquet GHCR est **public** (pas d'authentification nécessaire pour le `pull` depuis OVH), mais
reste à rendre public manuellement après son tout premier push réussi (GitHub → *Packages* →
`nasap3d-api` → *Package settings* → *Change visibility* → *Public*).

Checklist de mise en prod complète (variables obligatoires, PrusaSlicer dans l'image Docker,
PostgreSQL non managé par OVH) : voir [`server/README.md`](server/README.md#déploiement-ovh).

Pour développer en local plutôt qu'en déployer, voir [`server/README.md`](server/README.md) (API)
et lancer `npm run dev` à la racine du dépôt (site Astro, `:4321`).

## Documents associés

- [`server/README.md`](server/README.md) — installation, variables d'environnement, tests.
- [`server/PRICING.md`](server/PRICING.md) — formule de prix, avec exemples chiffrés.
- [`server/SHIPPING.md`](server/SHIPPING.md) — intégration Boxtal (tarifs + point relais).
- [`HANDOFF_CLAUDE_CODE.md`](HANDOFF_CLAUDE_CODE.md) — brief d'origine du projet.
