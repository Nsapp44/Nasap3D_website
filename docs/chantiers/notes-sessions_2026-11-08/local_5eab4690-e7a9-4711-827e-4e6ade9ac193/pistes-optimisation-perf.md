# Pistes d'optimisation perf (à faire APRÈS validation du design)

Source : audit SEO 05/11 (`docs/chantiers/seo-audit_2026-11-05.md` §2, §5, §10), Lighthouse sur build prod local, mobile 4G simulée. Rien ici n'a été modifié dans le code. Gains chiffrés = mesurés ; le reste = inférence à re-mesurer.

Point de départ : /maquettiste-nantes mobile Perf 79, LCP 4,26 s, FCP ~3,3 s, 809 Ko / 42 req, CLS ~0, TBT 0 (desktop 98, LCP 0,95 s). Accueil mobile Perf 69, LCP 6,85 s, 1,82 Mo, CLS desktop 0,061. Cible : LCP < 2,5 s mobile partout, texte + 1re image visibles en ~0,5-1 s.

## Classées par gain (le plus gros d'abord)

1. **Compression gzip/zstd (+ brotli si possible) et cache longue durée côté Caddy.** Node ne compresse rien : 313 Kio économisables sur /maquettiste-nantes (client.js 127, HTML 67, GSAP 70). Caddy : `encode zstd gzip` ; `Cache-Control: public, max-age=31536000, immutable` sur `/_astro/*`, `/storyboard/cellule/*` (frames versionnées), polices ; HTML en `no-cache`. Fichier : Caddyfile, HORS dépôt (dev de Nolann). À vérifier d'abord sur la vraie prod (`curl -I -H "Accept-Encoding: br,gzip"`), peut-être déjà actif. Gain : très gros, gratuit.
2. **Polices : supprimer Google Fonts bloquant.** 809 ms bloquants mesurés. Auto-héberger Space Grotesk + Inter (woff2, sous-ensemble latin), `font-display: swap`, preload d'UNE police (celle du H1), `size-adjust` sur la police de secours (évite le CLS). Fichier : `src/layouts/BaseLayout.astro:68-72` (+ `public/fonts/`). Gain ≈ 0,8 s de FCP/LCP.
3. **CSS : inliner / fusionner les feuilles bloquantes.** 604 ms (CSS de page) + 454 ms (`MaquetteCarousel.css`) + 304 ms (BaseLayout.css) mesurés. `build.inlineStylesheets: 'always'` dans `astro.config.mjs` (ou 'auto' + vérifier), charger `MaquetteCarousel.css` seulement là où le carrousel existe, CSS non critique de l'animation après le 1er affichage. Gain ≈ 0,5-0,9 s.
4. **LCP = H1 animé depuis `opacity:0`.** Chrome ignore l'élément à opacité 0 : le LCP attend la fin du fondu (~0,5 s) + polices. Enlever l'animation d'opacité du H1 (ou ne l'animer qu'en `transform`), idem `.hero-subtitle` de l'accueil (LCP 6,85 s). Fichiers : `src/pages/maquettiste-nantes.astro:439`, `maquette-industrielle.astro`, `index.astro`. Gain ≈ 0,5 s et débloque les points 2-3. NB : design = animation d'entrée `translateY(6px)` 0,5 s de la charte ; garder le translateY, retirer le fondu depuis 0 (ou partir de opacity .01 : à tester, Chrome peut aussi l'ignorer).
5. **Hero statique + poster : le storyboard n'est pas dans le chemin critique.** HTML = H1 + texte + `<img>` poster (frame 0) `fetchpriority="high"`, jamais `loading="lazy"`, dimensions width/height. Animation en îlot `client:idle`, GSAP + ScrollTrigger via `import()` dynamique après le 1er affichage (aujourd'hui GSAP 70 Ko en `defer`). Fichiers : `src/components/StoryboardCellule.astro`, `public/storyboard/cellule/cellule.js`. Gain : TBT/INP déjà 0, donc surtout FCP/LCP et sécurité à long terme.
6. **Frames du storyboard : chargement progressif et formats légers.** Frame 0 immédiatement, puis 1 sur 8, puis les trous ; frame voisine si la demandée n'est pas encore là ; WebP/AVIF (vérifier la conversion actuelle) ; jeu portrait dédié mobile (1,2 Mo mobile / 2,1 Mo desktop après parcours complet aujourd'hui). Fichiers : `public/storyboard/cellule/*`, `cellule.js`. Ne touche pas au LCP mais au poids total et au confort de scroll.
7. **Accueil : alléger (1,82 Mo, 55 req).** Pire page du site. Inventorier les images (formats modernes, `srcset`/`sizes`, tailles réelles, lazy sous la ligne de flottaison), CLS 0,061 desktop (image/bloc sans dimensions ou police ; à localiser avec le panneau Performance), LCP = `.hero-subtitle`. Fichiers : `src/pages/index.astro` et ses composants.
8. **Navigation instantanée.** `prefetch` Astro (survol/viewport) pour les liens internes ; Speculation Rules en option (attention : un prérendu exécute le JS de la page cible, donc Plausible et animations). `ClientRouter` seulement si on accepte de réinitialiser GSAP entre pages (moyen effort, à éviter au début). Fichier : `astro.config.mjs`, `BaseLayout.astro`.
9. **Petits restes** : `preconnect` inutile une fois les polices locales ; JS React `client.js` 127 Ko (îlots `client:load` → `client:idle`/`client:visible` quand rien n'est au-dessus de la ligne de flottaison) ; supprimer les `Cache` doublons ; vérifier que `/m/s.js` (Plausible proxy) est `defer` et mis en cache.

## Hors perf mais à cocher dans la même passe
- `og:image:alt` codé en dur faux (`BaseLayout.astro:63`) ; contrastes (CTA « Demander un devis » peu lisible sur mobile) ; images du storyboard indexables (`<img alt>`, pas `display:none`).

## Méthode de la passe d'optimisation
1. Mesure AVANT sur la vraie prod (PageSpeed Insights + Lighthouse local en build prod, jamais en `astro dev` : Perf 56 / LCP 19 s, trompeur).
2. Faire dans l'ordre : 1 (Caddy, via le dev), 4, 2, 3, 5, puis 6-9. Chaque étape = re-mesure ; garder le tableau avant/après.
3. Après chaque étape visuelle : captures avant/après (le design ne doit pas bouger : seulement le chargement) + test reduced-motion + 375/768/desktop, aucun scroll horizontal.
4. Mesure terrain après déploiement : CrUX / Search Console « Signaux Web essentiels » (14-28 jours de retard).
5. Ne rien pousser sans l'accord de Nolann ; ne pas casser SEO (titres, meta, JSON-LD, URLs) ni les ads.

## Pas encore vérifié
Config réelle de Caddy (compression, cache, www→non-www), INP terrain, vrai poids des frames par format, cause exacte du CLS 0,061 de l'accueil.
