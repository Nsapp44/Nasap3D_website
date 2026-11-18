# SUIVI : état courant (13/11/2026, passation vers la maintenance)

Archives : `docs/chantiers/suivi-maquettes-09_avant-menage_2026-11-09.md` (portage Astro, décisions), `suivi-maquettes-08_avant-menage_2026-11-08.md`. Version longue de ce SUIVI avant ménage du 13/11 : dans l'historique git (commit précédent de SUIVI.md).

## État global
- **14/11 : push `063c4cc..8321a6f` sur master** (fusion de la branche maquettage, 176 commits ; build OK ; 301 `/maquette-impression-3d` → `/maquettiste-nantes` dans astro.config). Prod vérifiée en `8321a6f` (pages maquette en 200). Guide Ads : `docs/ads_campagne_maquettage_2026-11-02.md` §0. Nolann crée la campagne Google Ads lui-même.
- **En ligne** : lot du 13/11 poussé sur master (`9d69d2f..063c4cc`, sans force) : centre d'erreurs admin, suivi Boxtal Mondial Relay, interrupteur de maintenance, Stripe async. Redéploiement + `prisma migrate deploy` (migration additive `20261113120000_add_maintenance_mode`) lancés côté prod.
- **Master LOCAL du dépôt principal diverge d'origin/master** (26 commits devant avant le push) : ne JAMAIS pousser le master local tel quel. Ne pousser que des commits cherry-pickés depuis `origin/master`, et seulement sur le « oui » de Nolann.
- Rapport de sécurité du lot gardé : `docs/securite-lot-2026-11-13/` (dépôt principal, commit local 5a23f22, non poussé) = scan claude-security (0 finding), securite-web (0 HIGH/CRITICAL), ~230 requêtes en direct (0 FAIL). À relire à la maintenance plutôt que tout refaire. Checklist des essais en direct : `~/.claude/docs/tests_securite_directs.md` (agent `testeur`).
- Maintenance : `Settings.maintenanceMode` (id=1), cache 10 s, page 503 (JSON 503 sur `/api/*`). Exemptés : `/maintenance`, `/compte`, `/admin`, `/api/health`, `/api/auth|admin|webhooks`, `/_astro`, `/assets`. Écart accepté : `GET /maintenance` direct = 200 (noindex). shop.* inchangé.
- Règle modèle : Sonnet 90 %. Ne pas commiter : `src/pages/shop.astro`, `planches-maquettes-08/`, `retours-n2_cartes-chiffres.png`, `public/storyboard/cellule/preview-onde.html`, `SUIVI.avant-ff-2026-10-28.md`, `reseaux-sociaux/*`.

