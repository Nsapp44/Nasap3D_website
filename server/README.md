# Nasap3D — API

Back-end réel du site Nasap3D (Fastify + TypeScript + PostgreSQL/Prisma), consommé par le site
Astro à la racine du dépôt (`../src`). Fournit une vraie base de données, une vraie
authentification, un vrai calcul de devis (slicing réel), un vrai paiement (Stripe) et une vraie
livraison (Boxtal).

Documents associés :

- `PRICING.md` — formule de prix des pièces imprimées (calculée uniquement côté serveur).
- `SHIPPING.md` — intégration Boxtal (simulation de tarif + point relais).
- `slicer-profiles/README.md` — profils d'imprimantes utilisés par PrusaSlicer.

## Architecture en un coup d'œil

- **Fastify 5 + TypeScript (ESM)** — `src/app.ts` construit l'app (routes, plugins), `src/index.ts`
  la démarre. Cette séparation permet aux tests (`test/`) de charger une vraie app sans ouvrir de
  port réseau (`app.inject(...)`).
- **PostgreSQL + Prisma 6** — schéma dans `prisma/schema.prisma`, migrations dans
  `prisma/migrations/`.
- **Argon2id** pour les mots de passe, **sessions httpOnly** (cookie `n3d_session`, révocables
  côté serveur) plutôt que des JWT. La session côté base dure toujours 30 jours, mais le cookie
  lui-même n'est persistant que si la case « Se souvenir de moi » était cochée à la connexion
  (`rememberMe` dans `POST /auth/login`, voir `setSessionCookie()` dans `src/lib/session.ts`) —
  sinon c'est un cookie de session standard, effacé à la fermeture du navigateur.
- **Vérification par code à 6 chiffres** (inscription, changement d'email, changement de mot de
  passe) — voir `src/lib/verification.ts`.
- **Devis serveur** : PrusaSlicer CLI tranche réellement le fichier envoyé (pas d'estimation
  approximative) — voir `src/lib/slicer.ts` et `PRICING.md`.
- **Paiement** : Stripe Checkout Sessions, webhook `/webhooks/stripe` qui crée la commande une
  fois le paiement confirmé et récupère la facture PDF générée par Stripe.
- **Livraison** : Boxtal (voir `SHIPPING.md`) — simulation de tarif réelle au moment du paiement,
  jamais un prix envoyé par le navigateur.
- **Stockage fichiers** (STL uploadés, factures PDF) : S3-compatible, avec repli automatique sur
  le disque local (`server/uploads/`) tant que `S3_*` n'est pas configuré — voir `src/lib/storage.ts`.
- **Email transactionnel** : SMTP (`src/lib/mailer.ts`) — tant que `SMTP_*` n'est pas configuré,
  chaque email est simplement affiché dans les logs du serveur au lieu d'être envoyé (pratique
  pour développer sans boîte mail configurée, voir plus bas "Tester sans SMTP configuré").

## Prérequis

- Node.js 22+
- Docker (pour PostgreSQL en local — ou un PostgreSQL 16 déjà installé)
- PrusaSlicer (CLI) installé quelque part sur la machine, pour que le devis instantané fonctionne
  réellement — voir `PRUSASLICER_BIN` plus bas. Sans lui, tout le reste de l'API fonctionne, seul
  `POST /quotes` échouera.

## Installation

```bash
cd server
npm install
cp .env.example .env
```

Puis remplissez `.env` — voir le tableau des variables ci-dessous. Les valeurs par défaut
correspondent au `docker-compose.yml` à la racine du projet.

## Variables d'environnement

