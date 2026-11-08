# Plan de portage Astro : /maquettiste-nantes + carrousel projets + /realisations/<slug> (architecte, 08/11/2026)

Sources validées : `docs/maquettes/page-maquettiste-nantes_2026-11-08.html` (1336 lignes, 114 Ko : page complète, contient déjà les blocs PJ:* identiques) et `carrousel-projets_2026-11-08.html` (729 lignes, maquette autonome, source des PJ:*). `sync_pj.py` (sans option) dit CSS/DATA/TPL/JS identiques au 08/11 : **le port part de la page-08 seule**.
Règle dure : le rendu doit être celui de la maquette (dimensions, textes, ordre, états). Tout écart = ligne dans « Décisions à Nolann » (§11), jamais un choix d'executant.
Outils (`seo_diff.py`, `cap.cjs`, `caps_serie.sh`, `sync_pj.py`) : `docs/chantiers/notes-sessions_2026-11-08/local_5eab4690-e7a9-4711-827e-4e6ade9ac193/outils-maquettes-08/`.
Interdit aux agents : lire les maquettes entières. Repères de lignes ci-dessous ; Read offset/limit ≤ 150.

## 0. Décisions d'architecture (tranchées)
| # | Décision | Pourquoi | Réversible |
|---|---|---|---|
| D1 | **Aucun nouvel îlot React** sur cette page. Carrousel + zoom + visionneuse 3D = `<script>` Astro (JS vanilla de PJ:JS, réécrit seulement pour les chemins). Rideau = CSS pur (`animation-timeline: view()`). Apparitions = IntersectionObserver. Storyboard = `StoryboardCellule.astro` existant (GSAP déjà en `public/vendor/gsap`, inchangé). | La maquette contient 0 GSAP et 0 React ; recopier PJ:JS = fidélité maximale, réécrire en React = risque de régression sans gain visuel ; perf : le JS React (127 Ko) est déjà signalé (`pistes-optimisation-perf.md` §9) ; note Opus du 08/11 : « ProjectsCarousel.astro, script inline, sans React ». **S'écarte du cadrage « îlots React » de la demande.** | Oui (le composant peut devenir un îlot plus tard sans toucher aux données). |
| D2 | FAQ = `<details>` natifs comme la maquette (13 questions, l.770-784), plus `FaqAccordion` React sur cette page. Une seule source : `src/data/maquettiste-faq.ts` → rendu HTML ET JSON-LD `FAQPage`. | Fidélité + pas de dérive FAQ/JSON-LD. | Oui |
| D3 | « Blocs courts » (décidé) devient le **seul** rendu : les règles `body.t-short …` (l.269-272) deviennent inconditionnelles sous `.mqn`. Les blocs `details.more` sont rendus **ouverts, summary masqué** comme en maquette (`<details class="more" open>`), le JS « Lire la suite » animé (script l.865, partie 2) n'est pas porté (inatteignable : summary caché). | Rendu identique à la maquette, HTML identique pour `seo_diff`. | Oui (remettre le script) |
| D4 | CSS de page : **un fichier** `src/styles/maquettiste-nantes.css`, importé dans le frontmatter de la page, **tous les sélecteurs préfixés par `.mqn`** (classe sur le `<main class="mqn">`). PJ:CSS : fichier séparé `src/styles/projets-carrousel.css`, **non préfixé** (déjà autonome : `--pj-*` sur `.pj, dialog.zoom`), importé par le composant carrousel. Pas de `<style>` scopé Astro. | Le zoom est cloné dans `document.body` (hors `main`) et PJ:JS crée du DOM par `innerHTML` : un style scopé (`data-astro-cid`) ne s'y applique pas. `.wrap/.btn/.card/.sec` sont génériques : sans préfixe ils fuiraient sur Header/Footer. Garder les noms de classes de la maquette rend les diffs possibles. | Oui |
| D5 | Une seule classe de mouvement : **`motion` sur `<html>`** (nom de la maquette). L'ancien `lp-motion` disparaît avec l'ancienne page. | Le rideau (`.motion header.hero`) et `[data-rv]` en dépendent. | — |
| D6 | `/realisations/[slug].astro` avec `export const prerender = true` + `getStaticPaths` (le site est `output:'server'`, aucune page prérendue aujourd'hui : c'est la première). Repli si le build refuse : route SSR qui lit `realisations.ts` et renvoie 404 pour un slug inconnu. | HTML statique = rapide et indexable. | Oui |
| D7 | Slugs = ceux du carrousel (hrefs PJ:HTML), figés avant sitemap : `systeme-filtration-purification`, `maquette-bioreacteur`, `maquette-cellule-biologique`, `caravane-de-presentation`, `maquettes-design-produit`. Le brouillon caravane dit `maquette-caravane` → **à trancher par Nolann** (§11), défaut = slug du carrousel. | URL stables. | Avant push seulement |