## File des demandes (lot « retours Nolann + père »)
1. [x] Machines : Cricut → xTool C1 partout (en prod).
2. [x] Indicateur de scroll scène cellule (en prod).
3. [x] Cholet/Angers : on GARDE.
4. [ ] Perf téléphone des vues 3D (Lighthouse mobile 90-100 ; CLS mobile 0,146 `/` et 0,174 bioréacteur ; scène cellule ~139 FPS ; saccadé au scroll lent sur le téléphone de Nolann). Pistes : moins de frames/scrub mobile, images accueil (1,3 Mo), dimensions explicites des médias, JS scène (340 Ko).
5. [ ] Réindexation Google Search Console : à faire par Nolann. URLs : `/`, `/machines`, `/realisations`, `/maquettiste-nantes`, `/realisations/{systeme-filtration-purification,maquette-bioreacteur,maquette-cellule-biologique,maquette-caravane,maquettes-design-produit}` + sitemap.
6. [x] Loader vues 3D + « Réessayer » (en prod).
7. [x] « PETG HF » → « PETG » (devis, seed + migration `20261115120000_petg_label`), bouton « Voir en détail » sur les cartes cliquables des réalisations, tuiles machines pleines : EN PROD le 15/11 (`a3699af`).
8. [x] xTool Omni ajoutée sur `/machines` (6 tuiles 3×2) : EN PROD. Pas sur l'accueil (MachinesStrip l'a déjà).
9. [x] Colis Mondial Relay 75537808 pas passé en « livré » : filtre `DELIVERED_STATE_RE` élargi (retiré, delivered, LIV ; négations refusées) + log `[tracking] réf état Boxtal` à chaque vérification. EN PROD le 18/11 (`c79e2fe`). Libellé réel NON confirmé : si le colis ne passe pas au balayage (3 h) ou via « vérifier » admin, lire le log et ajouter le libellé.
10. [ ] Imprimante d'étiquettes 100×150 (18/11). **Bouton « Imprimer l'étiquette · REF » FAIT en local, non poussé** (`OrderCard.tsx` `printLabel` : iframe caché sur `…/download?inline=1` + `print()`, repli onglet ; `download.ts` accepte `?inline=1` ; `api-client.ts` `adminOrderLabelInlineUrl` ; tsc OK ; pas encore testé en navigateur ni avec une vraie imprimante ; impression auto = plus tard : `--kiosk-printing` / PrintNode 9 $/mois / QZ Tray). Budget de Nolann : ~60 €, 100-120 € max, Amazon ET AliExpress ; pilote non signé accepté, seul compte l'USB qui marche. Recherche 18/11 (prix NON confirmés, aucune preuve Windows 11 indépendante pour aucun modèle) : VEVOR 4x6 USB 77,90 € (vevor.fr, seul prix FR daté ; piège : Mondial Relay sorti en A4 chez certains) ; SVANTTO Y42 75,99 € Amazon.fr / 59,99 € .de (un avis : USB jamais reconnu) ; Munbyn ITPP941 ~120 € (guide FR 2025, prix Amazon.fr à confirmer, pilote officiel, marque la plus citée) ; Phomemo PM-246S ~84 $ ; Itari 49,99 € (3,4/5) ; Netum 79,99 € .it. Hors budget : Zebra, Brother, Rollo. À faire : Nolann choisit, garder le droit de retour, tester Mondial Relay + Colissimo dès réception (marges/recadrage).
Aucun push sans « oui ».

