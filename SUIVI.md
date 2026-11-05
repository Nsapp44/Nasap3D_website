# SUIVI : état courant (05/11/2026)

Archives : `docs/chantiers/suivi-storyboard-v3_2026-11-04.md` (demandes 1-6, détails v3, liste à supprimer) ; rendus v3 → `docs/chantiers/storyboard-v3-rendus_2026-11-04.md` ; v2 → `docs/chantiers/storyboard-v2-publie_2026-11-04.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Branche locale `claude/maquettage-b2b` (~73 commits), NON poussée : /maquettiste-nantes + /maquette-industrielle, maintenance fusionnée, storyboard cellule en hero. Push seulement sur le « oui » de Nolann ; avant : scan `claude-security` (fil principal), tests/build (testeur), Nolann coche les 4 événements webhook Stripe.
Storyboard : `src/components/StoryboardCellule.astro`, JS `public/storyboard/cellule/cellule.js` (GSAP 3.12.5 auto-hébergé), séquences webp 960 px q85. Détails : archives.

## Fait, à valider par Nolann
- **Item 7 Boxtal (807e8ed)** : `extractTrackingNumber` défensif dans `boxtal.ts`. Locker 20 kg / 62×38×36. Relais : limites 30 kg documentées, plafond code encore 25 kg. **Non vérifié** : le vrai nom du champ « N° Expédition » → appel lecture seule `order_status/<ref>/informations` sur la dernière commande Mondial Relay, puis ajouter la clé exacte à `TRACKING_KEY_RE`.
- **Item 8 éclaté (d2b0d07)** : `ecl` s'arrête à la frame 17. Vérifier 375 (`caps_v10/c_375x812_0.260.png`).
- **Item 9 clic bouton (1312b44)** : Nolann a choisi l'« onde de choc » (piste 2 ; son « 3 » interprété ainsi, à confirmer). Intégré : disque lumineux + 2 anneaux qui partent du bouton, légende « Un bouton, et elle s'éclaire. » prend l'accent au passage. Captures vérifiées 1440 et 375 (`scratchpad/caps_onde/`). Écarts connus : trait des anneaux qui s'épaissit avec l'échelle (CSS border ; trait fin constant = anneaux SVG inline, à décider), à 375 la légende est sous l'image donc l'onde ne l'atteint pas (couleur seulement), reduced-motion et bandeau LED à 0.84 non capturés.
- **Item 6/10 audit SEO (a96a938, 730e741)** : verdict « bonne voie, 5 corrections », rapport `docs/chantiers/seo-audit_2026-11-05.md`, Artifact https://claude.ai/artifact/V7XHWp3zgbuW4jrrWb7zun. Corrections : LCP mobile /maquettiste-nantes 4,26 s (H1 démarre à opacity 0, polices/CSS bloquants) ; accueil mobile 6,85 s / 1,82 Mo ; compression à vérifier côté Caddy (hors dépôt) ; `og:image:alt` faux partout (`BaseLayout.astro:63`) ; carrousel = vraies pages `/realisations/<slug>`. Hors périmètre à traiter : CTA « devis sur mesure » quasi invisible mobile, contraste insuffisant, 19 cartes /realisations non liées, `lastmod` sitemap périmé, plan SEO 27/10 marque « proposé » un titre déjà appliqué.

## En attente de Nolann (un seul pop-up)
H1 SEO au-dessus du storyboard ; cartes « Et encore plus » retirées ; torsades el28 / sens de levée aimants / texte « Électronique intégrée » / lumière T4 ; écart orange/verte au repos 1,1 mm ; timing ESP ; hélices anisotropes ; relais 25 → 30 kg ; trait des anneaux (CSS vs SVG) ; confirmer « 3 » = onde de choc ; appliquer les 5 corrections SEO ?

## File
1. [ ] Bandeau LED plus souple (4 tronçons faits, à confirmer sur captures sinon refaire `--stage=elec`, Opus).
5. [ ] Carrousel de projets : état des lieux puis maquette en session Opus ultracode ; clic = projet agrandi au premier plan, croix = retour ; l'audit recommande de vraies pages `/realisations/<slug>` (à trancher avec Nolann).
11. [ ] Corrections SEO (voir audit) après son accord.

## Ce qui n'a pas marché
- Console dev worktree : 403 Vite `@fs` + hydratation React = connu, hors sujet.
- Navigateur intégré peu fiable pour scroll/capture → Chrome headless (testeur).
- Testeur Haiku a dit « hélices non groupées » sur l'éclaté ; vérifié à l'œil : correct.

## Prochain pas exact
1. Pop-up de questions à Nolann (liste ci-dessus).
2. Boxtal : vérifier le champ réel (item 7).
3. Advisor avant « fini » ; republier Artifact 9az7LYrVJrfeLZzEiMFQsU (le LIRE d'abord) avec page_v3 ; scan claude-security ; push sur « oui ».
4. Ménage : http.server 4371 (PID 26140), dev 4350 (PID 22244) ; pop-up unique de suppression des conversations (local_75c60f2f « fini, supprimable », local_ae7e1921, local_117c8401, local_e79981e6, sous-sessions finies) ; log conso dans `C:/bo-test/docs/conso_sessions.md`.