## 1. Arborescence cible
```
src/pages/maquettiste-nantes.astro          (réécrit : assemblage + SEO + JSON-LD ; même URL)
src/pages/realisations/[slug].astro          (nouveau, prerender)
src/components/maquettiste/
  IconSprite.astro        sprites SVG l.508-534 (i-3d + defs), aria-hidden
  HeroMaquettiste.astro   fil d'Ariane l.539 + header.hero l.542-559 (bandeau chiffres 2×2 inclus)
  SecInteractive.astro    01 l.571-595 (mosaïque visuels, 4 cartes à icônes animées .aicard)
  SecBureauEtudes.astro   02 l.596-612        SecPourQui.astro      03 l.613-625
  SecProcess.astro        04 l.626-645 (#process)  SecTypes.astro   05 l.646-656 (#types-cards)
  SecBeyond.astro         06 l.657-671        SecDistinction.astro  07 l.672-683
  SecFaq.astro            09 l.768-785 (depuis maquettiste-faq.ts)
  FinalCta.astro          l.788-793           MobileCta.astro       .mcta l.811 (hors main, fixe)
  PageMotion.astro        <script> : apparitions [data-rv] (fonction motionOn l.813-824 SEULE) + icônes .live + répartition #types-cards (l.865-923 parties 1 et 3)
src/components/ProjectsCarousel.astro        PJ:HTML l.687-764 généré depuis les données + PJ:DATA + PJ:TPL + PJ:JS
src/components/realisations/ProjectPage.astro (gabarit de fiche, utilisé par [slug])
src/data/realisations.ts                     données projets (forme §2)
src/data/maquettiste-faq.ts                  13 Q/R
src/styles/maquettiste-nantes.css            CSS page préfixé .mqn (l.22-289 + 470-503, sans .fake-head, .vbar, #old, .ph de maquette, .sb-ph)
src/styles/projets-carrousel.css             PJ:CSS l.290-468 tel quel
```
Ordre dans la page (identique maquette) : Hero → `<div class="rideau">` [ `<StoryboardCellule />` (remplace `.sb-ph` l.563-568) → 01…07 → ProjectsCarousel (section 08, avec `<MachinesStrip />` à la place du `.ph` l.762) → 09 FAQ → CTA final ] → fin `main` ; MobileCta après `main`.
Hors maquette, à ne PAS porter : `.fake-head` (le vrai Header de BaseLayout le remplace), `.vbar`, `#old`, script l.813-862 sauf `motionOn`, paramètres `?t= ?r= ?old= ?bar=`.

