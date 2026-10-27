# Plan SEO national (27/10/2026) : France d'abord, Nantes ensuite

> **Certitude** : les positions Google actuelles n'ont **pas** été mesurées (pas d'accès à google.fr depuis la session). Ce plan s'appuie sur les règles publiques de Google et l'étude des concurrents (`docs/concurrents_tech3d_abeille3d_2026-10-27.md`). À confirmer par Search Console (onglet Performances, requêtes sur 28 jours) ou une recherche manuelle sur google.fr avant/après.

Rien de ce plan n'est appliqué au code tant que Nolann n'a pas dit oui. Jamais « livraison gratuite ». Phrase A et prix via `getPublicPricing()` inchangés.

## 1. Rôle de chaque page (éviter qu'elles se concurrencent)
| Page | Intention visée | Ne pas viser |
|---|---|---|
| `/` (accueil) | impression 3D sur mesure en France + marque Nasap3D | « devis instantané » (laissé à /devis-instantane) |
| `/devis-instantane` | devis / prix en ligne | — (inchangée) |
| `/impression-3d-en-ligne` | impression 3D en ligne, livraison nationale | « devis instantané » |
| `/impression-3d-nantes` | local Nantes (seule page ville ciblée) | — |
| `/maquette-impression-3d` | maquettage (shop, autre session) | — (on n'y touche pas) |

Angers/Cholet : inchangées (règle Google sur les pages satellites, voir sources).

## 2. Titres et descriptions (longueurs comptées par script, en caractères)
| Page | Actuel | Proposé |
|---|---|---|
| `/` title | « Impression 3D en France — Devis instantané en ligne \| Atelier à Nantes » (70) | « Impression 3D sur mesure en France — Atelier à Nantes \| Nasap3D » (63) |
| `/` meta | « Impression 3D sur mesure partout en France : devis instantané en ligne, prix calculé sur votre fichier, … livraison dans toute la France. » (192, coupée par Google vers 155-160) | « Impression 3D sur mesure livrée en France : pièces, prototypes, maquettes, rétro-conception et petites séries. Atelier à Nantes, expertise avant paiement. » (154) |
| `/` h1 | « Impression 3D en France » | inchangé |
| `/impression-3d-en-ligne` title | « Impression 3D en ligne : devis instantané et livraison \| Nasap3D » (64) | « Impression 3D en ligne : pièces livrées en France \| Nasap3D » (59) |
| `/devis-instantane` title | « Devis Instantané Impression 3D — Prix en Ligne \| Nasap3D » (56) | inchangé |

Écart par rapport à la note du 27/10 : « … fabrication et livraison en France | Nasap3D » faisait 69 caractères (> 63), d'où la version courte. La meta de l'accueil passait à 162, « partout » retiré.

Fichiers : `src/pages/index.astro` l.67-68, `src/pages/impression-3d-en-ligne.astro` l.20 (`TITLE`).

## 3. Données structurées (JSON-LD)
- `src/pages/index.astro` l.37 : `areaServed: ["France", "Nantes", "Cholet", "Angers"]` → `areaServed: "France"` (Nantes reste dans l'adresse du LocalBusiness).
- `src/components/guides/GuideHero.astro` l.44 : redéclare `https://nasap3d.com/#business` en `Organization`, alors que l'accueil le déclare en `LocalBusiness` (même `@id`, deux types contradictoires). → mettre `@id: "https://nasap3d.com/#organization"` (déjà utilisé l.49 de l'accueil).
- Vérification : Rich Results Test sur `/` et sur un guide après déploiement.

## 4. Structure des titres de /devis-instantane
- `src/pages/devis-instantane.astro` : `div.di-h2` aux l.107, 124, 139, 148, 164, 195 (l.183 est déjà un `h2`) → `h2` ; CSS `.di-h2` (l.266) : ajouter `margin: 0; font: inherit;` pour un rendu identique.
- Vérification : `getComputedStyle` (taille, graisse, marges) avant/après sur les 6 titres + captures 375/768/1280.

## 5. Petites retouches (faible valeur, à faire en passant)
- Images machines de l'accueil (`index.astro` l.162-195, fonds CSS) : `role="img"` + `aria-label` descriptif.

## 6. Décisions à prendre par Nolann (pop-up)
- Pied de page (`Footer.astro` l.3-6) : texte actuel « Nous intervenons à Nantes, Cholet et Angers · Maquettes 3D ». Proposition : « Livraison partout en France » + liens devis / réalisations / services.
- Page rétro-conception : recommandé en phase 2, après un inventaire des faits réels (pièces déjà faites, photos, délais) ; rien d'inventé.
- Mentions « Canclaux » (quartier de l'atelier) : retirées de l'accueil le 27/10 (commit 43c9aa8). Restent : impression-3d-nantes, a-propos, ContactMap, devis-instantane, particuliers, impression-3d-en-ligne, cgu (fichier du shop, pas touché ici), et les docs Ads (l.25) et 3Dnatives (l.19).

## 7. Hors site (après le déploiement)
- 3Dnatives (fiche Nantes) : `docs/plan_3dnatives_frenchtech_2026-10-27.md`.
- Google Business Profile Nantes (adresse, photos, avis).
- Search Console : 17 pages « non indexées » à examiner une par une (motif de Google, demande d'indexation des pages utiles).

## 8. Ordre d'exécution proposé (Sonnet medium)
1. §2 + §3 (un commit) → build → contrôle des balises dans `dist` (title, meta, JSON-LD valide).
2. §4 (un commit) → `getComputedStyle` + captures responsive.
3. §5, puis les points du §6 validés.
4. Nolann teste en local ; push sur son oui seulement.

## Sources (règles publiques)
- Google Search Central, « Influencing title links » (mis à jour 2025-12-10).
- Google Search Central, « Spam policies » : pages satellites / doorway (mis à jour 2026-08-28).
- Google Search Central, données structurées LocalBusiness et Organization (mis à jour 2026-09-08).
- John Mueller sur la cannibalisation de mots-clés, Search Engine Journal (2025-09-22).
