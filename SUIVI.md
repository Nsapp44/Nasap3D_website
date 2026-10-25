# SUIVI : état courant (22/10/2026)

## Fait (poussé sur master)
- Échelle du projet stockée/affichée partout (`bb1989b`).
- Point « expertise humaine avant paiement » terminé (`addf8b3` + libellés panier) : `ExpertiseSteps.astro`,
  FAQ, meta, CGU art. 3, pages ville, devis PDF ; panier : « Passer la commande pour expertise »,
  « Se connecter pour commander », « Envoyer pour expertise ». E-mails et compte déjà conformes.
- Plausible goals, Search Console `/devis-instantane` : OK selon Nolann. Ads : marchent bien.

## File des demandes (25/10/2026)
Fait, NON commité (attente OK Nolann) : hub `/maquette-impression-3d` (SEO "Maquette …", FAQ, JSON-LD), `MaquetteCarousel.astro` (viewer three.js, éclairage studio + bloom, LED qui respirent, cellule GLB passe 4 : LED seulement dans les petits trous ronds), `MachinesStrip.astro`, images machines, liens services/footer/sitemap.
À faire :
1. [x] (fait) GLB passe 5 : les 2 hélices ADN de devant = jaune et cyan (celle de gauche) ; pièce du milieu = gris foncé bien net (ids à identifier ; 50/52 actuellement gris foncé mais paraissent noirs → éclaircir un peu).
2. [ ] Page hub COMPLÉTÉE : description du parc machines (une fiche par machine) + exemples d'application concrets pour que le visiteur se projette. **Maquette/design de cette section = Opus ultracode** (brief ci-dessous).
3. [ ] Carte « Maquette cellule » (hub) : photo derrière « Voir en 3D » moche en grand écran → mise en page responsive ; sélecteur points + flèches (3 maquettes), fond générique ; 375/768/desktop.
4. [~] Animation LED (agent en cours 25/10) : départ dôme central → monte vers les 4 branches, les LED restent allumées (remplissage), pause, puis extinction en ordre inverse, boucle ~8-10 s ; fixe si reduced-motion. Rang par LED = attribut de sommet COLOR_0 dans le GLB, uniform temps dans le viewer. À valider sur captures par Nolann (4 branches + dôme bien détectés ?). Hélices : FAIT (8 cyan, 14 jaune, 50/52 gris foncé #4a4e53).
5. [ ] Une page par maquette (viewer + texte côte à côte desktop / empilés mobile), cartes du hub y mènent, sitemap.
6. [ ] Autres maquettes au carrousel (sphère, extracteur ADN, caravane OBJ, +2) quand les fichiers arrivent.
7. [ ] Pages-niches (pédagogique, machine industrielle, design produit ; architecture si vraies réalisations), sans diluer le SEO.
8. [ ] Images machines sur l'accueil (sans toucher aux textes/SEO) ; droits des visuels constructeur.
9. [ ] Expliquer SEO du hub + anti-dilution ; `astro build` ; tests tactile/thème sombre ; OK avant tout commit.
11. [ ] PROTECTION des fichiers 3D (demande Nolann 25/10) : voir « Protection 3D » ci-dessous.
10. [ ] Refonte du site avec les skills de design.

### Protection 3D (item 11)
DÉCIDÉ (Nolann 25/10) : **images pré-calculées**, aucun fichier 3D en ligne. Rendu Cycles de haute qualité sur le PC de Nolann (Blender 5.0, `C:\Program Files\Blender Foundation\Blender 5.0`, source `Source machine/glb/cellule.blend`), tour 360° (≈72 vues) × quelques hauteurs (ex. 3), LED en chenille pré-calculées (cycle 5 s en quelques images par vue, ou calque LED séparé), export WebP léger (< ~4 Mo total, moins sur mobile). Le viewer devient un « tourne en glissant » (pointer events, inertie, zoom léger CSS). Les .glb/.blend/3MF ne sont jamais dans `public/` (retirer `public/assets/3d/cellule.glb` à la fin). Reste utile : en-têtes noindex sur les images, mention CGU. Veille 25/10 (10 recherches web) : libs MIT = `@mediamonks/fast-image-sequence` (canvas, préchargement, MP4 via WebCodecs), `js-cloudimage-360-view` (grille 2 axes, inertie), `three60`, `canvas-spinner` ; LED = calque additif séparé (CSS screen / canvas lighter) ; AVIF ~12-50 % plus léger que WebP (Safari ≥16.4), WebP en repli ; vidéo « scrub » exige toutes les images clés (-g 1). Reco : chargement progressif (36 vues d'abord, puis affinage), canvas, inertie. Le viewer three.js actuel (`MaquetteCarousel.astro`) sert de référence de rendu (même éclairage/ambiance), puis est remplacé.

### Brief Opus ultracode (item 2)
But : section « Notre parc machines » sur `/maquette-impression-3d`, remplaçant/complétant `MachinesStrip.astro` : par machine, photo, rôle, matériaux/volume, 2-3 exemples d'application concrets (pièce type, secteur), pour se projeter. Respecter design (fond #161514, accent #ff5a3c, cartes bordure rgba(255,255,255,.1), Space Grotesk/Inter), responsive 375/768/desktop, SEO « Maquette … » sans « impression 3D » en excès. Livrer : maquette validée par Nolann (captures) avant le code. Contenu machines : lire `MachinesStrip.astro` et `machines.astro`.

12. [~] Rendu pré-calculé (25/10) : exposition corrigée (AgX, key 2.0, rim 1.2). LED = TOUS les petits trous ronds (74 LED : boucle du noyau 33 + panneau 222 = 41), bouchons dans les trous, 0,2 mm en saillie (validé en gros plan). Spec animation Nolann : départ LED près de l'hélice jaune (id 14), suit la boucle du noyau, la ferme, puis explose dans les 5 branches ; ≤ 5 s ; LED allumées restent, extinction inverse ; LED occultées par la géométrie. Calques `--layer=base|rank|glow` écrits dans `render_tour.py`, NON testés. Défauts connus : boucle non continue (saut 131 mm), 4 branches détectées au lieu de 5, trous des panneaux 212/214/220 écartés (orientés vers l'arrière), 2 LED isolées. Agent en cours : corrige le rang (boucle continue + 5 branches) et rend `renders_test/rank`. Ancien rendu base (29 vues) à jeter.

13. [~] Retour Nolann 25/10 : chenille « parfaite » SAUF le départ : doit partir de la DERNIÈRE LED de la ligne la plus fournie près de la lettre « r » de « Helper » (hélice jaune), puis suivre la ligne en S, remonter vers « Gene of interest », redescendre à droite de « Capsid », puis explosion des 5 branches (déjà bon). Ensuite : refaire pareil pour TOUTES les maquettes. Étapes : corriger rang dans build_cellule.py → contrôle visuel → re-rendu rank+glow seulement → reconversion.

14. [x] Machines (25/10) : H2C en grand, 5 cartes 2 par 2, photo SLA Anycubic (`anycubic-sla.webp`, photo = Photon Mono M7), picto Peinture généré par GPT via codex (`peinture-finition.webp`, validé en capture desktop). Reste : captures 375/768, reduced-motion, thème sombre.
15. [x] Blender (25/10) : pastille 238 retirée, coque tuile 12 mm, PEI bump remis à 0,6 (0,85 faisait briller des étiquettes inégalement) ; rendu BASE 216 vues refait (fini 16:53), converti, `astro build` + preview 4325 refaits. Reste : validation Nolann (étiquettes uniformes ?).
17. [x] Galerie « Nos maquettes » : photos non rognées (ratio 4/5, contain), survol zoom comme les machines. À valider par Nolann.
18. [ ] Nolann vérifie lui-même tout le responsive A→Z ; il fournira les fichiers Blender des 2 autres maquettes (ce soir / demain).

19. [x] Menu : « Maquettes » ajouté après Services (Header.astro + HomeHeader.tsx), avant Devis instantané. Raccourci Shop : PAS maintenant (Nolann le fera plus tard, avec sous-partie). En attente : OK de Nolann pour commit + push master (mise en prod).
20. [x] LED qui scintillaient : corrigé (rang propagé depuis le voisin classé). Poids : le viewer ne charge seul que le tour à hauteur de départ (≈ 2,2 Mo desktop, avif) ; les 2 autres hauteurs (reste, ≈ 6,8 Mo au total) seulement au 1er survol/toucher ; mobile = images `sm`. Nolann a dit « On push » (25/10) : commit + merge master + push. POUSSÉ sur master le 25/10 (30d327f). 2e commit : 2 dernières maquettes : on ATTEND les OBJ propres + textures de Yanis (collègue de Nolann), puis rendu Blender (pipeline `Source machine/glb/`), conversion, ajout au carrousel.
16. [x] Loader viewer, zoom survol cartes machines, CTA sans bug (architecte), refonte MachinesStrip appliquée.

21. [x] (25/10) Passe SEO complète faite (agent `seo`, 15 URL du sitemap OK, rien de critique). Corrigé : balises og:*/twitter:* dans `BaseLayout.astro` (prop `ogImage`, défaut `/assets/logo.png`), « Nasap3D » unifié et provider JSON-LD de la page maquette rattaché au LocalBusiness (`@id` `#business` dans `index.astro`), `Disallow: /api/` dans robots.txt, carte « Maquettage » de l'accueil → `/maquette-impression-3d`. NON fait (décision Nolann) : « Maquettage » dans le title de /services (cannibalisation faible), FAQPage sur pages ville/services/machines, image og dédiée pour maquette et /reparer-piece-3d. Search Console / site en ligne : pas d'accès d'ici, à vérifier par Nolann.
22. [ ] SHOP (décidé 25/10) : site/sous-domaine quasi indépendant (autre domaine ou sous-domaine), NON lié à nasap3d.com sauf éventuel lien discret sortant ; pas de lien entrant fort pour ne pas diluer le SEO. Règle : un sujet par page, titre propre, pas de duplication. Architecture = nouvelle conversation Opus ultracode (brief ci-dessus + stratégie X-Tools C1 / Etsy).
   Précisions Nolann 25/10 : le lien « Shop » du menu ouvre un site SÉPARÉ (plus de navigation dans nasap3d.com) = marque « NASAP Shop » : logo à créer, ADN NASAP 3D reconnaissable (même thème de composants, mêmes typos Space Grotesk + Inter) MAIS palette plus claire/vivante, « marketing » (le dark actuel dessert la vente). Produits mis en avant : beaux objets sur mesure (mariage, mémorial de chien…) = travail de la conversation « note sur mesure remise à plat » ; infos produits à récupérer dans `NOTES-SUR-MESURE` / `REMISE-A-PLAT.md` (hors git) ou que Nolann redonnera une fois fini. Design = maquette Opus ultracode validée avant code.
   Lien depuis nasap3d.com (Nolann 25/10) : UN SEUL lien « Shop » (menu, éventuellement footer) vers le sous-domaine, en `rel="nofollow noopener"` (traité comme lien affilié/sortant : aucun poids SEO transmis), jamais dans le sitemap ni le JSON-LD de nasap3d.com ; but = que les visiteurs sachent que le shop existe, pas de référencement croisé (produits sans rapport).
   Commit + push : Nolann a dit OUI (25/10) pour la passe SEO/documents, une fois les corrections de l'audit faites.

## Prochain pas exact
Attendre les OBJ + textures de Yanis ; vérifier la page en ligne après le déploiement OVH ; puis pipeline des 2 maquettes (rendu base/rank/glow, `build-maquette-frames.mjs`, entrées du carrousel, pages par maquette).

## Ensuite
Stratégie X-Tools C1 (shop Etsy séparé sans diluer NASAP 3D, `machines.astro` Cricut→C1, mention discrète, SEO, TikTok auto).
Points ouverts : prix admin, retest STL, migration d'échelle après déploiement (à vérifier en prod).

## Ce qui n'a pas marché
Hydratation React cassée en dev via jonction `node_modules` (403 `@fs`) → `fs.strict=false` temporaire (jamais commité).
