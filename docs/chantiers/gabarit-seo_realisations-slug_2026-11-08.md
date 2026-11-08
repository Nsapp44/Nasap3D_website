# Gabarit SEO d'une page /realisations/<slug> (prêt à coder après feu vert)

Rien n'est codé. Basé sur audit SEO §6 et le JSON-LD existant de `maquettiste-nantes.astro` (Service + BreadcrumbList, `siteUrl`, `provider @id /#business`). Sitemap = `public/sitemap.xml` manuel.

## 1. Balises (par projet)
| Élément | Règle | Exemple (maquette cellule) |
|---|---|---|
| URL | `/realisations/<slug>` sans slash final (`trailingSlash:'never'`), slug = mot-clé, minuscule, tirets, stable | `/realisations/maquette-cellule-pedagogique` |
| `<title>` | ≤ 60 car. : « <Objet + matière/technique> — <usage/client type> \| Nasap3D » | « Maquette de cellule pédagogique en coupe \| Nasap3D » |
| meta description | 140-155 car. : quoi + matière/technique + contexte + Nantes + appel discret | « Modèle pédagogique d'une cellule en coupe, pièces multicolores imprimées en 3D à Nantes. Découvrez la fabrication et demandez votre maquette. » |
| canonical | auto-référent (BaseLayout le fait via `path`) | |
| H1 | un seul, = l'objet (pas le slogan) | « Maquette de cellule pédagogique en coupe » |
| og:image | photo principale du projet 1200×630 (prop `ogImage`) ; **corriger `og:image:alt`** (BaseLayout:63 codé en dur faux) → prop `ogImageAlt` | |
| robots | index, follow | |

## 2. Texte minimal (200-350 mots, texte statique dans le HTML initial, jamais rendu par JS)
1. Chapeau (1-2 phrases, mot-clé principal + Nantes) : ce que c'est, pour qui.
2. H2 « Le besoin » : contexte client (anonymisé si besoin), 2-3 phrases.
3. H2 « Comment on l'a fabriqué » : technique/matière (FDM, résine SLA, métal 316L, laser), échelle, nb de pièces, finition, délai. Faits vrais uniquement.
4. H2 « Ce que ça apporte » : résultat concret.
5. Encadré fiche : matière · technique · dimensions · quantité · délai (liste ou `<dl>`).
6. CTA : « Demander une maquette semblable » → /contact ou /maquettiste-nantes ; formulation « expertise » avant tout paiement (règle du projet).
Ne pas recopier le texte entre projets (contenu dupliqué) ; pas de promesse de prix non vérifiée.

## 3. Images
- `<img>` dans le HTML initial, jamais `display:none` ; `width`/`height` réels ; image principale `fetchpriority="high"`, sans `loading="lazy"` ; les autres lazy.
- alt = description factuelle (« Maquette de cellule en coupe imprimée en 3D, vue de face »), pas de bourrage ; alts cohérents avec /realisations.
- Noms de fichiers descriptifs pour les nouveaux (`maquette-cellule-face.webp`) ; WebP, srcset si dispo.

## 4. JSON-LD (un seul `<script type="application/ld+json">`, `@graph`)
```json
{
 "@context":"https://schema.org",
 "@graph":[
  {"@type":"CreativeWork",
   "@id":"https://nasap3d.com/realisations/<slug>#projet",
   "name":"<H1>","description":"<meta description>",
   "url":"https://nasap3d.com/realisations/<slug>",
   "image":["https://nasap3d.com/assets/<img>.webp"],
   "creator":{"@id":"https://nasap3d.com/#business"},
   "about":"<objet/secteur>","material":"<matière>","dateCreated":"<AAAA-MM-JJ si connue>",
   "inLanguage":"fr-FR"},
  {"@type":"ImageObject","contentUrl":"…","name":"…","width":1200,"height":900,
   "creator":{"@id":"https://nasap3d.com/#business"}},
  {"@type":"BreadcrumbList","itemListElement":[
    {"@type":"ListItem","position":1,"name":"Accueil","item":"https://nasap3d.com/"},
    {"@type":"ListItem","position":2,"name":"Réalisations","item":"https://nasap3d.com/realisations"},
    {"@type":"ListItem","position":3,"name":"<H1>","item":"https://nasap3d.com/realisations/<slug>"}]}
 ]}
```
Règles : pas d'`aggregateRating` ni d'avis inventés ; `/#business` n'est défini que sur l'accueil → dupliquer un provider minimal (nom, url, adresse Nantes) dans le graphe pour que la référence se résolve ; valider avec le test des résultats enrichis.

## 5. Maillage
- Entrant : `/realisations` (un vrai `<a href>` par carte, texte d'ancre = titre du projet), carrousel de /maquettiste-nantes, accueil si pertinent.
- Sortant : 1 lien contextuel vers le service correspondant (/maquettiste-nantes, /maquette-industrielle, /impression-3d-nantes, /materiaux-impression-3d selon matière), 2-3 « Autres projets » (même famille), retour « Toutes les réalisations ».
- Ancres variées, descriptives (pas « cliquez ici »).

## 6. À faire en même temps
- `public/sitemap.xml` : ajouter chaque URL + `lastmod` ; sitemap d'images optionnel.
- Corriger libellés de /realisations (« Maquette filtration systems », real-17 « Objets liturgiques » décrit « Maquettes de design produit ») avant de recopier dans les pages.
- /realisations : ajouter JSON-LD `CollectionPage` + `ItemList` pointant vers les pages.
- Comportement carrousel : clic intercepté + `history.pushState` vers la même URL ; sans JS = navigation normale. Le contenu de la page projet est servi par le serveur.
- Contrôle final par page : 1 seul H1, titre ≤ 60, meta 140-155, canonical OK, JSON-LD valide, alts, aucun scroll horizontal 375/768/desktop.

## 7. Passe perf après validation du design
Voir `pistes-optimisation-perf.md` (dossier local_5eab4690) ; ordre : 1 Caddy (dev de Nolann), 4 H1 sans fondu depuis 0, 2 polices locales, 3 CSS inline, 5 hero statique + GSAP différé, 6-9 ensuite. Mesure avant/après (Lighthouse build prod, jamais `astro dev`), captures avant/après, aucun changement visuel. Pas démarrée : attend le feu vert design.