## 2. Données (PJ:DATA → `src/data/realisations.ts`)
Générées depuis PJ:DATA (l.927-964) + les 5 `<article class="pc">` (l.703-756), recopiées mot pour mot :
```ts
export type Photo = [src: string, w: number, h: number, alt: string]; // src "/assets/real-1.webp" ou "spin:<dir>"
export interface Realisation {
  slug: string; title: string; cat: string; f: string;       // data-f
  text: string; full: string[];                              // .pc-text, paragraphes .pc-full
  photos: Photo[];                                           // ordre = zoom ; [0] = image de carte
  fiche: boolean;                                            // drapeau pj-fiches
  page?: { h1: string; title: string; description: string; chapo: string;
           sections: { h2: string; html: string }[];          // ~300 mots, faits vrais, sans nom de client
           specs: { k: string; v: string }[]; related: string[]; ogImage?: string; dateCreated?: string };
}
export const REALISATIONS: Realisation[] = [...]; // ordre éditorial du carrousel
```
- Le badge « N vues » = nombre de photos ; badge 3D si une photo `spin:`. Calculés, pas stockés.
- `ProjectsCarousel.astro` rend les `<li><article>` en HTML serveur (même markup, `style="--i:N"`), puis `<script type="application/json" id="pj-photos" set:html={JSON.stringify(...)}>` et `#pj-fiches` : **PJ:JS reste compatible octet pour octet** hors chemins.
- `src/data/maquettes.ts` (visionneuse 360 de `MaquetteCarousel`) reste tel quel : `MaquetteCarousel.astro` est encore importé par `maquette-industrielle.astro:6` → ne pas le supprimer, juste ne plus l'importer ici.

## 3. JS (PJ:JS l.1003-1333 → `<script>` de `ProjectsCarousel.astro`)
Recopie telle quelle, seules réécritures (liste fermée) :
1. `../../public/assets/` → `/assets/` (HTML, données, `MAQ = '/assets/maquettes/'`). Dossiers vérifiés : `purification|cellule|caravane/{base,sm}` = 216 avif (+3 webp dans `sm`).
2. l.1291-1292 : `pushState(..., '#projet-' + slug)` → `'/realisations/' + slug` **seulement si `fiches[slug]`** (sinon garder le hash : pas de page) ; `document.title` = titre du projet, restauré à la fermeture ; à la fermeture, restaurer l'URL **capturée à l'ouverture** (`location.href`), jamais un chemin codé en dur (le composant reste réutilisable sur `/realisations`).
3. `openFromHash` : garder `#projet-<slug>` (liens existants) ; `popstate` inchangé.
4. Script **processé** par Astro (module, différé) : OK car PJ:JS n'agit qu'après DOMContentLoaded. Exception : `document.documentElement.classList.add('js')` (l.507) **doit** rester en `<script is:inline>` dans `<head>` (slot `head`) : la CSS PJ s'en sert (l.358-359, 465 `.js .track > li{opacity:0}`), sinon flash.
5. `.js .track > li{opacity:0}` masque des cartes : vérifier qu'elles redeviennent visibles si PJ:JS plante (garde : la classe `js` n'est posée que si `IntersectionObserver` existe ; sinon tout visible).

## 4. CSS : règles de portage
- `:root{--bg…}` → `.mqn{…}` ; `html{}`/`body{}` de maquette → `.mqn{}` (BaseLayout a déjà fond `#161514` et `overflow-x:hidden` dans `global.css:326`). `a`, `img`, `h1,h2,h3`, `strong` → `.mqn a` etc. **Réaffirmer la typo des titres** : `global.css:14-16` remet h1-h3 à plat.
- `.motion X` → `.motion .mqn X` ; `html:not(.motion) .pj …` reste tel quel (fichier PJ) ; `@keyframes` et `@supports/@media` hors préfixe (préfixer seulement les sélecteurs internes).
- `.mcta` (hors `main`) : `.mqn-page .mcta` ou sélecteur nu `.mcta` (vérifier qu'aucune autre CSS du site ne l'utilise : `grep -rn "mcta" src`).
- À reporter de la maquette : `.split > *{min-width:0}` (l.473), `.z-grid` mobile `minmax(0,1fr)` (déjà dans PJ:CSS).
- CSS mort à ne pas porter (vérifier par grep qu'aucune classe ne l'utilise) : tuiles « Faire tourner en 3D » l.475-490 si aucun `data-pj-spin` dans le HTML final.
- Méthode conseillée à l'executant : script Python jetable (scratchpad) qui préfixe les sélecteurs, puis relecture des cas spéciaux ci-dessus ; jamais à la main ligne à ligne.