## Idée en attente : Dolibarr + facture électronique (recherche faite le 18/11, pas avant janvier-février 2027)
Nolann facture sur Abby, veut récupérer ses clients Abby puis passer à Dolibarr (Aptatio l'utilise déjà), garder nos PDF react-pdf, créer des factures depuis le portail.
Résultats `chercheur-web` (sources officielles lues) : 
- Abby : export CSV/Excel/PDF seulement dès l'offre Plus (15 €/mois HT, résiliable) ; API publique (docs.abby.fr, clé Bearer) aussi réservée à Plus. FEC indisponible. Aucun outil Abby vers Dolibarr existant.
- Dolibarr : import CSV des tiers OK ; factures historiques = point dur (numérotation, TVA, payé) ; API REST gratuite en auto-hébergé (DoliCloud Basic 14 €/mois : 2 000 appels/mois, pas d'offre à 9 € confirmée). PDF à rattacher nommé `REF.pdf`.
- Facture électronique : réception obligatoire depuis le 01/09/2026, émission 01/09/2027 (micro). Dolibarr n'est pas une plateforme agréée : module EInvoicing + PA (ex. SuperPDP, prix à confirmer). Abby est déjà PA, même en offre gratuite.
- Reco : tiers par CSV, anciens PDF Abby archivés (10 ans), pas de migration des factures ; si historique voulu : 1 mois Abby Plus + API + script vers l'API Dolibarr testé sur base vide ; Dolibarr en Docker OVH (version épinglée, dump + volume sauvegardés ensemble). Abby reste la solution la moins risquée tant que la PA Dolibarr n'est pas prête.
Reprendre : décision de Nolann (migrer ou non, session dédiée Sonnet medium).

## Mission : conversation de MAINTENANCE
Nolann enverra des retours pour « prendre le site en ligne » ; traiter chaque retour, un lot à la fois. Les « portails » (admin, Nasap, Nasap Shop) : probablement hors de ce chantier, à clarifier avec lui.

### À vérifier en prod (non vu)
- Migration `maintenanceMode` passée, interrupteur visible dans /admin.
- Vrai numéro Mondial Relay : emplacement dans `order_status` (le bac à sable renvoie un faux `CR…` dans `carrier_reference`) ; si alerte, lire le log « [boxtal] order_status sans n° » et ajouter la clé à `TRACKING_KEY_RE` (`src/lib/server/boxtal.ts`). États réels jusqu'à « livré », n° visible sur /compte. Colissimo concerné ? inconnu.
- 4 événements webhook Stripe : CONFIRMÉS par Nolann le 14/11 (completed, expired, async_payment_succeeded, async_payment_failed). Clé du `.env` = `sk_test_`, ne voit que le webhook test d'Éclat : rien à vérifier de plus.
- `/api/health` renvoie version "dev" en prod ? ; cookie de session HttpOnly/SameSite/Secure en live ; devis Boxtal domicile/relais ; captures responsive de l'admin, du centre d'erreurs et du loader (Nolann les voit lui-même) ; boucle d'emails (SMTP vide en test) ; XSS dans l'admin au navigateur ; build strict `npm ci`.
- INCIDENT NON RÉSOLU : migrate+seed lancés par erreur sur la base locale 5432 (dev, pas la prod) : le seed a pu réécrire matériaux/couleurs/profils/remises modifiés à la main. Comparer avec la dernière sauvegarde `backups/` (SHIPPING.md) : décision de Nolann.
- Hors sujet : erreurs `uv trampoline` des hooks du terminal.

## À reporter au code Astro
- « PETG HF » → « PETG » : EN PROD le 15/11 (`a3699af`, avec cue « Voir en détail » réalisations + tuiles machines pleines).
- SEO : `[data-rv]` masqué seulement si JS ; retirer « (MAQUETTE 08/11/2026) » si resté. Cholet/Angers : 301 → /impression-3d-nantes après contrôle Search Console. Lien `{{ nav.href }}` (404) à chercher.
- Reste Google Fonts : `shop.astro` (pas à nous), Leaflet unpkg, scripts Boxtal du panier bloquants. Caddy (compression, cache HTML, HSTS, 301) = dev de Nolann.

## Questions en attente (pop-up au retour de Nolann)
- LED sur purification/caravane (calques à produire) ? Pinch mobile / zoom clavier du zoom (optionnel). KPI hero « 2 sem. – 3 mois… » à raccourcir ? real-17 « Maquettes de design produit » (image non vue). 4 textes BROUILLON des fiches (caravane). Contraste bouton devis ; 12 PNG de captures commités.

## Décisions de Nolann (en vigueur)
Une page par projet = GO ; « Un projet similaire ? » → `/contact` ; rideau A ; carrousel « Nos maquettes » 5 cartes. Validé, ne pas toucher : zoom, « De l'idée à la maquette », bouton devis, « Un bureau d'études… », « Usage », « Ce qui nous distingue », « De la maquette à la petite série », carte « Maquette de design produit », rideau. LCP clos (on s'arrête). Slide 3D : chargement au slide avec loader = comportement actuel. Guide Ads : `docs/ads_campagne_maquettage_2026-11-02.md`. Ne pas couper les ads ni casser le SEO.

## Ce qui n'a pas marché
Navigateur intégré peu fiable pour scroll/rAF → Chrome headless + playwright-core. Lecture entière des maquettes (56 et 109 Ko) → boucles de compaction. Boxtal bac à sable : `order_status` = 404 juste après l'achat (cause de l'alerte TRACKING_UNREACHABLE) → fenêtre de grâce 30 min + essais à 2,5 s (déjà en ligne). Inline CSS `inlineStylesheets:'always'` rejeté (LCP pire). Zoom : carte = lien étiré dont le clic est intercepté par JS (voulu ; `locator.click` Playwright expire, pas un bug).

## Prochain pas exact
Attendre les retours de Nolann sur le site en ligne et les traiter ; dérouler le bloc « À vérifier en prod » quand il le demande. Aucun push sans son « oui ».
