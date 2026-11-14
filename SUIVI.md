# SUIVI : état courant (13/11/2026, passation vers la maintenance)

Archives : `docs/chantiers/suivi-maquettes-09_avant-menage_2026-11-09.md` (portage Astro, décisions), `suivi-maquettes-08_avant-menage_2026-11-08.md`. Version longue de ce SUIVI avant ménage du 13/11 : dans l'historique git (commit précédent de SUIVI.md).

## État global
- **14/11 : push `063c4cc..8321a6f` sur master** (fusion de la branche maquettage, 176 commits ; build OK ; 301 `/maquette-impression-3d` → `/maquettiste-nantes` dans astro.config). Au dernier contrôle (~10 min après), la prod servait encore 063c4cc : attendre le redéploiement, puis `curl -I` sur `/maquettiste-nantes` et `/maquette-industrielle` (200 attendu) AVANT de publier la campagne Ads (guide `docs/ads_campagne_maquettage_2026-11-02.md` §0). Nolann crée la campagne Google Ads lui-même.
- **En ligne** : lot du 13/11 poussé sur master (`9d69d2f..063c4cc`, sans force) : centre d'erreurs admin, suivi Boxtal Mondial Relay, interrupteur de maintenance, Stripe async. Redéploiement + `prisma migrate deploy` (migration additive `20261113120000_add_maintenance_mode`) lancés côté prod.
- **Master LOCAL du dépôt principal diverge d'origin/master** (26 commits devant avant le push) : ne JAMAIS pousser le master local tel quel. Ne pousser que des commits cherry-pickés depuis `origin/master`, et seulement sur le « oui » de Nolann.
- Rapport de sécurité du lot gardé : `docs/securite-lot-2026-11-13/` (dépôt principal, commit local 5a23f22, non poussé) = scan claude-security (0 finding), securite-web (0 HIGH/CRITICAL), ~230 requêtes en direct (0 FAIL). À relire à la maintenance plutôt que tout refaire. Checklist des essais en direct : `~/.claude/docs/tests_securite_directs.md` (agent `testeur`).
- Maintenance : `Settings.maintenanceMode` (id=1), cache 10 s, page 503 (JSON 503 sur `/api/*`). Exemptés : `/maintenance`, `/compte`, `/admin`, `/api/health`, `/api/auth|admin|webhooks`, `/_astro`, `/assets`. Écart accepté : `GET /maintenance` direct = 200 (noindex). shop.* inchangé.
- Règle modèle : Sonnet 90 %. Ne pas commiter : `src/pages/shop.astro`, `planches-maquettes-08/`, `retours-n2_cartes-chiffres.png`, `public/storyboard/cellule/preview-onde.html`, `SUIVI.avant-ff-2026-10-28.md`, `reseaux-sociaux/*`.

## Mission : conversation de MAINTENANCE
Nolann enverra des retours pour « prendre le site en ligne » ; traiter chaque retour, un lot à la fois. Les « portails » (admin, Nasap, Nasap Shop) : probablement hors de ce chantier, à clarifier avec lui.

### À vérifier en prod (non vu)
- Migration `maintenanceMode` passée, interrupteur visible dans /admin.
- Vrai numéro Mondial Relay : emplacement dans `order_status` (le bac à sable renvoie un faux `CR…` dans `carrier_reference`) ; si alerte, lire le log « [boxtal] order_status sans n° » et ajouter la clé à `TRACKING_KEY_RE` (`src/lib/server/boxtal.ts`). États réels jusqu'à « livré », n° visible sur /compte. Colissimo concerné ? inconnu.
- 4 événements webhook Stripe cochés (checked, expired, async_succeeded, async_failed) : Nolann dit que le webhook marche déjà.
- `/api/health` renvoie version "dev" en prod ? ; cookie de session HttpOnly/SameSite/Secure en live ; devis Boxtal domicile/relais ; captures responsive de l'admin, du centre d'erreurs et du loader (Nolann les voit lui-même) ; boucle d'emails (SMTP vide en test) ; XSS dans l'admin au navigateur ; build strict `npm ci`.
- INCIDENT NON RÉSOLU : migrate+seed lancés par erreur sur la base locale 5432 (dev, pas la prod) : le seed a pu réécrire matériaux/couleurs/profils/remises modifiés à la main. Comparer avec la dernière sauvegarde `backups/` (SHIPPING.md) : décision de Nolann.
- Hors sujet : erreurs `uv trampoline` des hooks du terminal.

## À reporter au code Astro
- « PETG HF » → « PETG » (`prisma/seed.ts:64`, migration base : accord de Nolann avant push).
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

## Conversations à supprimer
- `local_e6e8af89-a204-4058-bdd3-3c7b10ef3ce2` (« [P] NASAP [page maquettiste Astro] vérif + zoom 3D (à supprimer) »), remplacée par la passation du 13/11.
