# Audit SEO + perf des maquettes 08 (08/11/2026, lecture seule)

Fichiers lus : `docs/maquettes/page-maquettiste-nantes_2026-11-08.html` (117 Ko, 2 229 mots), `carrousel-projets_2026-11-08.html`. Rien modifié. Gabarit page projet : `gabarit-seo_realisations-slug_2026-11-08.md` (copie à mettre dans ce dossier si besoin). Perf chiffrée = pas re-mesurée (maquette statique) ; mesurer sur build prod.

## Bon (à conserver au passage en code)
- 1 seul H1, 12 H2 dont plusieurs avec mots-clés (maquettes, atelier de maquettiste, Quatre types, FAQ) ; texte 2 229 mots (~2 070 avant) : dans la fourchette validée, ne pas rallonger.
- Cartes du carrousel : vrai `<a class="pj-link" href="/realisations/<slug>">` dans un `<h3>`, texte résumé dans le HTML, `img` avec alt, width/height : conforme au §6 de l'audit. Aucune `img` du DOM statique sans alt.
- Zoom : `pushState` avec `#projet-<slug>` en maquette, commentaire PROD pour passer à `/realisations/<slug>` (ligne ~1341) : bon.
- `prefers-reduced-motion` géré (`.hero-in{animation:none}`).

## À corriger en passant en code
1. **LCP** : `.hero-in` utilise `@keyframes up{from{opacity:0…}}` sur eyebrow et H1 (l.208-209, 539-540) : retirer le fondu depuis 0 sur le H1 (garder translateY 6 px), sinon LCP mobile retardé (~0,5 s).
2. **Polices** : Google Fonts bloquant (seule ressource externe). Auto-héberger Space Grotesk + Inter woff2 latin, `font-display:swap`, preload de la police du H1.
3. **Images** : 13 `loading="lazy"` à vérifier : aucune image du hero/1re vue ne doit l'être ; pas de `fetchpriority="high"` nulle part → le mettre sur l'image/poster du hero. Prévoir `srcset`/`sizes` (vignettes `/sm/` existent déjà).
4. **Contenu au scroll** : `.motion [data-rv]{opacity:0}` (l.206) = texte invisible tant que le JS ne l'a pas révélé ; OK si la classe `.motion` n'est posée que par JS (à vérifier au portage) ; sans JS tout doit rester visible. Les `display:none` sont limités à `summary` markers, `.card-go`, `.mcta` : pas de texte indexable masqué détecté.
5. **Vignettes dans les modales (JS)** : les `<img alt="">` créées en JS sont décoratives, acceptable ; mais les images du zoom/360° doivent exister aussi en HTML de la page projet.
6. **Absent de la maquette (normal, à ajouter au portage)** : canonical, JSON-LD (Service + FAQPage + BreadcrumbList déjà dans la page actuelle `maquettiste-nantes.astro` : les reprendre tels quels), og:image dédiée + `og:image:alt` corrigé. Titre/meta/H1 de la maquette : actuellement `(MAQUETTE 08/11/2026)` dans le titre → retirer ; vérifier que le titre de prod (≤ 60) et la description existants sont conservés.
7. **Carrousel** : 4 libellés/slug à valider avant la prod (réaliser les corrections signalées : filtration, objets liturgiques) ; pages `/realisations/<slug>` à créer selon le gabarit, + sitemap (+ `lastmod`).
8. Compression/cache Caddy et 301 www → non-www : hors dépôt (dev de Nolann), toujours à transmettre.

## Reste à faire
Mesure Lighthouse prod avant/après dès que le code Astro existe ; pages projet ; passe perf d'après `pistes-optimisation-perf.md` (copie dans `notes-sessions_2026-11-08/local_5eab4690…/`).

Cette session SEO : **supprimable** une fois ce rapport lu.
