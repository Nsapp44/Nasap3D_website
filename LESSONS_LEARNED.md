# Leçons apprises — à réutiliser sur de futurs projets

Ce document ne parle pas de Nasap3D en particulier : c'est une liste de leçons génériques,
apprises concrètement sur ce projet (bugs réels rencontrés, incidents de prod, choix
d'architecture qui ont payé ou non), à relire au démarrage d'un prochain projet Node/Astro/Docker
similaire. Chaque entrée dit **le problème réel rencontré**, **ce qu'on a appris**, et **ce qu'il
faut faire dès le départ la prochaine fois**.

## Génération de PDF côté serveur (`@react-pdf/renderer`)

**Problème réel** : `@react-pdf/renderer` a une fuite mémoire documentée dans son moteur de layout
Yoga (WASM) sur des rendus répétés dans le même process. Mesuré ici : 150 rendus séquentiels →
heap 33 Mo→61 Mo, RSS 143 Mo→254 Mo, **monotone même sous GC forcé**. Sur un serveur long-lived
(pas une fonction serverless qui redémarre), ça finit par faire tomber le process.

**Leçon** : toute lib de rendu PDF/image basée sur un moteur WASM persistant est suspecte de fuite
sur un process long-lived — vérifier explicitement avec un test de charge séquentiel (boucle de
100+ rendus, observer la RSS) avant de faire confiance à la lib en prod.

**À faire dès le départ** : isoler chaque rendu dans un sous-processus (`child_process.fork()`) qui
se termine après usage — la fuite ne peut alors jamais s'accumuler au-delà d'un seul rendu. Coût :
un peu de latence de spawn, largement acceptable pour une génération de PDF (pas un chemin
temps réel). Voir `src/lib/server/invoicePdfSubprocess.ts` + `invoicePdfWorker.mts` pour le pattern
complet (fork, timeout, limite de concurrence, cleanup).

## Limiter la concurrence sur un traitement lourd — jamais proportionnel au CPU

**Problème réel** : `MAX_CONCURRENT = Math.max(1, os.cpus().length - 1)` semblait raisonnable
("laisser du monde tourner en parallèle selon la machine") mais sur une machine à 12 cœurs, ça
autorisait ~11 sous-processus de génération PDF simultanés → contention CPU réelle → **10 sur 10**
généraient un timeout dans un burst de test. Un plafond fixe et volontairement bas (`= 2`) a réglé
le problème (10/10 réussite après coup).

**Leçon** : le nombre de CPU disponibles n'est pas le bon signal pour borner un traitement lourd
partagé (mémoire, PDF, tranchage, conversion) — le bon signal est le budget mémoire/CPU réellement
alloué au conteneur, qui n'a souvent aucun rapport avec `os.cpus().length` de l'hôte (surtout sur
un cloud provider où le conteneur est bridé par cgroups mais voit tous les cœurs de l'hôte).

**À faire dès le départ** : plafond fixe et petit, calibré empiriquement (voir section suivante),
pas une formule dérivée du hardware apparent.

## Tester sous contrainte mémoire réelle avant de faire confiance à une hypothèse

**Pattern utile** : `docker update --memory=Xm --memory-swap=Xm <container>` permet de reproduire
en local exactement le plafond RAM de la prod (ici testé à 512 Mo puis 1,5 Go), sans toucher au
`docker-compose.yml`. Combiné à des rafales de requêtes réelles (`Promise.all` / boucle curl) et
`docker stats`/`docker events` pour observer un vrai OOM, ça permet de **confirmer ou infirmer**
une hypothèse de bug au lieu de la deviner depuis le code seul.

**Leçon concrète ici** : l'hypothèse "RAM trop juste a fait échouer la génération de facture d'un
client" a été testée sous 512 Mo ET 1,5 Go avec un seul paiement forcé (le vrai scénario de
l'incident) — les deux fois, succès fiable (~134 Mo utilisés, marge confortable). L'hypothèse a été
infirmée par le test, pas confirmée par le raisonnement — et un vrai bug différent (la concurrence
CPU ci-dessus) a été trouvé en creusant le même chemin de code. Toujours reproduire le scénario
EXACT rapporté (ici : un seul ordre, pas dix) avant de conclure quoi que ce soit.

## Bulkhead pondéré par taille, pas juste par nombre de requêtes

**Contexte** : un endpoint d'upload (fichier STL de devis) peut recevoir plusieurs gros fichiers en
parallèle de visiteurs différents — un simple rate-limit par IP (protège contre UN spammeur) ne
protège pas contre PLUSIEURS visiteurs légitimes qui uploadent un gros fichier au même moment.

**Leçon** : sur un traitement dont le coût mémoire dépend de la taille de l'input, un compteur
"max N requêtes simultanées" est mal calibré (N gros fichiers ensemble peuvent OOM, N petits
fichiers ensemble ne coûtent rien) — il faut pondérer par une estimation de coût réel (ici :
`Content-Length` × un multiplicateur mesuré empiriquement sur le vrai pic mémoire du chemin de
code, avec un plancher pour les petits fichiers) et une capacité totale, pas un simple nombre de
slots. Voir `src/lib/server/concurrencyGuard.ts` (`WeightedGate`) pour le pattern.

**Point d'implémentation important** : placer la porte D'ENTRÉE **avant** de lire le corps de la
requête (`request.formData()`), pas après — tant que rien n'a lu le stream, une requête qui attend
son tour ne coûte presque rien (juste une connexion tenue), alors qu'attendre après la lecture du
body a déjà le fichier entier en mémoire pour rien.

## `.env` en prod : éditer le fichier ne suffit pas

**Problème réel** : un `STRIPE_WEBHOOK_SECRET` mis à jour dans `.env` sur le serveur n'a eu aucun
effet jusqu'à un `docker compose restart api` — le conteneur avait chargé l'ancienne valeur au
démarrage et ne relit pas le fichier en continu.

**Leçon** : sur ce genre de stack (Node qui lit `process.env` une fois au boot, pas de reload à
chaud des variables d'env), **toute modification de `.env` en prod doit être suivie d'un restart
du conteneur concerné** — à documenter explicitement dans le README/runbook de déploiement pour
éviter de perdre du temps à déboguer "la valeur ne prend pas" alors que c'est juste un redémarrage
manquant.

## Secret de webhook Stripe : vérifier qu'il correspond au bon endpoint, pas juste "un" secret

**Problème réel rencontré, en deux temps** : d'abord `webhook_not_configured` (secret absent) →
une fois renseigné, `invalid_signature` (secret présent mais ne correspond pas à la signature réelle
de l'endpoint qui reçoit les events). Stripe génère un secret **par endpoint webhook configuré**
(et un jeu séparé test/live) — copier "le" secret webhook depuis le mauvais endpoint, ou depuis le
mode test au lieu du mode live, donne exactement cette erreur, avec un message qui ne dit pas
lequel des deux problèmes c'est.

**Leçon** : quand un webhook Stripe échoue en 400, distinguer explicitement les deux causes
(secret absent vs secret présent-mais-faux) avant de chercher plus loin, et toujours vérifier
que le secret copié vient bien de l'endpoint dont l'URL de destination correspond exactement à
la route réelle (`https://.../api/webhooks/...`), en mode live si la clé API est `sk_live_...`.

## CSRF derrière un reverse proxy — ne pas désactiver la protection native sans un remplaçant équivalent

**Contexte trouvé dans ce projet** : la protection CSRF native d'Astro (`security.checkOrigin`)
était désactivée dans `astro.config.mjs`, car elle calcule le protocole depuis le socket brut (pas
`X-Forwarded-Proto`) — cassée derrière un reverse proxy qui termine le HTTPS. Mais un vérificateur
équivalent, proxy-aware, avait bien été réécrit à la main dans le middleware (lit
`X-Forwarded-Proto`/`X-Forwarded-Host`) — donc pas une faille réelle, juste un remplacement
maison correctement fait.

**Leçon** : derrière un reverse proxy, toujours vérifier si une protection framework "désactivée"
dans la config a un équivalent réécrit ailleurs avant de conclure à une faille — mais aussi :
**documenter ce remplacement en commentaire à l'endroit de la désactivation**, sinon un futur audit
(ou un futur dev) perd du temps à croire que la protection est absente.

## Vérifier la version réellement déployée sans deviner

**Pattern utile** : un endpoint `GET /api/health` qui renvoie `{ ok, version: process.env.GIT_SHA }`
(avec `GIT_SHA` injecté au build Docker depuis le commit réel) permet de confirmer à 100% que la
prod tourne bien le dernier commit poussé, en une requête — au lieu de deviner depuis "j'ai bien
poussé" ou les dates de déploiement.

## Convention UI à ne pas casser sans le vouloir : deux loaders, deux usages différents

**Contexte** : ce projet a deux composants de chargement avec des sémantiques distinctes —
un spinner générique (attentes courtes/génériques : upload de fichier, appel API) et une icône
animée à thème "impression" (réservée aux moments d'analyse/tranchage réels). Les mélanger casse
une convention implicite que l'utilisateur final associe à "il y a vraiment une pièce en cours
d'analyse" — à ne pas réutiliser pour une simple attente réseau, même courte.

**Leçon générale** : quand un projet a plusieurs composants de loading visuellement différents,
vérifier leur usage réel dans le reste du code avant d'en réutiliser un pour un nouveau cas —
il y a probablement une intention sémantique derrière, pas juste une préférence esthétique.

## Méthodologie d'audit sécurité qui a bien fonctionné ici

Combiner systématiquement :
- **Revue statique ciblée** : grep pour les patterns dangereux connus (`$queryRaw`/`$executeRaw`
  bruts, `dangerouslySetInnerHTML`/`set:html`, `eval`/`new Function`), puis vérifier explicitement
  que chaque route avec un `:id` dans son chemin fait un contrôle de propriété (pas juste
  d'authentification), et que chaque route admin est bien derrière `requireAdmin`.
- **Test dynamique réel, pas seulement lu le code** : ouvrir la vraie page, modifier le DOM/les
  valeurs cachées depuis la console du navigateur, rejouer une requête avec un payload modifié,
  et lancer une vraie boucle `while true` / rafale `curl`/`Promise.all` contre le conteneur qui
  tourne réellement — un rate-limiter ou un contrôle serveur qui a l'air correct en lecture peut
  quand même avoir un trou qu'un vrai test révèle (ou, à l'inverse, confirmer qu'il n'y en a pas,
  ce qui a de la valeur aussi).

**Leçon** : ne jamais conclure un audit sur la seule lecture du code — reproduire réellement les
attaques basiques (tampering HTML/console, spam/rafale) contre l'instance qui tourne, avec le
même niveau d'effort qu'un attaquant non sophistiqué visé par l'audit ("va pas sur le trop
difficile, teste aussi les basiques").

## Ne jamais garder de vrais secrets de prod dans une conversation/un historique

**Incident réel** : des vraies clés API de prod (Boxtal) ont été collées en clair dans le chat pour
un test de connectivité. Utilisées uniquement dans un script jetable local supprimé immédiatement
après, jamais committé — mais la bonne pratique reste de les régénérer depuis le dashboard du
fournisseur dès que le test est terminé, puisqu'elles ont existé en clair dans un historique de
conversation.

**Leçon** : dès qu'un secret de prod transite en clair dans un canal qui n'est pas censé les
stocker durablement (chat, ticket, log), le traiter comme potentiellement compromis et le
régénérer — même si l'usage immédiat était légitime et de courte durée.

## `docker compose pull` ne déploie pas `docker-compose.yml`

**Problème réel** : plusieurs semaines de correctifs d'infra (service d'alerte, `statement_timeout`
Postgres, limite du pool Prisma) ont été poussés, "déployés"... et n'ont jamais tourné en prod. Le
serveur faisait bien `docker compose pull && up -d` (nouvelles images, donc nouveau code), mais son
`docker-compose.yml` local n'avait jamais été mis à jour. Découvert seulement parce qu'un email
d'alerte attendu n'est jamais arrivé.

**Leçon** : une image et un fichier compose sont deux choses à déployer séparément. Prévoir dans la
procédure de déploiement une étape explicite pour le fichier compose (`git pull` sur le serveur), et
un moyen simple de vérifier que la config attendue tourne vraiment (`docker compose ps` qui liste
les services attendus, un endpoint qui renvoie la version déployée).

## Rendre une panne capable de se diagnostiquer elle-même

**Problème réel** : une panne récurrente ("toutes les requêtes base de données échouent
instantanément, un redémarrage du conteneur répare tout") n'a jamais pu être diagnostiquée : la
seule preuve (`docker logs`) disparaissait à chaque redémarrage, fait en urgence avant que
quiconque ait regardé. Des heures de tests locaux ont pu éliminer des hypothèses, pas trouver la
cause.

**Leçon** : pour un bug qu'on ne sait pas reproduire, investir d'abord dans la capture de preuve
plutôt que dans de nouvelles hypothèses. Concrètement : un endpoint de santé qui renvoie la
**classe et le code** de l'erreur (jamais le message — il peut contenir des hôtes/du SQL), un
journal d'incident écrit sur un volume persistant (survit aux redémarrages et recréations), et le
test qui tranche entre "le client est bloqué" et "la base est en panne" : une connexion neuve
fonctionne-t-elle pendant que celle de l'app échoue ?

**À faire dès le départ** : sur tout service long-lived, `init: true` dans compose (sinon Node en
PID 1 ne nettoie jamais les processus orphelins) et une rotation des logs Docker (`json-file`
n'en fait aucune par défaut).
