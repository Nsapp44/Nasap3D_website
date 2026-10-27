# SUIVI : état courant (27/10/2026)

Archives (maquettes 3D, Protection 3D, shop, passation 25/10) : `docs/SUIVI_archive_2026-10-25.md`.

## CHANTIER : SEO national + conversion /devis-instantane
Branche `claude/seo-conversion-de1652` (worktree `nasap3d-social-media-folders-171abf`), partie de master 614f30d. Brief : `reseaux-sociaux/docs/brief_opus_seo_site.md` (dépôt principal). Coordination shop : `Nasap3D website/SEO-COMMUN.md` (hors dépôt, n'éditer que la section « Session SEO site »).
Règles : **commits LOCAUX autorisés sur cette branche (oui de Nolann 26/10), JAMAIS de push sans son oui** ; URLs, JSON-LD, ads intacts. Fin = Docker local, tout vérifié, Nolann teste, push seulement quand on est sûrs.
Maquette validée (26/10) : https://claude.ai/artifact/P3GfWv2y1AFENNK3JTyvDF (source : scratchpad `maquette-seo.html`, ne pas modifier). Galerie côte à côte : https://claude.ai/artifact/EC6H2W9afGKFUNJCdTpqHD (source scratchpad `galerie/index.html`, republier le même fichier).
**Modèle : la suite se fait en Sonnet medium** (Nolann 27/10 : le code ne se fait pas en Opus).

### Décisions en vigueur
- Accueil variante B (h1 « Impression 3D à Nantes »), title Nantes inchangé ; /impression-3d-en-ligne = page nationale. 5,0 sur 54 avis.
- En-tête IDENTIQUE à avant, seul ajout « Guides » (menu déroulant) avant Contact ; burger jusqu'à 1060 px (27/10). Tout autre écart d'en-tête = décision de Nolann.
- og:image = real-17 1200×630 ; la remplacer par sa grande maquette **seulement quand il confirme l'accord de son client**.
- **Devis : zone de dépôt, options et design du configurateur INCHANGÉS.** Ajouts seulement (cartes exemples, « Pas de fichier STL ? », erreur panier étape 4, Plausible, textes).
- **Phrase A** : « Aucun paiement à la commande. Expertise et validation de votre pièce en amont. » Jamais « humain » ni « sans IA ».
- Prix via `getPublicPricing()`, jamais en dur ; « remise dès 5 pièces » sans % ; jamais de €/kg. **Site en TTC** ; factures, PDF devis, panier GARDENT « TVA non applicable, art. 293 B du CGI ».
- Typo FR : `fr()` (`src/lib/typo.ts`) sur le HTML visible seulement, jamais JSON-LD/meta/title. `text-wrap` par page/composant, **pas de règle globale** (toucherait configurateur et reparer).
- Ne pas toucher : fichiers du shop (cgu, maquette-impression-3d, OrdersTab/OrderCard/Dashboard, api/orders/[id], lib/server/orders, middleware, session), reparer-piece-3d.astro, conteneurs `refontenasap3d-*` (sauf migration locale validée, item 19). Pas de « Boutique » ni d'URL shop au sitemap.

### File des demandes
1-6, 17, 21. [x] État des lieux, maquette, accueil, guides, menu/pied Guides, sitemap, og:image, 8,90 € alignés, écarts revus (commits plus bas).
4. [~] Devis — tunnel testé jusqu'à « analyse » ; panier bloqué par la base locale (item 19).
7/20. [ ] **Pages villes enrichies DANS ce chantier** : texte unique par ville, rien d'inventé ; Angers d'abord, capture à Nolann, puis les autres.
8. [~] Plausible : restent « prix affiché », « ajout panier », « erreur panier » (après item 19).
9. [ ] Bing (Webmaster Tools, IndexNow, Places).
10. [~] Fin : Docker complet, Nolann teste, push sur son oui.
11-16. [ ] Après ce chantier : machines/REAL_MAX/real-17 ; hors site ; réponses Ads ; SEO /maquette-impression-3d ; campagne Ads maquettes (aucune dépense sans OK) ; og:image → sa maquette sur confirmation.
18. [x] Burger ≤ 1060 px (global.css:316, Header.astro ~337, HomeHeader.tsx:268) — **non construit, non commité**.
19. [ ] Migration locale OK (27/10) : `npx prisma migrate deploy` sur `refontenasap3d-db-1` SEULEMENT (vérifier DATABASE_URL = localhost:5432/nasap3d), puis tunnel → panier + Plausible.
22. [~] **Contrôle visuel complet** (Nolann : « plein de trucs chelou », texte mal aligné). Corrections faites, **NON construites, NON vérifiées** :
   - E1 : burger, lignes Guides alignées sur les autres liens (Header.astro ~435, HomeHeader.tsx:286).
   - E2 : accueil (boutons héros en colonne ≤ 480, `.advice-banner` en colonne ≤ 640, `.about-text` centré ≤ 900, text-wrap, typo FR) + pied `white-space:nowrap` sur villes/guides.
   - E4 : `typo.ts` + `fr()` dans GuideFaq/Cta/Hero/Section/Table ; GuideTable : « Faites défiler le tableau → » + dégradé bord droit ≤ 640.
   - E5 (en cours à l'écriture) : typo + badges devis-instantane, services, ServicesGrid, particuliers, en-ligne, materiaux, prix.
   - lecteur (fini) : constats restants dans **`docs/controle_visuel_2026-10-27.md`** (composants du chantier à corriger ; pied de page, machines, réalisations = décision de Nolann).
   - Constat machines@375 : `@media (max-width:420px)` (index.astro, fin du `<style>`) force 1 colonne ; à vérifier en capture, ne rien changer sans raison.
23. [~] Capture ville avec menu ouvert : cause = survol souris de la capture précédente → corriger `capture.mjs`.
24. [~] **Exemple de prix** (Nolann : « fait peur », « ultra chère ») : cube PETG fin 0,12 mm 60 % = 103 g 5 h 49 = 31,76 € (vrai, temps machine 5 €/h domine) → **choix 27/10 : pièce typique chiffrée par le vrai moteur** (kiriSlicer + `computePrice`, seed : 5 €/h, plancher 8,90 €). Agent executant en cours (cube 50 mm et plaque 60×40×5 réglages par défaut, PLA/PETG). **Montrer le chiffre à Nolann AVANT de l'écrire.** Emplacements : QuoteWizard.tsx:194-195, particuliers :40 :57, en-ligne :40 :67, prix :39 :45 :98-99 (tableau + paragraphe).
25. [x] Retour envoyé à « Tests BO et jauge OpenAI » (27/10, confirmé par pop-up).
26. [ ] **Design existant, validé par pop-up 27/10** : (a) pied de page : TOUT centré (lignes 1-3) ; (b) page machines : photos même hauteur, « autres machines » mieux réparties, textes 9,5 px agrandis ; (c) bouton burger 44 px + lien actif réaligné (décalé 3 px). **Refusé : pied 12 px / contraste / gouttières** (ne pas faire).

### Questions à poser (pop-up)
Plus tard : slogan anglais, ancre « devis instantané impression 3D », PriceBadge Angers/Cholet, réalisations sans majuscule.

### État technique
- Commits locaux (rien de poussé) : 3fec742, 9e98e98, d43a030, 902fb2f, f3f3c83, 706a322, 1aeeb76, 192d86a.
- Aperçu = dist construit servi par `server-entry.mjs` port 4455 (`.claude/launch.json` « nasap-seo-build », non commité). Après chaque modif : `npx astro build` (arrière-plan) puis relancer l'aperçu.
- Scratchpad de cette session (S) : `C:\Users\Nolann\AppData\Local\Temp\claude\C--Users-Nolann-Desktop-Nasap3D-website-Code-html-Refonte-Nasap3D--claude-worktrees-nasap3d-social-media-folders-171abf\f6be8915-5525-4f3b-b5c9-efb355497a3f\scratchpad` (maquette, galerie, captures).
- Captures : `S\captures\capture.mjs` (Chrome headless port 9333, `--all` → `out-all/`), `captures/liens.mjs` (liens internes : 67/67 en 200). CDP suffit (Nolann OK 27/10) ; Playwright = proposition pour plus tard.
- Port 4400 = autre session (PID 5384) : ne pas toucher.

### Ce qui n'a pas marché et pourquoi
- `astro check` : manque de mémoire (exit 134) même à 8 Go → piste tsconfig include/exclude.
- Dev local : hydratation React cassée via jonction node_modules (403 `@fs`) → on sert le dist construit.
- POST /api/quotes 500 (P2022, colonne `scale`) : migration 20261022120000 absente de la base locale (item 19).
- Docker Desktop plantait : sockets périmés. **À chaque redémarrage** : fermer Docker, renommer `%LOCALAPPDATA%\Docker\run` et `%LOCALAPPDATA%\docker-secrets-engine` en `.stale-*`, relancer. Jamais « Reset to factory defaults ».
- Captures : animations d'entrée = faux trous (attendre ≥ 2 s) ; menu Guides resté ouvert = survol (souris au coin + blur + attente > 300 ms avant chaque capture).
- Règle text-wrap globale abandonnée (configurateur, reparer).

### Passation 27/10 (compactions en boucle → quota brûlé)
- **Non commité** (tout est à garder, rien n'est à moitié écrit sauf peut-être E5) : SUIVI.md ; Footer.astro, Header.astro, global.css, HomeHeader.tsx (burger 1060 + E1/E2) ; GuideCta/Faq/Hero/Section/Table.astro (E4) ; index.astro (E2) ; ServicesGrid.tsx, devis-instantane, services, impression-3d-particuliers, impression-3d-en-ligne, materiaux-impression-3d, prix-impression-3d (E5) ; nouveaux : `src/lib/typo.ts`, `docs/controle_visuel_2026-10-27.md`.
- **E5 FINI** (27/10 ~9 h 25, 7 fichiers, typo nbsp/U+202F, text-wrap devis + services, badges prix « 90 € », `.process-badge` nowrap ; JSON-LD/meta non touchés). Proposé non appliqué : `fr()` à l'affichage du FaqAccordion de devis-instantane (`faqs.map(f => ({q: fr(f.q), a: fr(f.a)}))`, sans toucher la chaîne du JSON-LD).
- **Agent « prix » FINI** (résultats `S\prix-exemple\result.json`, moteur Kiri:Moto client réel, valeurs du seed) :
  - Cube 50 mm, réglages par défaut du configurateur (PLA, Standard 0,20 mm, 40 %) : 86 g, 2 h 22, **13,72 €** (PETG : 14,10 €).
  - Cube PETG fin 0,12 mm 60 % : 26,72 € (et non 31,76 € : le temps de PRICING.md, 5 h 49, est 18 % au-dessus du moteur actuel).
  - Plaque 60×40×5 : prix plancher 8,90 € (pas un prix calculé).
  - Panier < 18 € : + 5 € de frais petite commande (`cart.ts:67-69`), donc un cube seul à 13,72 € revient à 18,72 €.
  - À vérifier avant d'écrire : le prix final vient-il du tranchage client (Kiri) ou serveur (`kiriSlicer.ts`, grid-apps Linux) ? S'ils diffèrent, l'exemple doit suivre celui qui facture.
  - Suivi mineur : gcode exporté avec `G1 XNaN YNaN` (`extOffset` absent de `kiriProfiles.ts`), sans effet sur poids, temps ou prix.
  - **CHOIX DE NOLANN (pop-up 27/10) : cube 50 mm PETG, Standard 0,20 mm, 40 %, 88 g, 2 h 22 = 14,10 €.** Seul au panier : 19,10 € (frais petite commande 5 € sous 18 €). Le texte ne doit pas cacher ces frais : proposer une formulation à Nolann (ex. « 14,10 € la pièce ; frais de 5 € sous 18 € de commande »).
  - Copie des résultats hors scratchpad : `docs/prix_exemple_2026-10-27.md` + dossier de notes partagé (`result.json`, `price.mjs`).
- Ancienne session = celle qui a lancé la nouvelle (`list_sessions {linked:true}`, champ `startedBy`) : **la supprimer seulement quand Nolann dit OK** (carte d'approbation). Ne rien supprimer ni archiver d'autre.
- **Attention avant de la supprimer** : supprimer une conversation peut supprimer son worktree (mémoire « Rien de non commité en worktree »). La nouvelle session travaille dans CE dossier : tout commiter localement d'abord, et vérifier quelle session possède le worktree. S'il appartient à l'ancienne, le dire à Nolann avant la carte.

### Prochain pas exact
1. Attendre la fin d'E5 et du prix (message de l'ancienne session ou fichiers stables), puis relire les diffs E1/E2/E4/E5 (`git diff`) ; appliquer les constats « composants du chantier » de `docs/controle_visuel_2026-10-27.md` (pas reparer), via `executant`.
2. Item 26 (a)(b)(c) via `executant`.
3. `npx astro build` en arrière-plan, relancer l'aperçu 4455 ; corriger `capture.mjs` (souris au coin, blur, attente > 300 ms) ; `testeur` : recaptures toutes pages × 375/768/1024/1280 (pages entières), sw == cw partout, reparer + configurateur identiques à avant.
4. Captures avant/après côte à côte + liste des écarts à Nolann, galerie republiée (page ville menus fermés). Commit local sur son oui.
5. Item 24 : chiffre CHOISI (14,10 €, PETG, voir plus haut). Vérifier d'abord que le prix facturé vient du même moteur (client Kiri ou serveur), puis remplacer 31,76 € et sa ligne de réglages aux emplacements : `QuoteWizard.tsx:194-195`, `impression-3d-particuliers.astro:40,57`, `impression-3d-en-ligne.astro:40,67`, `prix-impression-3d.astro:38-39,45,98-99`, `PRICING.md` L159-176. Montrer la formulation des frais avant de l'écrire. Ensuite item 19, villes (item 20), Bing, push sur son oui. `resize_window` preset desktop à la fin.