| Catégorie                                     | Variables                                                              | Sans elles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Base de données                               | `DATABASE_URL`                                                         | Rien ne démarre — obligatoire. ⚠️ En déploiement Docker, la valeur de `server/.env` est **ignorée** (`docker-compose.yml` impose la sienne) — voir la section [PostgreSQL](#postgresql) plus bas.                                                                                                                                                                                                                                                                                                                                                                                                            |
| Serveur                                       | `PORT`, `NODE_ENV`, `CORS_ORIGIN`, `FRONT_URL`, `API_BASE_URL`         | `CORS_ORIGIN` doit pointer vers l'origine du front (ex. `http://localhost:4321` en dev), sinon le navigateur bloque les appels API. `API_BASE_URL` sert à construire le lien de téléchargement de pièce jointe dans l'email de notification de contact. ⚠️ `NODE_ENV` : la valeur de `server/.env` est **ignorée** en déploiement Docker (`docker-compose.yml` impose `production`) — voir la section [PostgreSQL](#postgresql) pour le même principe sur `DATABASE_URL`. Sans `NODE_ENV=production`, hCaptcha se désactive silencieusement au lieu de bloquer, et les cookies de session perdent le flag `Secure`. |
| Notifications                                 | `CONTACT_NOTIFY_EMAIL`, `ORDER_NOTIFY_EMAIL`                           | Les notifications (contact, nouvelle commande) ne sont juste pas envoyées.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Email (SMTP)                                  | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`    | Chaque email (codes de vérification, reset mot de passe, notifications) s'affiche dans les logs au lieu de partir réellement. Rien n'est bloqué.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Auth                                          | `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM`         | Valeurs par défaut OWASP raisonnables — à ne durcir que si le matériel de prod le permet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Anti-robot (hCaptcha)                         | `HCAPTCHA_SECRET_KEY`                                                  | Sans elle, la vérification anti-robot est **désactivée automatiquement en dev** (`NODE_ENV != production`) et **bloque tout en prod** — voir `src/lib/captcha.ts`. La clé publique ("site key") n'est **pas** ici : codée en dur dans `src/lib/api-client.ts` (projet Astro à la racine du dépôt, aucun accès à ce `.env`).                                                                                                                                                                                                                                                                                                         |
| Devis (PrusaSlicer)                           | `PRUSASLICER_BIN`                                                      | `POST /quotes` échoue avec `slicing_failed`. ⚠️ En déploiement Docker, la valeur de `server/.env` est **ignorée** (`docker-compose.yml` impose `/usr/local/bin/prusa-slicer` au service `api`).                                                                                                                                                                                                                                                                                                                                                                                                              |
| Livraison (Boxtal)                            | `BOXTAL_API_KEY_V1/_SECRET_V1`, `BOXTAL_SHIPPER_*`                     | `POST /shipping/rates` et `POST /checkout` échouent avec `shipping_not_configured`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Livraison — widget carte (Boxtal)             | `BOXTAL_MAP_API_KEY`, `BOXTAL_MAP_API_SECRET`                          | Paire distincte des clés ci-dessus, pour un endpoint séparé : `GET /shipping/map-token` échoue aussi avec `shipping_not_configured` sans elles — le widget de sélection du point relais ne peut pas s'afficher. Voir `server/SHIPPING.md`.                                                                                                                                                                                                                                                                                                                                                                   |
| Paiement (Stripe)                             | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                           | `POST /checkout` échoue. Utilisez une clé `sk_test_...`, jamais `sk_live_...` en développement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Stockage (S3)                                 | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Repli automatique sur le disque local (`server/uploads/`) — pratique en dev, à configurer avant la mise en prod réelle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Base de données

Depuis la racine du dépôt (pas `server/`) :

```bash
docker compose up -d db
```

Puis, depuis `server/` :

```bash
npx prisma migrate deploy   # applique toutes les migrations
npm run seed                # matériaux/couleurs, qualités, remises, comptes admin+test
```

`npm run seed` est idempotent (basé sur `upsert`) : le relancer ne duplique rien et ne touche
pas aux comptes déjà créés.

### Comptes créés par le seed

| Rôle           | Email                                       | Mot de passe                                                                                       |
| -------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Admin          | `admin@nasap3d.com` (ou `SEED_ADMIN_EMAIL`) | celui communiqué séparément (ou `SEED_ADMIN_PASSWORD`) — **à changer après la première connexion** |
| Client de test | `client@nasap3d.com`                        | `Client2026!` (conservé tel quel à la demande, pour ne pas casser les tests manuels existants)     |

Les deux mots de passe sont hashés en Argon2id avant stockage ; aucun n'est jamais écrit en
clair en base ni dans les logs. Les deux comptes seedés sont marqués email-vérifié d'office (ils
ne passent pas par le vrai parcours d'inscription).

## Développement

Lancer l'API :

```bash
npm run dev
```

Démarre l'API en local avec rechargement à chaud (`http://localhost:3000`).

Le front-end est le projet Astro à la racine du dépôt — projet npm distinct, avec son propre
`package.json`/lockfile :

```bash
cd ..
npm install
npm run dev
```

Démarre le serveur de dev Astro sur `http://localhost:4321`. `CORS_ORIGIN` dans `server/.env`
doit correspondre à cette origine.

### Tester sans SMTP configuré

Tant que `SMTP_HOST` n'est pas renseigné, aucun email n'est réellement envoyé — mais rien n'est
bloqué : chaque email (code de vérification à l'inscription, reset de mot de passe, changement
d'email/mot de passe) s'affiche dans le terminal où tourne `npm run dev`, par exemple :

```
[mailer] (SMTP not configured — see SMTP_* in .env) to=vous@exemple.com subject="Votre code de vérification Nasap3D"
Votre code de vérification : 123456
```

Pour créer un compte de test en local : inscrivez-vous normalement sur le site, puis récupérez
le code à 6 chiffres dans ce terminal et saisissez-le dans le popup de vérification qui s'ouvre
automatiquement après l'inscription.

## Tests

```bash
npm test
```

Vitest. Deux catégories :

- **Tests unitaires** (`pricing.test.ts`, `password.test.ts`, `tokens.test.ts`,
  `recaptcha.test.ts`) — fonctions pures, aucune dépendance externe. `pricing.test.ts` est le
  plus important : il vérifie que le calcul de prix est déterministe et ignore tout champ
  "prix" injecté dans ses entrées — c'est la garantie anti-triche que le prix affiché au client
  ne peut jamais être celui qu'il paie réellement s'il est différent de celui recalculé côté
  serveur.
- **Tests d'intégration** (`routes.integration.test.ts`) — démarrent une vraie app Fastify
  (`src/app.ts`) contre la vraie base de données de `DATABASE_URL`, sans mock. Couvre un parcours
  complet inscription → code de vérification → confirmation.

Ces tests supposent une base de données PostgreSQL accessible via `DATABASE_URL` (celle de dev
suffit).

## Scripts utiles

| Commande                      | Effet                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run dev`                 | API en local avec rechargement à chaud                                                      |
| `npm run build` / `npm start` | Build de prod puis lancement                                                                |
| `npx prisma migrate dev`      | Crée une nouvelle migration à partir des changements du schéma (nécessite une DB locale)    |
| `npx prisma migrate deploy`   | Applique les migrations existantes (utilisé en CI/prod)                                     |
| `npx prisma studio`           | Explorateur de données graphique                                                            |
| `npm run seed`                | Rejoue le seed (idempotent) — tourne aussi automatiquement au démarrage du conteneur Docker |
| `npm test`                    | Tests (Vitest)                                                                              |

## Déploiement (OVH)

`docker-compose.yml` (racine du projet) inclut un service `api` derrière le profil `full`. Son
image sert à la fois l'API **et** le site Astro — un seul conteneur, plus de reverse-proxy séparé
(voir la section Caddy plus bas pour l'historique). `.github/workflows/docker-publish.yml` build et
publie l'image sur GitHub Container Registry (`ghcr.io/nsapp44/nasap3d-api`) à chaque push sur
`master` qui touche `server/` ou le code Astro (`src/`, `public/`, `astro.config.mjs`). Le serveur
OVH n'a donc besoin que de Docker installé, pas de Node/npm/PrusaSlicer/Astro — il récupère l'image
déjà construite.

**Le conteneur fait tout seul au démarrage** (`server/docker-entrypoint.sh`, `ENTRYPOINT` de
l'image) : `prisma migrate deploy` puis `prisma/seed.ts`, avant de lancer l'API. Aucune commande à
lancer à la main sur le serveur, à chaque déploiement comme au tout premier. Les deux étapes sont
sans risque à rejouer à chaque redémarrage : `migrate deploy` n'applique que les migrations pas
encore appliquées, et le seed est basé sur des `upsert` qui ne touchent jamais les prix/réglages
déjà modifiés depuis l'admin (voir les commentaires de `prisma/seed.ts`) — il ne fait que garder le
catalogue (matières, couleurs, profils qualité, paliers de remise) synchronisé avec le code, et
recrée le compte admin/test seulement s'il n'existe pas déjà.

### Front-end (site Astro, servi par ce même conteneur)

`Dockerfile` a un stage dédié (`web-build`, Node 22 — voir le `engines` du `package.json` racine)
qui build le site Astro (`npm ci && npm run build`) et copie sa sortie statique dans `./public` de
l'image finale. `src/app.ts` enregistre `@fastify/static` sur ce dossier, en secours de toute
requête qui ne correspond à aucune route API — l'API garde toujours la priorité. Ce conteneur `api`
est donc la seule porte d'entrée publique désormais (plus de conteneur Caddy séparé, retiré lors de
la fusion — voir l'historique git de `Caddy.Dockerfile`/`Caddyfile` si besoin de contexte) ; le
reverse proxy déjà en place côté serveur OVH (gère le HTTPS) doit joindre `api:3000` sur le réseau
Docker `nasap3d_network`, jamais un port publié publiquement — voir la restriction à `127.0.0.1`
sur le port `3000` dans `docker-compose.yml`.

### PostgreSQL

Pas de base à provisionner séparément : `docker-compose.yml` inclut déjà un service `db`
(`postgres:16-alpine`) qui tourne comme conteneur, avec un volume Docker (`nasap3d_db_data`) pour
que les données survivent aux redémarrages/redéploiements. Les identifiants par défaut :

|                                  | Valeur                                                                |
| -------------------------------- | --------------------------------------------------------------------- |
| Utilisateur                      | `nasap3d`                                                             |
| Base                             | `nasap3d`                                                             |
| Hôte (depuis le conteneur `api`) | `db` (nom du service dans le réseau Docker interne, pas une vraie IP) |
| Port                             | `5432`                                                                |
| Mot de passe                     | voir ci-dessous                                                       |

**`DATABASE_URL` dans `server/.env` n'est pas utilisé par ce déploiement** — c'est
`docker-compose.yml` qui construit et impose la vraie valeur au conteneur `api`
(`postgresql://nasap3d:$POSTGRES_PASSWORD@db:5432/nasap3d`), écrasant tout ce qu'il y aurait dans
`server/.env`. La ligne `DATABASE_URL` de `server/.env.example` (`@localhost:5432`) ne sert qu'à
`npm run dev` en local, en dehors de Docker — inutile de la modifier pour la prod.

**Avant le tout premier `docker compose up`** (une fois par serveur, pas à chaque déploiement) :
créer un `.env` à la racine du dépôt (à côté de `docker-compose.yml` — différent de `server/.env`)
avec un vrai `POSTGRES_PASSWORD` — voir `.env.example` à la racine. Important : Postgres n'applique
ce mot de passe qu'à la toute première initialisation du volume `nasap3d_db_data` ; le changer après
coup dans `.env` ne change rien à la base déjà créée (il faudrait le changer en base directement,
ex. `ALTER USER nasap3d WITH PASSWORD '...'`, ou repartir d'un volume vide). Sans ce `.env`, le mot
de passe par défaut codé dans `docker-compose.yml` (public, visible dans ce dépôt) est utilisé —
acceptable en dev, jamais en production.

```bash
docker compose --profile full pull
docker compose --profile full up -d
```

(`--build` reste possible pour builder localement à la place — utile en dev, voir plus haut.)

Le paquet GHCR est **public** (choix fait pour ce projet — pas besoin d'authentification pour le
`pull` depuis le serveur OVH), mais reste à rendre public manuellement après son tout premier push
réussi : sur GitHub → onglet **Packages** du repo → `nasap3d-api` → _Package settings_ → _Change
visibility_ → _Public_ (comportement par défaut de GHCR : un paquet publié via `GITHUB_TOKEN` est
privé au premier push, quelle que soit la visibilité du repo).

Le PostgreSQL n'est pas managé par OVH dans ce schéma : c'est un conteneur (ou une instance
dédiée) que vous administrez vous-même — activer `sslmode=require` sur `DATABASE_URL` si l'API et
la base ne sont pas sur le même réseau privé.

### Sauvegardes

La sauvegarde de la base de production est gérée en dehors de ce dépôt (solution déjà en place côté
hébergement) — rien à planifier ici.

`scripts/backup-db.sh` (racine du dépôt) reste disponible pour une sauvegarde manuelle ponctuelle si
besoin : `pg_dump` compressé dans `backups/`, avec purge des fichiers de plus de 14 jours
(`RETENTION_DAYS` pour changer). Exécuté depuis l'hôte via `docker compose exec` :

```bash
./scripts/backup-db.sh
```

Ces fichiers restent sur le même disque que la base — une panne du serveur entier les perdrait
aussi. Ce script ne fait que le dump local, il ne remplace pas une vraie stratégie de sauvegarde
externalisée.

Pour restaurer :

```bash
gunzip -c backups/nasap3d-<horodatage>.sql.gz | docker compose exec -T db psql -U nasap3d -d nasap3d
```

Avant de passer en production, vérifier concrètement :

- `NODE_ENV=production` (active le fail-closed de la vérification anti-robot, entre autres).
- `STRIPE_SECRET_KEY` est bien une clé `sk_live_...` (et pas la clé de test utilisée en dev).
- `SMTP_*` est configuré — sans ça, les codes de vérification et notifications ne partent jamais
  réellement, seulement dans les logs.
- `BOXTAL_SHIPPER_*` (adresse **et** identité — un vrai achat d'étiquette a besoin d'un contact
  nommé, contrairement à la simple simulation de tarif) correspond à la vraie entreprise.
- `S3_*` est configuré — le repli sur disque local ne survit pas à un redéploiement de conteneur.
- **PrusaSlicer CLI dans l'image Docker** — testé et fonctionnel (voir la section ci-dessous).

### PrusaSlicer dans l'image Docker

Le client n'a jamais PrusaSlicer sur sa machine — le devis instantané tranche réellement le
fichier reçu **côté serveur**, jamais chez le client (voir `src/lib/slicer.ts`). `server/Dockerfile`
installe PrusaSlicer pour ça : PrusaSlicer n'a plus de build Linux officiel prêt à l'emploi depuis
la 2.8.1 (dépendance à WebKit qui a compliqué sa distribution — voir les notes de version et
prusa3d/PrusaSlicer#13653), donc le Dockerfile télécharge l'AppImage communautaire
[probonopd/PrusaSlicer.AppImage](https://github.com/probonopd/PrusaSlicer.AppImage) (entièrement
autonome, n'a besoin ni de libfuse ni des libs du système), l'extrait au moment du build
(`--appimage-extract`, pas besoin de FUSE au runtime), et l'expose via un petit script
`/usr/local/bin/prusa-slicer` qui l'enveloppe avec `xvfb-run`.

**Construit et testé pour de vrai le 2026-08-12** (`docker compose --profile full up -d --build`
puis un vrai `POST /quotes` avec plusieurs STL réels, plusieurs qualités/infill). Deux bugs
trouvés et corrigés à cette occasion :

- `xvfb-run` a besoin du paquet `xauth` (`xvfb-run: error: xauth command not found`) — ajouté à
  côté de `xvfb` dans l'`apt-get install`.
- `slicer-profiles/` (contient `h2c.ini`) n'était pas copié dans l'image finale (seuls `dist` et
  `prisma` l'étaient) — ajouté un `COPY --from=build /app/slicer-profiles ./slicer-profiles`.

Pour retester après une modification du Dockerfile ou une montée de version de l'AppImage :

```bash
docker compose --profile full up -d --build
curl -F "file=@test.stl" -F material=PLA -F colorId=... -F quality=Standard \
     -F infillPct=40 -F quantity=1 http://localhost:3000/quotes
```

Si `--info`/`--export-gcode` échouent avec une erreur liée à `$DISPLAY` ou à une librairie
manquante, regarder les logs du conteneur (`docker compose logs api`) — l'erreur précise dira quoi
ajuster. La version de l'AppImage (`2.9.1` dans le Dockerfile) peut aussi être à remonter —
vérifier les releases du dépôt communautaire ci-dessus.
