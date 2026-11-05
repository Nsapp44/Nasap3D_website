# SUIVI : état courant (05/11/2026)

Archives : `docs/chantiers/suivi-storyboard-v3_2026-11-04.md` (demandes 1-6, détails v3, liste à supprimer) ; rendus v3 → `docs/chantiers/storyboard-v3-rendus_2026-11-04.md` ; v2 → `docs/chantiers/storyboard-v2-publie_2026-11-04.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Branche locale `claude/maquettage-b2b` (~70 commits), NON poussée : /maquettiste-nantes + /maquette-industrielle, maintenance fusionnée, storyboard cellule en hero. Push seulement sur le « oui » de Nolann ; avant : scan `claude-security` (fil principal), tests/build (testeur), Nolann coche les 4 événements webhook Stripe.
Storyboard : `src/components/StoryboardCellule.astro`, JS `public/storyboard/cellule/cellule.js` (GSAP 3.12.5 auto-hébergé), séquences webp 960 px q85. Détails : archives.

## Fait, à valider par Nolann
- **Item 7 Boxtal (807e8ed)** : `extractTrackingNumber` défensif (clé `carrier_reference`/tracking…) dans `boxtal.ts`, rempli à l'achat d'étiquette et par `checkLabelStatus`. Locker corrigé 20 kg / 62×38×36 (code, SHIPPING.md, tests). Relais : limites 30 kg / 150 cm / 120 cm documentées, plafond code encore 25 kg. **Non vérifié** : le vrai nom du champ « N° Expédition » (pas de clés Boxtal v1 en local) → appel lecture seule `order_status/<ref>/informations` sur la dernière commande Mondial Relay, puis ajouter la clé exacte à `TRACKING_KEY_RE`.
- **Item 8 éclaté (d2b0d07)** : `ecl` s'arrête à la frame 17 (hélices compactes dans le dôme). Plateaux un peu moins écartés. Vérifier 375 (`caps_v10/c_375x812_0.260.png`).

## En attente de Nolann
- **Item 9 clic bouton** : 6 pistes publiées, https://claude.ai/artifact/FFDC3TuB7nwaJFxfhf3auR ; reco V5 (bouton → trait → LED en chaîne), alternative sobre V2. Source `scratchpad/clic_props/clic_props.html`. Ne PAS toucher `cellule.js` avant son choix.
- Pop-up de questions : H1 SEO au-dessus du storyboard ; cartes « Et encore plus » retirées ; torsades el28 / sens de levée aimants / texte « Électronique intégrée » / lumière T4 ; écart orange/verte au repos 1,1 mm ; timing ESP ; hélices anisotropes ; relais 25 → 30 kg ?

## File
1. [ ] Bandeau LED plus souple (4 tronçons faits, à confirmer sur captures sinon refaire `--stage=elec`, Opus).
5. [ ] Carrousel de projets : état des lieux puis maquette en session Opus ultracode ; clic = projet agrandi au premier plan, croix = retour, histoire longue, texte dans le HTML + #projet-x, à valider avec l'audit SEO.
6/10. [ ] Audit SEO : fork `local_75c60f2f` (en cours, mesures build prod), rapport attendu `docs/chantiers/seo-audit_2026-11-05.md` + Artifact ; vérifier puis relayer le verdict.

## Ce qui n'a pas marché
- Console dev worktree : 403 Vite `@fs` + hydratation React = connu, hors sujet.
- Navigateur intégré peu fiable pour scroll/capture → Chrome headless (testeur).
- Testeur Haiku a dit « hélices non groupées » sur l'éclaté ; vérifié à l'œil : correct.

## Prochain pas exact
1. Relayer le choix d'animation + pop-up de questions à Nolann ; intégrer la piste choisie.
2. Récupérer le rapport SEO du fork, relayer.
3. Boxtal : vérifier le champ réel (voir item 7).
4. Advisor avant « fini » ; republier Artifact 9az7LYrVJrfeLZzEiMFQsU (le LIRE d'abord) avec page_v3 ; scan claude-security ; push sur « oui ».
5. Ménage : http.server 4371 (PID 26140), dev 4350 (PID 22244) ; pop-up unique de suppression des conversations (local_75c60f2f, local_ae7e1921, local_117c8401, local_e79981e6, sous-sessions finies) ; log conso dans `C:/bo-test/docs/conso_sessions.md`.