## 5. SEO / perf (liste du SUIVI, chaque point = un contrôle)
1. `<title>` = titre de prod actuel « Maquettiste à Nantes : conception et fabrication | Nasap3D » (sans « (MAQUETTE 08/11/2026) ») ; description de prod actuelle conservée ; canonical par `BaseLayout` (`path="/maquettiste-nantes"`).
2. JSON-LD : repris de l'actuel `maquettiste-nantes.astro` l.91-132 (Service + BreadcrumbList + FAQPage), `FAQPage` régénéré depuis `maquettiste-faq.ts` ; corriger « 360° » → « 3D » s'il y figure (texte maquette).
3. H1 sans `opacity:0` : `.mqn h1.hero-in{animation-name:up-y}` + `@keyframes up-y{from{transform:translateY(6px)}to{transform:none}}` ; eyebrow, lead, ctas, kpis gardent `up` (fondu).
4. LCP = H1 (texte, pas d'image dans le hero). « fetchpriority hero » → poster du storyboard (frame 0) sous le hero : `fetchpriority="high"`, pas de `loading="lazy"` (à faire dans `StoryboardCellule.astro`, à vérifier : y toucher = composant partagé ? il n'est utilisé que sur cette page → `grep`).
5. `[data-rv]` masqué seulement si `html.motion` (posée par JS) : déjà le cas, contrôle sans JS (Chrome `--disable-javascript`) = tout visible.
6. Polices locales (lot L6, global) : retirer Google Fonts + preconnect de `BaseLayout.astro:68-75`, auto-héberger Space Grotesk 500/600/700 + Inter 400/500/600(/700 utilisé par la maquette) woff2 latin, `font-display:swap`, preload de Space Grotesk 600/700 (H1). Licence OFL 1.1 (usage commercial OK) à citer. Voie : API Fonts d'Astro 7 si disponible (`fonts` dans `astro.config.mjs`), sinon `public/fonts/` + `@font-face` dans `global.css`.
7. Images : aucune image du 1er écran en lazy ; cartes et mosaïque gardent `loading="lazy"` + width/height ; `srcset` = passe perf ultérieure (pas dans ce chantier).
8. Pages projet (§6) + sitemap ; `/realisations` : un vrai lien par projet qui a une fiche + JSON-LD `CollectionPage/ItemList` (gabarit §6).
9. Cholet/Angers (lot L7, **sous condition** : Search Console ≈ 0 clic, accord Nolann) : `redirects` 301 `/impression-3d-cholet` et `/impression-3d-angers` → `/impression-3d-nantes` dans `astro.config.mjs:32`, **suppression** des deux `.astro` (sinon conflit route/redirection), retrait des liens `Footer.astro`/`Header.astro`/`LocalSeoLayout.astro`/`404.astro`/`index.astro`/`impression-3d-nantes.astro` (grep « cholet|angers »), retrait du sitemap. `{{ nav.href }}` : **introuvable** dans `src/` et `public/` (grep du 08/11) → probablement une URL vue par Google, à chercher dans Search Console, pas à coder.
10. Contrôle `seo_diff.py <maquette> <HTML rendu>` : seules différences admises = suffixe du titre, canonical/JSON-LD/og ajoutés, chemins `/assets/`, Header/Footer réels. Et `seo_diff.py <prod actuelle> <HTML rendu>` → **liste de ce que la maquette retire de la page en ligne** (ex. section « Explorez nos maquettes en 3D », galerie `lp-real`, textes `strengths` « 360° ») à montrer à Nolann (§11), pas à décider seul.

