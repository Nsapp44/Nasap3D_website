# Passation maquettes 08 (08/11/2026, ~15h) : retours de Nolann à appliquer

Écrite par la session fille Opus « maquettes 08 » (boucle de compaction : contexte plein, elle passe la main).

## Où en est le travail
- Maquettes : `docs/maquettes/carrousel-projets_2026-11-08.html` (autonome) et `docs/maquettes/page-maquettiste-nantes_2026-11-08.html` (page 05 + blocs PJ:* du carrousel).
- Commit local d5b7044 (non poussé). Détail complet : `docs/chantiers/maquettes-carrousel-page-08_2026-11-08.md` (à lire en premier ; non commité, la session mère le commite).
- **On ne modifie QUE le carrousel autonome, puis on régénère la page** avec `outils-maquettes-08/build_page_0811.py` (dans ce dossier de notes ; il recopie les blocs PJ:CSS/HTML/DATA/TPL/JS ; si tu changes une ancre, adapte le script). Autres outils au même endroit : `seo_diff.py` (diff SEO 05→08, rien ne doit disparaître), `sw_each.cjs` (ouvre les 8 zooms et mesure les débordements), `cap.cjs`, `planches.py`.
- Serveur : `python -m http.server 4380 --bind 127.0.0.1` à la racine du worktree (tourne, PID 46448). Page ouverte dans le navigateur intégré : `http://127.0.0.1:4380/docs/maquettes/page-maquettiste-nantes_2026-11-08.html#nos-maquettes`.
- Fichiers de 50 à 100 Ko : lire par extraits (grep, offset/limit), jamais en entier.

## Retours de Nolann (08/11, dictés)
1. **Une page par projet `/realisations/<slug>` : confirmé** (« ça nous fait du référencement »).
2. **Zoom, règle des médias** :
   - plusieurs photos → exactement comme maintenant ;
   - pas plusieurs photos mais la 3D → les 5 vues 3D comme maintenant (« hyper intéressant ») ;
   - **une seule photo → pas de flèches** (ni bande de vignettes inutile).
   - Règle générale : « quand il n'y a rien à glisser à droite ou à gauche, il n'y a juste pas de flèche, sinon ça porte à confusion ».
   - Les petites flèches gauche/droite du zoom sont « intégrées bizarrement » : revoir leur placement et leur dessin.
   - Caravane : « normalement tu as plusieurs photos » → chercher de vraies photos de la caravane dans `public/assets` ; si aucune, le noter en question.
3. Interprétation à valider (option sûre, réversible) : même règle pour les flèches du carrousel principal (début : pas de « précédent », fin : pas de « suivant » ; masquer en gardant la place, plutôt que griser).
4. **Responsive « vraiment bien géré, très important pour moi »** : 375, 390/414, 768, 1024, 1280, 1440, 1920 (portrait et paysage tablette). Aucun scroll horizontal, cibles tactiles ≥ 44 px, textes lisibles, zoom plein écran propre sur mobile. Skill `verif-responsive-web` si présent, sinon `verif-ecran`.
5. Ensuite Nolann vérifie la page et fait ses retours.
6. **Après validation du design : grosse passe d'optimisation perf** (« optimiser à mort »). La session SEO (local_75c60f2f) a des pistes : premier affichage = seulement le texte et ce qui est à l'écran, le reste chargé après, comme les gros sites. Elle doit les écrire dans `pistes-optimisation-perf.md` (ce dossier de notes) et prévenir la session mère « maquettage B2B » (local_5eab4690).

## Contraintes dures (inchangées)
- Rien de SEO supprimé (titres, meta, JSON-LD, h1-h3, alts, liens, textes) : relancer `seo_diff.py`.
- Design du site : #161514/#1a1917/#201d1b, accent #ff5a3c, Space Grotesk + Inter, bordure rgba(255,255,255,.1), entrée translateY(6px) 0,5 s, prefers-reduced-motion.
- Commit local ciblé de `docs/maquettes/` seulement, jamais `git add -A`, rien poussé, ne pas toucher `public/storyboard/cellule/preview-onde.html` ni `src/`.
- Captures avant/après côte à côte (375/768/1440 + zoom ouvert) avant « fini ».
