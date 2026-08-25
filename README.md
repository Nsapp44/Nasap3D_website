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
├── vendor/               Dépendances front vendorisées (three.js, occt-import-js, intl-tel-input, boxtal-parcel-point-map)
├── Caddyfile             Reverse proxy + URLs propres (voir Caddy.Dockerfile, image ghcr.io/nsapp44/nasap3d-caddy)
├── docker-compose.yml    Toute la stack (db, api, caddy) — voir server/README.md "Déploiement (OVH)"
├── server/                API réelle (Fastify + TypeScript + PostgreSQL/Prisma)
│   ├── PRICING.md         Formule de calcul de prix (détaillée, avec exemples)
│   ├── SHIPPING.md         Intégration Boxtal
│   └── README.md           Installation, variables d'environnement, tests
└── HANDOFF_CLAUDE_CODE.md  Brief d'origine ayant cadré la construction du back-end
```

## Déploiement (OVH)

Deux images pré-construites, publiées sur GitHub Container Registry à chaque push sur `master` qui
les concerne : `ghcr.io/nsapp44/nasap3d-api` (`.github/workflows/docker-publish.yml`, déclenché par
`server/**`) et `ghcr.io/nsapp44/nasap3d-caddy` (`.github/workflows/docker-publish-caddy.yml`,
déclenché par les fichiers du front-end + `Caddyfile`). Le serveur OVH n'a donc besoin que de Docker
installé — pas de Node/npm/PrusaSlicer, et pas besoin non plus que le dépôt soit cloné/à jour sur
l'hôte pour que le site soit servi, tout est déjà dans les images :

```bash
cp server/.env.example server/.env   # remplir les variables de prod (voir server/README.md)
docker compose --profile full pull
docker compose --profile full up -d   # Caddy sur :80/:443, API en interne, PostgreSQL en conteneur
```

C'est tout : le conteneur API applique lui-même les migrations et le seed (catalogue
matières/couleurs, compte admin) à chaque démarrage — pas de `npm install` ni de commande Prisma à
lancer à la main sur le serveur, voir [`server/README.md`](server/README.md#déploiement-ovh).

Les deux paquets GHCR sont **publics** (pas d'authentification nécessaire pour le `pull` depuis
OVH), mais chacun reste à rendre public manuellement après son tout premier push réussi (GitHub →
*Packages* → `nasap3d-api` ou `nasap3d-caddy` → *Package settings* → *Change visibility* →
*Public*).

Checklist de mise en prod complète (variables obligatoires, PrusaSlicer dans l'image Docker,
PostgreSQL non managé par OVH) : voir [`server/README.md`](server/README.md#déploiement-ovh).

Pour développer en local plutôt qu'en déployer, voir [`server/README.md`](server/README.md).

## Documents associés

- [`server/README.md`](server/README.md) — installation, variables d'environnement, tests.
- [`server/PRICING.md`](server/PRICING.md) — formule de prix, avec exemples chiffrés.
- [`server/SHIPPING.md`](server/SHIPPING.md) — intégration Boxtal (tarifs + point relais).
- [`HANDOFF_CLAUDE_CODE.md`](HANDOFF_CLAUDE_CODE.md) — brief d'origine du projet.
