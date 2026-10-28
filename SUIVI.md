# SUIVI : état courant (27/10/2026, nuit)

Archives : `docs/SUIVI_archive_2026-10-25.md`, `docs/SUIVI_archive_2026-10-27.md` (détail des items 1-30, commits, outils de capture, prix d'exemple).

## Expédition multi-colis (27/10, branche claude/cartons-hors-gabarit-77729e, part en prod AVANT SEO national et Shop V14)
**Récap VALIDÉ par Nolann (27/10, « tout est parfait, fonce »)** : plafond 25 kg par colis (plus petit max MR/locker ; Colissimo 30) ; S/M/L = Relais + locker + Colissimo ; XL (62×42×33) = Relais oui, locker non (64×41×38) ; XXL (80×40×40, L+l+h 160 > 150) = Colissimo seul ; plusieurs colis = prix total + « Votre commande partira en N colis », pas de détail ; pièce trop grande = Expédition grisée, retrait atelier possible ; chaque message finit par « contactez-nous » (lien /contact), ton calme.
**Maquette VALIDÉE par Nolann (27/10, « OK, code-la »)** : https://claude.ai/artifact/AXALyNdqYHRz5TxENhyWKM (6 cas + textes + aide admin). Choix proposés : note calme (fond #201d1b, pas de rouge) dans le panneau Livraison ; une seule note combinée si plusieurs cas ; message « pièce trop grande » déplacé du récap vers le panneau Livraison ; « Livraison (N colis) » dans le récap ; lockers masqués dans le widget Boxtal si possible.
**CODÉ (non commité)** : packing.ts (25 kg, XL relais, `lockerOk` S/M/L, **garde géométrique** : les grosses pièces (> 1/8 du carton) doivent tenir en une rangée, sinon colis suivant ; règle prudente, peut prendre un colis de plus qu'un humain malin : à signaler à Nolann) ; `GET /api/cart` (tooBigPiece, parcelCount, relayOk, lockerOk) ; CartPage (notes cas 2-6, « Livraison (N colis) ») ; ShippingTab ; SHIPPING.md. Avant : achat bac à sable 2 colis OK, carte admin multi-colis + stock, onglet Expédition, burger admin. **vitest 58/58, tsc 0** (build à relancer après le merge). Plan : `~/.claude/plans/lucky-tickling-patterson.md`.
**Captures faites (desktop 1024)** : XL → Relais 8,57 € / Colissimo 14,57 € + note « Locker impossible » en mode Relais ; XXL → Colissimo seul 22,81 € + note. Nolann (27/10) : « prix cohérents, j'aime beaucoup ».
**Panier de test** : script `testcart.mjs` copié dans `.claude/testcart.mjs` du worktree (hors git, ne pas commiter) : `node .claude/testcart.mjs <big|xl|xxl|multi|multixxl|small|clean>`. Compte `test-expedition@nasap3d.test`, cookie `n3d_session=n3dtestsessionrawtoken0123456789` posé en JS sur 127.0.0.1. Dev : `astro dev --config astro.dev.tmp.mjs --port 4329` (serveur preview existant), `http://127.0.0.1:4329/panier` → « Passer la commande pour expertise » → Expédition → adresse fictive (10 rue de Rivoli 75001 Paris) → « Calculer les frais » (remplir par JS : setter natif `HTMLInputElement.value` + event input). ⚠ `multi` tombait en 1 XXL avant la garde : refaire, attendu 2 colis.
**Coordination** : SEO national (`local_ff4fce01…`) : nous poussons EN PREMIER, SEO rebase ensuite. Master a avancé (bb1989b) : intégrer master avant push. Shop V14 : pas de chevauchement.
**Pourquoi (oral)** : pas de mailto (mail déjà en haut de la carte) ; jamais d'appel `api/v1/order` en production (local = bac à sable `test.envoimoinscher.com`, vérifié) ; le client « comprend qu'il y a plusieurs colis », pas besoin de détail.
**Ce qui n'a pas marché** : WebFetch 403 sur karton.eu ; volume seul = rangement optimiste avec XL/XXL (corrigé par la garde) ; carte des relais indisponible en local (widget Boxtal, déjà avant).
**File (27/10)** : 1. [x] code + tests ; 2. [~] captures : `multi` vérifié (API : 2 colis, relais oui, locker NON car chaque pièce 380×330×280 + marge passe en XL ; l'ancienne attente « locker true » était fausse) ; reste captures multi/multixxl/big + 375/768 + ShippingTab admin ; 3. [x] lockers : le widget Boxtal v0.0.9 n'envoie que `networks[]` à son API (aucun filtre de type, vérifié dans le bundle maps.boxtal.com) → impossible de les masquer sur la carte ; `BoxtalRelayMap` reçoit `hideLockers={!lockerOk}` et REFUSE un point sélectionné qui ressemble à un locker (regex nom/type, NON testable en local : pas de token carte) + message. À dire à Nolann ; alternative : demander à Boxtal un filtre ; 4. [ ] nettoyage `testcart clean` + reste `test/trop-grand.stl` en base (l'annoncer) ; 5. [ ] intégrer master, vitest/tsc/build (vitest 58/58 et tsc 0 après l'item 3) ; 6. [ ] résumé + captures à Nolann → son oui → commit (sans `astro.dev.tmp.mjs`, `.claude/launch.json`, `.claude/testcart.mjs`) → push master ; 8. [x] poids déclaré (Nolann 27/10, règle finale) : par colis = (pièces + carton vide) × 1,1, arrondi au gramme (jamais au 0,5 kg), plancher 300 g (minimum Colissimo/MR, « je crois » de Nolann : à vérifier), MÊME poids pour limite 25 kg, devis et étiquette (`countedWeightG` dans packing.ts ; `parcelParams` plancher 0,3 kg). Cartons vides karton.eu : S 50 g, M 130, L 380, XL 950, XXL 1140. vitest 61/61, tsc 0 ; 7. [ ] prévenir SEO + Shop V14 ; supprimer `astro.dev.tmp.mjs`, arrêter le dev.
**PLAN DE RECETTE (Nolann 27/10, soir) — rien en prod avant son feu vert** : une seule branche propre `claude/cartons-hors-gabarit-77729e` (commit local `ef09045`, rien poussé ; master n'a pas bougé). Le site doit tourner EN LOCAL sur Docker avec ces mises à jour ; « ça tourne beaucoup » sur ce site : à chaque modif prouver que RIEN de l'existant n'est cassé. a) build + tsc + vitest (testeur) ; b) tests unitaires sur tout le nouveau code (packing, boxtal parcelParams, cart, orders, étiquette) ; c) parcours client complet (panier, expédition relais/Colissimo, checkout, EXPERTISE → AWAITING_PAYMENT → paiement test Stripe) ; d) TOUT le menu admin onglet par onglet (commandes, expédition/ShippingTab, etc.) à 375/768/desktop ; e) Docker compose up --build sur la branche ; f) Nolann teste ; g) son oui → push master (SEO rebase après). Reste Sonnet (pas de maquette validée de l'onglet Expédition : écart signalé).
**RECETTE — état au 28/10** : FAIT : vitest 63/63 (dont 2 tests téléphone) ; admin 4 onglets sans débordement ni erreur à 375/768/desktop ; parcours client complet en local (panier → tarifs → checkout → accepter → session de paiement → webhook Stripe simulé) ; **étiquette multi-colis OK dans le sandbox Boxtal** (2 colis ; réf 2610280008POFR562OFR). **Trouvaille** : le sandbox refuse le téléphone destinataire au format local (0612…) : `boxtal.ts` ne convertissait que le téléphone expéditeur. Corrigé (`toInternationalFrPhone` exportée, appliquée au destinataire) = risque aussi présent sur master/prod ; à dire à Nolann. Réponse envoyée à la session Shop (changements admin).
**Fait 28/10 (suite)** : scénarios panier cohérents (small 1 colis relais+locker ; xl relais 8,57 € / Colissimo 14,57 € ; xxl Colissimo 22,81 € ; big → 409 order_too_big ; multi 2 colis ; multixxl 2×17754 g Colissimo 70,90 €) ; refuser (409 si déjà refusée) / accepter / payer (session Stripe test) OK ; stock ± et droits admin OK ; image Docker construite, api relancée sur 127.0.0.1:3000 (migration 20261027205626 déjà appliquée, 24 migrations) ; admin et commandes sans débordement 375/768/1440. Tests unitaires cart non écrits (dépendent de la base : couverts par les scénarios API).
**Prochain pas exact** : (1) Nolann teste (Docker :3000 ou dev :4329) ; (2) son oui → commit (code + SUIVI, PAS astro.dev.tmp.mjs ni .claude/*), intégrer master, push, prévenir SEO `local_ff4fce01-ceb3-426c-8053-8a0b312a19f6` + Shop ; (3) nettoyer en annonçant avant : `astro.dev.tmp.mjs`, dev server, `testcart clean`, commandes test N3D-1001/1002/1003, ligne devis `test/trop-grand.stl`.

## Fait (poussé sur master)
- Échelle du projet stockée/affichée partout (`bb1989b`).
- Point « expertise humaine avant paiement » terminé (`addf8b3` + libellés panier) : `ExpertiseSteps.astro`,
  FAQ, meta, CGU art. 3, pages ville, devis PDF ; panier : « Passer la commande pour expertise »,
  « Se connecter pour commander », « Envoyer pour expertise ». E-mails et compte déjà conformes.
- Plausible goals, Search Console `/devis-instantane` : OK selon Nolann. Ads : marchent bien.

## CHANTIER : SEO national + conversion /devis-instantane
- Branche de travail : `claude/vigilant-curran-6ea965` (worktree `nasap3d-pipeline-test-cedca2`). Elle contient `claude/seo-conversion-suite-fe4650` jusqu'à b18c3d9.
- **Commits LOCAUX autorisés (oui du 26/10). JAMAIS de push sans son oui** : un push sur master redéploie le site.
- Coordination avec le shop : `Nasap3D website/SEO-COMMUN.md`, section « Session SEO site » seulement.
- Mode conseillé : **Sonnet medium** pour exécuter le plan.

### Décisions en vigueur
- **France d'abord, Nantes ensuite. PAS d'international** (Nolann, 27/10 : « national je voulais dire que France »). **Ne pas perdre Nantes** : une commande de 1 300 € vient de Nantes, et « le site rassure et donne envie, c'est bien ce qu'on fait ». **Jamais « livraison gratuite ».**
- Accueil :
  - h1 « Impression 3D en France » (on le garde) ;
  - une seule page ville ciblée (Nantes) ; Angers et Cholet inchangées (règle Google « doorway ») ;
  - « Atelier à Nantes » reste dans le title et la meta ;
  - `areaServed` du JSON-LD inchangé.
- En-tête :
  - identique à avant, avec « Guides » en plus ;
  - menu burger à 1060 px et moins ;
  - `.nav-links` gap `clamp(16px, calc((100vw - 920px) / 8), 26px)` (Header.astro ~172, HomeHeader.tsx ~239).
- Pied de page :
  - « Livraison partout en France » + liens devis / réalisations / services ;
  - **on GARDE les liens Nantes, Cholet et Angers** (ce sont les seuls liens vers /impression-3d-nantes présents sur toutes les pages).
- Rétro-conception : pas de page.
- Canclaux :
  - retiré seulement du texte à côté de « Contact », en bas de l'accueil : déjà fait (43c9aa8) ;
  - **on le laisse partout ailleurs**, y compris dans la bulle de la carte, car « l'adresse complète c'est important ».
- Textes :
  - phrase A : « Aucun paiement à la commande. Expertise et validation de votre pièce en amont. » ;
  - jamais « humain » ni « sans IA » ; rien d'inventé ;
  - prix via `getPublicPricing()` ; site TTC.
- Interdits :
  - configurateur inchangé ; Ads non coupées ;
  - ne pas toucher les fichiers du shop (cgu, maquette-impression-3d, OrdersTab/OrderCard/Dashboard, api/orders/[id], lib/server/orders, middleware, session) ni reparer-piece-3d.astro.
- og:image : real-17.
- **Plan :** `docs/plan_seo_national_2026-10-27.md` (§1-9, décisions intégrées). Rien n'est appliqué au code avant son oui.
- Recherche international / Nantes, archivée : `docs/international_seo_2026-10-27.md`.

### File des demandes (ouvertes)
31. [x] Plan SEO national : exécuté en local (oui de Nolann 27/10), 4 commits locaux. **Reste : son test local puis son oui pour le push.**
32. [x] « Guides » qui touchait le logo : corrigé et vérifié (au moins 49 px d'écart de 1061 à 1440 px, 1280 et 1440 identiques à avant). **À montrer à Nolann.**
33. [x] Bloc « Un projet singulier ou original ? » (accueil) : capturé à 375/768/1024/1280/1440, propre. Plausible ne suit pas `/maquette-impression-3d` (à décider). **À montrer à Nolann.**
34. [x] Nantes + « international » : c'était un malentendu, il voulait dire national. Garde-fous Nantes inscrits dans le plan §9.
4/8/19. [~] Tunnel STL → panier + Plausible (migration locale faite).
7/20. [ ] Pages villes. 9. Bing. 9b. Hors site : `docs/plan_3dnatives_frenchtech_2026-10-27.md`. 11-16 : machines, Ads maquettage (`docs/ads_maquettage_2026-10-27.md`, aucune dépense sans OK).
Shop (non urgent) : questions de SEO-COMMUN.md ; prix d'exemple 14,10 € vs 23,75 € écrit en dur ; « humain » dans maquette L19/L39 et cgu L21.
10. Fin : Nolann teste en local, push sur son oui.

### État technique
- Aperçu local : `npx astro build`, puis la config `.claude/launch.json` « nasap-seo-4457 » (`node server-entry.mjs`, PORT 4457) → http://localhost:4457.
- **L'ancien serveur 4455 tourne encore** (PID 6788, dist de l'ancien worktree). L'arrêt a été refusé par le mode auto ; Nolann peut le fermer.
- Captures avant (live) / après (local) : `C:\Users\Nolann\AppData\Roaming\Claude\side-session-notes\local_d5887c7c-3fd7-4561-8901-2eaabdcc644f\captures-2026-10-27` (`entete__*`, `bloc__*`, `mesures.json`).
- Script de capture CDP : `caps/header.mjs` dans le scratchpad de l'ancienne session. La copie d'origine est dans `local_fd5f6327…\outils-captures\header.mjs`.

### Ce qui n'a pas marché et pourquoi
- `astro check` : manque de mémoire (exit 134).
- Dev local : l'hydratation casse via la jonction (403 `@fs`), donc on sert le dist construit.
- Docker Desktop : sockets périmés → renommer `%LOCALAPPDATA%\Docker\run` et `docker-secrets-engine` en `.stale-*`.
- Captures : attendre au moins 2 s (animations d'entrée) ; le menu Guides ouvert correspond à un survol.
- Titles de la note du 27/10 trop longs une fois comptés : version raccourcie, voir le plan §2.
- Boucle de compaction le 27/10 au soir : passation vers une nouvelle conversation.

### Prochain pas exact
1. **Plan §8 exécuté en local (27/10 nuit), 4 commits locaux, rien poussé** : titres/meta + `@id` guides ; h2 de /devis-instantane (computed style identique) ; pied de page « Livraison partout en France » + devis/réalisations/services (liens Nantes/Cholet/Angers gardés) ; aria-label des 8 images machines. Contrôles : titles 63/59 car., meta accueil 154, JSON-LD valide, `areaServed` inchangé, pas de scroll horizontal à 375/768/1280.
2. Aperçu : `.claude/launch.json` « nasap-seo-4457 » (port 4457, non commité). L'ancien serveur 4456 (PID 37516) et 4455 (PID 6788) tournent encore : Nolann peut les fermer.
3. Nolann teste http://localhost:4457 ; **push seulement sur son oui** (redéploie le site). Ensuite : hors site (§7).
