# SUIVI : état courant (08/11/2026, soir)

Historique complet avant ménage : `docs/chantiers/suivi-maquettes-08_avant-menage_2026-11-08.md`. Archives storyboard : `docs/chantiers/suivi-storyboard-v3_2026-11-04.md`.

## État global
`origin/master` = 9d69d2f (en ligne). Branche locale `claude/maquettage-b2b` (~97 commits), NON poussée. Push seulement sur le « oui » de Nolann ; avant : scan `claude-security` (fil principal), tests/build, Nolann coche les 4 événements webhook Stripe.
Règle modèle : Sonnet 90 % ; restructuration/maquette → Opus dans la même conversation, sans demander (mémoire `opus-sonnet-bascule-site`).

## Maquettes 08 (carrousel + /maquettiste-nantes) : où on en est
Fichiers : `docs/maquettes/carrousel-projets_2026-11-08.html` (source unique des blocs PJ:CSS/DATA/TPL/JS) et `page-maquettiste-nantes_2026-11-08.html`. Synchro : `outils-maquettes-08/sync_pj.py --write` puis sans option ; PJ:HTML à la main. Outils dans `docs/chantiers/notes-sessions_2026-11-08/local_5eab4690-e7a9-4711-827e-4e6ade9ac193/outils-maquettes-08/` (`cap.cjs`, `caps_serie.sh`, `seo_diff.py`). Serveur `python -m http.server 4380` (PID 46448). **Fichiers de 56 et 109 Ko : extraits seulement (cause des boucles de compaction).** Ne pas toucher `public/storyboard/cellule/preview-onde.html`, `src/`.

FAIT (commités en local) : bandeau chiffres 2×2 ; rideau pleine page (044d47a, à valider par Nolann) ; textes (délais, France / International, Réactivité) ; « 360° » → « 3D » ; **zoom = UNE seule visionneuse 3D par projet, rotation auto douce, pause pendant la manipulation, vignette statique (68682fd)** ; **section « Autres réalisations » retirée, carrousel « Nos maquettes » = 5 cartes, bouton « Toutes nos réalisations » sous le carrousel (3558066)**. Nolann : la maquette est très bonne, prochaine étape = coder la vraie page Astro + grosse optimisation.

## Prochain pas exact
1. Passation (hook boucle de compaction) : nouvelle conversation autonome avec ce SUIVI.
2. Coder la page Astro depuis la maquette 08 (Sonnet + `executant-ui`), puis optimisation (Lighthouse).

## À reporter au code Astro
- « PETG HF » → « PETG » partout (`prisma/seed.ts:64` ; label en base/menu admin : migration à prévoir, accord de Nolann avant push).
- SEO : pas d'opacity:0 sur le H1, polices locales, fetchpriority image hero, `[data-rv]` masqué seulement si JS, retirer « (MAQUETTE 08/11/2026) » du titre + canonical + JSON-LD, pages `/realisations/<slug>` + sitemap.
- Cholet/Angers : 301 → /impression-3d-nantes, retrait liens pied de page + sitemap (après contrôle clics Search Console ≈ 0). Chercher dans `src/` le lien `{{ nav.href }}` (404). Lien accueil → /impression-3d-nantes (titre accueil figé jusqu'au ~30/11).
- Caddy (compression, Cache-Control HTML, HSTS) = dev de Nolann. Rapport : `docs/chantiers/audit-seo-nouveaux-outils_2026-11-08.md`.

## Reste à montrer / trancher (Nolann)
Captures : « Lire la suite » Blocs courts, h2 « Quatre types… », flèches masquées aux extrémités, « machines SP » = machines spéciales, lien « Toutes nos réalisations ». Caravane : photo = rendu ChatGPT → retirer ou marquer illustration. Contraste bouton devis. Pager du zoom (5 cartes). Écrans courts : hero épinglé coupé (−27 px à 375×667). Jonction 2 du rideau optionnelle. 12 PNG de captures commités (Nolann décide). Passe responsive 375/768/1440/1920 + thème sombre Windows.
Idée écartée : SMS au client (payant, Nolann le fait à la main, 08/11).

## Conversations à supprimer
Fille SEO et fork SEO : SUPPRIMÉS le 08/11 (accord de Nolann). Rien d'autre en liste.

## Décisions de Nolann (en vigueur)
Une page par projet = GO (~300 mots, sans nom de client) ; « Un projet similaire ? » → `/contact` ; « Blocs courts » + « Animé au scroll » par défaut ; rideau A. Validé, ne pas toucher : zoom, « De l'idée à la maquette », bouton devis, « Un bureau d'études… », « Usage », « Ce qui nous distingue », « De la maquette à la petite série », carte « Maquette de design produit ». Guide Ads « Maquettage B2B » : `docs/ads_campagne_maquettage_2026-11-02.md` (publication après push et pages en 200).

## Ce qui n'a pas marché
Navigateur intégré peu fiable pour scroll/rAF → Chrome headless / `cap.cjs`. Lecture entière des maquettes → boucles de compaction (écriture déléguée à `executant-ui`). Bandeau 4 colonnes rognait « France » → 2×2. 404 console à 375 px dans le zoom, non identifié.
