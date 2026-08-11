# Nasap3D — API

Back-end réel du site Nasap3D (Fastify + TypeScript + PostgreSQL/Prisma), destiné à remplacer
progressivement l'état simulé en `localStorage` du front-end statique (`../*.dc.html`).

Voir `PRICING.md` pour la formule de prix des pièces imprimées et `SHIPPING.md` pour
l'intégration Boxtal (simulation de tarif + point relais).

## Prérequis

- Node.js 20+
- Docker (pour PostgreSQL en local — ou un PostgreSQL 16 déjà installé)

## Installation

```bash
cd server
npm install
cp .env.example .env
```

Éditez `.env` si besoin (les valeurs par défaut correspondent au `docker-compose.yml` à la
racine du projet).

## Base de données

Depuis la racine du dépôt (pas `server/`) :

```bash
docker compose up -d db
```

Puis, depuis `server/` :

```bash
npx prisma migrate deploy   # applique la migration initiale
npm run seed                # matériaux/couleurs, qualités, remises, comptes admin+test
```

`npm run seed` est idempotent (basé sur `upsert`) : le relancer ne duplique rien et ne touche
pas aux comptes déjà créés.

### Comptes créés par le seed

| Rôle | Email | Mot de passe |
|---|---|---|
| Admin | `admin@nasap3d.com` (ou `SEED_ADMIN_EMAIL`) | celui communiqué séparément (ou `SEED_ADMIN_PASSWORD`) — **à changer après la première connexion** |
| Client de test | `client@nasap3d.com` | `Client2026!` (conservé tel quel à la demande, pour ne pas casser les tests manuels existants) |

Les deux mots de passe sont hashés en Argon2id avant stockage ; aucun n'est jamais écrit en
clair en base ni dans les logs.

## Développement

```bash
npm run dev
```

Démarre l'API en local avec rechargement à chaud (`http://localhost:3000`, `CORS_ORIGIN` doit
pointer vers l'origine du front, ex. `http://localhost:8080` si servi via
`python -m http.server 8080` à la racine du projet).

## Scripts utiles

| Commande | Effet |
|---|---|
| `npm run dev` | API en local avec rechargement à chaud |
| `npm run build` / `npm start` | Build de prod puis lancement |
| `npx prisma migrate dev` | Crée une nouvelle migration à partir des changements du schéma (nécessite une DB locale) |
| `npx prisma migrate deploy` | Applique les migrations existantes (utilisé en CI/prod) |
| `npx prisma studio` | Explorateur de données graphique |
| `npm run seed` | Rejoue le seed (idempotent) |
| `npm test` | Tests (Vitest) |

## Déploiement (OVH)

`docker-compose.yml` (racine du projet) inclut un service `api` derrière le profil `full` :

```bash
docker compose --profile full up -d --build
```

Le PostgreSQL n'est pas managé par OVH dans ce schéma : c'est un conteneur (ou une instance
dédiée) que vous administrez vous-même — pensez aux sauvegardes et à activer `sslmode=require`
sur `DATABASE_URL` si l'API et la base ne sont pas sur le même réseau privé.
