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

**Une seule application Astro en SSR** (`output: 'server'`, adapter `@astrojs/node` en mode
`standalone`) — le front (pages, îlots React) et l'API (`src/pages/api/`) sont le même build, le
même process Node, la même origine. Il n'y a plus de backend séparé : ce que faisait auparavant un
second projet npm dans `server/` (Fastify) vit maintenant dans `src/lib/server/` (logique métier) et
`src/lib/api/` (la plomberie — auth, erreurs typées, limite de débit — que Fastify gérait via ses
plugins/hooks, reconstruite explicitement puisqu'Astro n'a pas d'équivalent).

```
├── src/
│   ├── pages/               Routage par fichier
│   │   └── api/              Routes API (auth, panier, devis, admin, checkout, webhook Stripe...)
│   ├── components/          Composants Astro + îlots React (devis, panier, compte, admin, accueil)
│   ├── hooks/                État/logique des îlots
│   ├── lib/
│   │   ├── server/            Logique métier (Prisma, session, devis/PrusaSlicer, Boxtal, Stripe,
│   │   │                      mailer, stockage S3...) — indépendante du framework, appelée par
│   │   │                      les routes API
│   │   ├── api/                Plomberie propre à Astro : wrapper d'erreurs (apiHandler),
│   │   │                      auth explicite (requireAuth/requireAdmin), cookies, limite de débit
│   │   └── api-client.ts       Client API du front (chemins /api/... relatifs, même origine)
│   └── middleware.ts         Cache-Control systématique sur /api/*, filet d'erreur, jobs de
│                              nettoyage périodiques (paniers abandonnés, devis expirés,
│                              commandes rejetées, suivi Boxtal)
├── prisma/                  Schéma + migrations PostgreSQL, seed (catalogue, comptes admin/test)
├── slicer-profiles/         Profils d'imprimante utilisés par PrusaSlicer (voir PRICING.md)
├── bootstrap/sanitizeEnv.mjs Nettoyage des guillemets parasites sur les variables d'env, exécuté
│                              avant tout le reste (voir server-entry.mjs)
├── server-entry.mjs         Point d'entrée Docker/production : dotenv → sanitizeEnv → démarre
│                              le build Astro SSR
├── public/                  Fichiers servis tels quels (assets, vendor JS non-bundlé, robots/sitemap)
├── astro.config.mjs
├── Dockerfile               Multi-stage : build Astro SSR + PrusaSlicer CLI, une seule image
├── docker-compose.yml       Toute la stack (db, api)
├── PRICING.md                Formule de calcul de prix (détaillée, avec exemples)
├── SHIPPING.md                Intégration Boxtal
└── HANDOFF_CLAUDE_CODE.md   Brief d'origine ayant cadré la construction du back-end
```

## Prérequis

- Node.js 22+
- Docker (pour PostgreSQL en local — ou un PostgreSQL 16 déjà installé)
- PrusaSlicer (CLI) installé quelque part sur la machine, pour que le devis instantané fonctionne
  réellement — voir `PRUSASLICER_BIN` plus bas. Sans lui, tout le reste du site fonctionne, seul
  `POST /api/quotes` échouera.

## Installation

```bash
npm install
cp .env.example .env
```

Puis remplissez `.env` — voir le tableau des variables ci-dessous. Les valeurs par défaut
correspondent au `docker-compose.yml` à la racine du projet.

## Variables d'environnement

| Catégorie                                     | Variables                                                              | Sans elles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Base de données                               | `DATABASE_URL`                                                         | Rien ne démarre — obligatoire. ⚠️ En déploiement Docker, la valeur de `.env` est **ignorée** (`docker-compose.yml` impose la sienne) — voir la section [PostgreSQL](#postgresql) plus bas.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Serveur                                       | `PORT`, `NODE_ENV`, `FRONT_URL`                                        | `FRONT_URL` sert à construire tous les liens absolus dans les emails (reset de mot de passe, lien de téléchargement de pièce jointe pour l'admin, redirections Stripe) — un seul et même domaine depuis que front et API sont fusionnés. ⚠️ `NODE_ENV` : la valeur de `.env` est **ignorée** en déploiement Docker (`docker-compose.yml` impose `production`) — voir la section [PostgreSQL](#postgresql) pour le même principe sur `DATABASE_URL`. Sans `NODE_ENV=production`, hCaptcha se désactive silencieusement au lieu de bloquer, et les cookies de session perdent le flag `Secure`. Pas de `CORS_ORIGIN` : front et API sont la même origine depuis le passage en Astro SSR. |
| Notifications                                 | `CONTACT_NOTIFY_EMAIL`, `ORDER_NOTIFY_EMAIL`                           | Les notifications (contact, nouvelle commande) ne sont juste pas envoyées.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Email (SMTP)                                  | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`, `SMTP_DEBUG` | Chaque email (codes de vérification, reset mot de passe, notifications) s'affiche dans les logs au lieu de partir réellement. Rien n'est bloqué. `SMTP_DEBUG=true` journalise l'échange SMTP complet, utile en diagnostic.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Auth                                          | `ARGON2_MEMORY_COST`, `ARGON2_TIME_COST`, `ARGON2_PARALLELISM`         | Valeurs par défaut OWASP raisonnables — à ne durcir que si le matériel de prod le permet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Anti-robot (hCaptcha)                         | `HCAPTCHA_SECRET_KEY`                                                  | Sans elle, la vérification anti-robot est **désactivée automatiquement en dev** (`NODE_ENV != production`) et **bloque tout en prod** — voir `src/lib/server/captcha.ts`. La clé publique ("site key") n'est **pas** ici : codée en dur dans `src/lib/api-client.ts`.                                                                                                                                                                                                                                                                                                                                                                         |
| Devis (PrusaSlicer)                           | `PRUSASLICER_BIN`                                                      | `POST /api/quotes` échoue avec `slicing_failed`. ⚠️ En déploiement Docker, la valeur de `.env` est **ignorée** (`docker-compose.yml` impose `/usr/bin/prusa-slicer` au service `api`).                                                                                                                                                                                                                                                                                                                                                                                                              |
| Livraison (Boxtal)                            | `BOXTAL_API_KEY_V1/_SECRET_V1`, `BOXTAL_SHIPPER_*`                     | `POST /api/shipping/rates` et `POST /api/checkout` échouent avec `shipping_not_configured`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| Livraison — widget carte (Boxtal)             | `BOXTAL_MAP_API_KEY`, `BOXTAL_MAP_API_SECRET`                          | Paire distincte des clés ci-dessus, pour un endpoint séparé : `GET /api/shipping/map-token` échoue aussi avec `shipping_not_configured` sans elles — le widget de sélection du point relais ne peut pas s'afficher. Voir `SHIPPING.md`.                                                                                                                                                                                                                                                                                                                                                                   |
| Paiement (Stripe)                             | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                           | `POST /api/checkout` échoue. Utilisez une clé `sk_test_...`, jamais `sk_live_...` en développement.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Stockage (S3)                                 | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Repli automatique sur le disque local (`./uploads/`) — pratique en dev, à configurer avant la mise en prod réelle.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Base de données

```bash
docker compose up -d db
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

```bash
npm run dev
```

Démarre Astro en local avec rechargement à chaud sur `http://localhost:3000` — front **et** API
(`/api/...`) servis par le même process, plus besoin d'un second serveur sur un autre port.

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

## Scripts utiles

| Commande                      | Effet                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `npm run dev`                  | Site + API en local avec rechargement à chaud                                              |
| `npm run build` / `npm start`  | Build de prod puis lancement                                                                |
| `npx prisma migrate dev`       | Crée une nouvelle migration à partir des changements du schéma (nécessite une DB locale)    |
| `npx prisma migrate deploy`    | Applique les migrations existantes (utilisé en CI/prod)                                     |
| `npx prisma studio`            | Explorateur de données graphique                                                            |
| `npm run seed`                 | Rejoue le seed (idempotent) — tourne aussi automatiquement au démarrage du conteneur Docker |

## Déploiement (OVH)

Une image pré-construite, publiée sur GitHub Container Registry à chaque push sur `master` qui la
concerne (`.github/workflows/docker-publish.yml`). Le serveur OVH n'a donc besoin que de Docker
installé — pas de Node/npm/PrusaSlicer, et pas besoin non plus que le dépôt soit cloné/à jour sur
l'hôte pour que le site soit servi, tout est déjà dans l'image :

```bash
cp .env.example .env   # remplir les variables de prod, voir le tableau plus haut
docker compose --profile full pull
docker compose --profile full up -d   # site + API sur :3000 (interne), PostgreSQL en conteneur
```

**Le conteneur fait tout seul au démarrage** (`docker-entrypoint.sh`, `ENTRYPOINT` de l'image) :
`prisma migrate deploy` puis `prisma/seed.ts`, avant de lancer le serveur. Aucune commande à lancer
à la main sur le serveur, à chaque déploiement comme au tout premier. Les deux étapes sont sans
risque à rejouer à chaque redémarrage : `migrate deploy` n'applique que les migrations pas encore
appliquées, et le seed est basé sur des `upsert` qui ne touchent jamais les prix/réglages déjà
modifiés depuis l'admin — il ne fait que garder le catalogue (matières, couleurs, profils qualité,
paliers de remise) synchronisé avec le code, et recrée le compte admin/test seulement s'il n'existe
pas déjà.

Le reverse proxy déjà en place côté serveur OVH (gère aussi le HTTPS) doit joindre le conteneur par
son nom Docker sur le réseau `nasap3d_network` : `api:3000` — pas de port publié publiquement.
**Point de coordination important à ce déploiement précis** : le site n'a plus qu'une seule origine
(front + API fusionnés) — si le reverse-proxy routait jusqu'ici un sous-domaine `api.` séparé vers
ce même conteneur, cette route n'est plus nécessaire ; seul le domaine principal doit continuer à
pointer vers `api:3000`.

Le paquet GHCR est **public** (pas d'authentification nécessaire pour le `pull` depuis OVH), mais
reste à rendre public manuellement après son tout premier push réussi (GitHub → *Packages* →
`nasap3d-api` → *Package settings* → *Change visibility* → *Public*).

Le PostgreSQL n'est pas managé par OVH dans ce schéma : c'est un conteneur (ou une instance
dédiée) que vous administrez vous-même — activer `sslmode=require` sur `DATABASE_URL` si l'API et
la base ne sont pas sur le même réseau privé.

### PostgreSQL

Pas de base à provisionner séparément : `docker-compose.yml` inclut déjà un service `db`
(`postgres:16-alpine`) qui tourne comme conteneur, avec un volume Docker (`nasap3d_db_data`) pour
que les données survivent aux redémarrages/redéploiements. Les identifiants par défaut :

|                                  | Valeur                                                                |
| -------------------------------- | --------------------------------------------------------------------- |
| Utilisateur                      | `nasap3d`                                                             |
| Base                              | `nasap3d`                                                             |
| Hôte (depuis le conteneur `api`) | `db` (nom du service dans le réseau Docker interne, pas une vraie IP) |
| Port                              | `5432`                                                                |
| Mot de passe                     | voir ci-dessous                                                       |

**`DATABASE_URL` dans `.env` n'est pas utilisé par ce déploiement** — c'est `docker-compose.yml`
qui construit et impose la vraie valeur au conteneur `api`
(`postgresql://nasap3d:$POSTGRES_PASSWORD@db:5432/nasap3d`), écrasant tout ce qu'il y aurait dans
`.env`. La ligne `DATABASE_URL` de `.env.example` (`@localhost:5432`) ne sert qu'à `npm run dev`
en local, en dehors de Docker — inutile de la modifier pour la prod.

**Avant le tout premier `docker compose up`** (une fois par serveur, pas à chaque déploiement) :
créer un `.env` à la racine du dépôt avec un vrai `POSTGRES_PASSWORD`. Important : Postgres
n'applique ce mot de passe qu'à la toute première initialisation du volume `nasap3d_db_data` ; le
changer après coup dans `.env` ne change rien à la base déjà créée (il faudrait le changer en base
directement, ex. `ALTER USER nasap3d WITH PASSWORD '...'`, ou repartir d'un volume vide). Sans ce
`.env`, le mot de passe par défaut codé dans `docker-compose.yml` (public, visible dans ce dépôt)
est utilisé — acceptable en dev, jamais en production.

```bash
docker compose --profile full pull
docker compose --profile full up -d
```

(`--build` reste possible pour builder localement à la place — utile en dev, voir plus haut.)

### Sauvegardes

La sauvegarde de la base de production est gérée en dehors de ce dépôt (solution déjà en place côté
hébergement) — rien à planifier ici.

`scripts/backup-db.sh` reste disponible pour une sauvegarde manuelle ponctuelle si besoin :
`pg_dump` compressé dans `backups/`, avec purge des fichiers de plus de 14 jours (`RETENTION_DAYS`
pour changer). Exécuté depuis l'hôte via `docker compose exec` :

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
fichier reçu **côté serveur**, jamais chez le client (voir `src/lib/server/slicer.ts`). Le
`Dockerfile` installe PrusaSlicer via le paquet Debian (`apt-get install prusa-slicer`, version
2.5.0 sur bookworm) — pas de build/téléchargement manuel, pas d'`xvfb` requis (contrairement à
l'AppImage communautaire utilisée avant : elle initialise tout le stack GL/EGL/GLX même en CLI
pur, confirmé via `LD_DEBUG=libs`, et s'est révélée nettement plus lente en conditions réelles).
`support_material_style=snug` (la seule option non-défaut utilisée par ce projet) existe bien dans
cette version — vérifié via `--help-fff` avant de basculer.

Si `--info`/`--export-gcode` échouent, regarder les logs du conteneur (`docker compose logs api`)
— l'erreur précise dira quoi ajuster.

## Documents associés

- [`PRICING.md`](PRICING.md) — formule de prix, avec exemples chiffrés.
- [`SHIPPING.md`](SHIPPING.md) — intégration Boxtal (tarifs + point relais).
- [`HANDOFF_CLAUDE_CODE.md`](HANDOFF_CLAUDE_CODE.md) — brief d'origine du projet.