## 6. Pages `/realisations/<slug>` (gabarit : `gabarit-seo_realisations-slug_2026-11-08.md`)
- `getStaticPaths` = `REALISATIONS.filter(r => r.fiche && r.page)` (4 projets ; `maquettes-design-produit` exclu, `fiche:false`).
- `ProjectPage.astro` : `BaseLayout` (title ≤ 60, description 140-155, `path`, `ogImage`), H1 = objet, chapeau, H2 « Le besoin / Comment on l'a fabriqué / Ce que ça apporte », `<dl>` fiche, galerie (photo 1 `fetchpriority="high"`, autres lazy), lien service, 2-3 autres projets, CTA **« Un projet similaire ? » → `/contact`** (texte d'expertise, pas de paiement), retour `/realisations`. JSON-LD `@graph` CreativeWork + ImageObject + BreadcrumbList + provider minimal (le `/#business` n'est défini que sur l'accueil). Style : tokens du site, mêmes classes que la page (`.mqn` + `maquettiste-nantes.css` importé) pour ne pas créer un 3e design.
- **Contenu : manque.** Seul le brouillon caravane existe (`fiche-projet-caravane_brouillon_2026-11-08.md`, ~250 mots, « à relire par Nolann »). Filtration, bioréacteur, cellule : **pas de texte**. Le lot L5 livre le gabarit + données + 4 textes en brouillon (caravane d'après son brouillon ; les 3 autres rédigés à partir des faits connus : cartes, alts, `maquettes.ts`, sans rien inventer), chacun marqué « à valider » dans le rapport. `fiche:true` ×4 **comme en PJ:DATA** (le zoom garde « Voir la fiche projet », fidélité) : la barrière est le push (commit local seulement), pas les données.
- Caravane : photo = rendu ChatGPT → retirer ou légender « illustration » (décision Nolann, §11).
- `public/sitemap.xml` (manuel, 21 URLs) : ajouter une `<url>` + `lastmod` par page générée. Fichier partagé avec L7 → L7 passe après L5.

## 7. Lots (fichiers disjoints, une consigne `executant-ui` chacun)
Prérequis du worktree (fil principal) : jonction `node_modules` + `.env` (CLAUDE.md projet), build de référence `astro build` vert, captures « maquette » de référence par `caps_serie.sh` (déjà dans `planches-maquettes-08/`).
| Lot | Fichiers (seul écrivain) | Dépend de | Livrable / vérif |
|---|---|---|---|
| L1 Données | `src/data/realisations.ts`, `src/data/maquettiste-faq.ts` | — | `astro check` vert ; diff texte vs maquette = 0 (script de comparaison : tous les `alt`, titres, `.pc-text`, Q/R présents à l'identique) |
| L2 Carrousel | `src/components/ProjectsCarousel.astro`, `src/styles/projets-carrousel.css` | L1 | PJ:JS recopié + §3 ; page de test temporaire non commitée ou directement L4 ; zoom des 5 projets ouvert à 375/1440 sans erreur console |
| L3 CSS page | `src/styles/maquettiste-nantes.css` | — | §4 ; grep : aucun sélecteur non préfixé hors liste blanche (`.mcta`, `@keyframes`) |
| L4 Page | `src/pages/maquettiste-nantes.astro`, `src/components/maquettiste/*`, `StoryboardCellule.astro` (fetchpriority seul) | L1-L3 | §1, §5.1-5.5 ; `seo_diff` ×2 (§5.10) ; captures §9 |
| L5 Fiches (+ libellés `/realisations` : « Maquette filtration systems », real-17 « Objets liturgiques », gabarit §6) | `src/pages/realisations/[slug].astro`, `src/components/realisations/ProjectPage.astro`, `src/pages/realisations.astro`, `public/sitemap.xml` | L1 (L3 pour le style) | §6 ; build : 4 HTML prérendus (ou SSR repli) ; 1 H1, titre ≤ 60, meta 140-155, JSON-LD valide |
| L6 Polices | `src/layouts/BaseLayout.astro`, `src/styles/global.css`, `public/fonts/*` (ou `astro.config.mjs` si API Fonts) | — (captures de comparaison prises en L8) | captures avant/après accueil + /maquettiste-nantes + /contact ; 0 requête `fonts.googleapis.com` |
| L7 Cholet/Angers | `astro.config.mjs`, suppression 2 pages, Footer/Header/LocalSeoLayout/404/index/impression-3d-nantes, `public/sitemap.xml` | L5, **go Nolann** | `curl -I` 301 sur les 2 URLs ; grep cholet/angers = 0 lien interne |
| L8 Contrôle | aucun (agent `testeur`) | L4-L6 | §9 complet, rapport verts/rouges |
Parallélisables : L1 ∥ L3 ∥ L6 ; puis L2 ∥ L5 ; puis L4 ; puis L8 ; L7 à part. Commit local après chaque lot vert (`git add <fichiers>`), pas de push.
Hors chantier mais au même moment (SUIVI) : « PETG HF » → « PETG » (`prisma/seed.ts:64`, migration = accord Nolann).

## 9. Critères de vérification (« fait » seulement si tout est vert)
- Captures Chrome headless (`cap.cjs`/`caps_serie.sh`, jamais le navigateur intégré pour le scroll) à **375, 768, 1440, 1920** (+ 375×667 et 740×360 pour le rideau), haut de page, chaque section, carrousel, zoom ouvert (photo + 3D), FAQ ; **côte à côte avec la maquette**, liste des écarts (même vide).
- `scrollWidth == clientWidth` à toutes les largeurs (seul `#z-strip` déborde, voulu).
- Rideau : `rideau-page-entiere_2026-11-08.eval.js` → tableau du doc rideau (heroVisTop constant k=0/0,5/1 ; `hit = rideau` à k=1 ; RM=1 → pas de transform, hauteur sans rideau).
- `prefers-reduced-motion: reduce` : pas de fondu, pas de rideau, visionneuse sans rotation auto, page complète. Sans JS : tout le texte visible, liens des cartes = navigation normale vers `/realisations/<slug>`.
- Thème sombre Windows : fond et texte fixés partout (dialog zoom compris : `color-scheme`/`background` explicites).
- Console : 0 erreur (la « 404 à 375 dans le zoom » de la maquette est à identifier ici : onglet Réseau).
- Lighthouse en **build prod** (jamais `astro dev`) avant/après, tableau dans le rapport.
- Bouton Retour : zoom ouvert → URL `/realisations/<slug>` → Retour ferme le zoom ; recharger cette URL = la fiche serveur.

## 10. Risques / points durs
1. **Portée CSS** (D4) : oubli de préfixe = fuite sur Header/Footer ; préfixe en trop sur du DOM hors `main` (zoom, `.mcta`) = zoom sans style. Contrôle : capture Header/Footer avant/après + zoom.
2. `global.css` (h1-h3 à plat, `body` overflow) et la CSS existante de `MachinesStrip`/`StoryboardCellule` (`is:global`) peuvent modifier le rendu de la maquette : comparer au pixel près les sections voisines.
3. Premier `prerender = true` du projet avec l'adaptateur node standalone : vérifier `dist/client/realisations/*.html` et le service par `server-entry.mjs` en Docker local ; repli SSR (D6).
4. `pushState` vers `/realisations/<slug>` change l'URL sans changer la page : Plausible peut compter une vue (proxy `/m/e`) ; à vérifier, sinon accepter (un zoom = une vue de projet).
5. Le zoom (`dialog` dans `body`) + `.mcta` (z 20) + `MobileNavToggle` + bannière éventuelle : vérifier l'empilement à 375.
6. Rideau : Firefox = page normale (règles sous `@supports`), voulu. Hero coupé de 27 px à 375×667 (écart connu, §11).
7. Textes des fiches non fournis → pages bloquées (§6), pas un risque technique mais le chemin critique.
8. Perte de contenu de la page en ligne (§5.10) → décision Nolann avant push (risque SEO/Ads : la page est la cible de la campagne « Maquettage B2B »).

## 11. Décisions à Nolann (à poser en un pop-up au retour, défaut sûr appliqué entre-temps)
- D1 sans React (défaut : oui, réversible). D7 slug caravane (défaut : `caravane-de-presentation`).
- Contenu en ligne absent de la maquette, listé par `seo_diff` (défaut : on suit la maquette, liste montrée avant push).
- Textes des 4 fiches (défaut : 4 brouillons générés en local, `fiche:true` comme la maquette, rien de poussé avant sa validation).
- Photo caravane = rendu ChatGPT (défaut : légende « illustration »).
- Écrans courts (hero −27 px à 375×667), pager du zoom à 5 cartes, contraste bouton devis, jonction 2 du rideau (défaut : comme la maquette, J2 non faite).
- L7 Cholet/Angers : attend son go après contrôle Search Console.
