# Passation SEO (fork SEO → maquettes 08 suite) : 08/11/2026

Contexte : j'étais le fork SEO de la mère `local_5eab4690` ; audit SEO/marketing du design premium + storyboard « cellule ». Branche `claude/maquettage-b2b`, commits locaux seulement, jamais de push sans l'accord de Nolann.

## 1. Où sont les rapports
- Rapport principal (commité 0cd15a2) : `docs/chantiers/seo-audit_2026-11-05.md`. Sections : §2 chiffres Lighthouse, §3 vrais/faux risques du storyboard, §5 corrections par impact, §6 carrousel SEO-sûr, §8 outils, §10 premier affichage rapide, §11 ambition nationale, §12 quantité de texte, §13 Search Console, §14 vrais résultats Google.
- Brief d'origine : `docs/chantiers/brief-seo-audit_2026-11-05.md`.
- Artifact (v3, à jour) : https://claude.ai/artifact/V7XHWp3zgbuW4jrrWb7zun ; source `C:\Users\Nolann\AppData\Local\Temp\claude\C--Users-Nolann-Desktop-Nasap3D-website-Code-html-Refonte-Nasap3D--claude-worktrees-maquettage-b2b-propre\75c60f2f-cfe4-4f6a-9047-eda926b06b7c\scratchpad\audit-seo.html` (republier même chemin + même url pour mettre à jour).
- Pistes perf (même dossier de notes) : `pistes-optimisation-perf.md` (9 pistes classées par gain, fichiers, méthode).
- Mesures brutes : `C:\Users\Nolann\AppData\Local\Temp\claude\seo-mesures\` (lh_*.json, prod_*.json, maquettiste.html).

## 2. Verdict et décisions
- Direction (design premium + storyboard en hero) : bonne voie, le storyboard n'est PAS un risque SEO en soi : texte dans le HTML initial, 1 seul H1 (le titre du storyboard est un `<p>`), CLS ~0, TBT 0, version statique no-JS/reduced-motion complète.
- Quantité de texte : vérifiée sur les vrais top Google (§14) : bonne, ne pas rallonger ni raccourcir (médiane « sur mesure » ≈1 300 mots, « maquettiste » ≈600, Nantes ≈650-800 ; /maquettiste-nantes ≈2 070, accueil ≈1 620).
- Carrousel : vraies pages `/realisations/<slug>` (HTML serveur, H1, texte, alt/width/height, JSON-LD CreativeWork) + `<a href>` par carte + interception JS avec `history.pushState` ; `#projet-x` seul est insuffisant (Google ignore le fragment). Le design « agrandi en place » reste compatible.
- Ambition nationale : la technique n'est pas le facteur limitant ; ce qui compte = backlinks (3Dnatives, CCI, French Tech), avis vérifiables, profondeur par requête, vraies pages projets. Pas de pages villes en série (règle doorway, déjà décidée).
- Outils SEO : question de Nolann en attente (option A : commandes ciblées de claude-seo seulement ; B : copier le plugin MIT en remplaçant ses 5 agents Opus par Sonnet/Haiku, code non lu). Ma reco : A (+ éventuellement marketingskills, Unlighthouse, tous MIT). Pas d'audit complet (5 agents = cher).

## 3. Chiffres clés (Lighthouse, build prod local, mobile 4G simulée)
- /maquettiste-nantes mobile : Perf 79, LCP 4,26 s (élément = H1 animé depuis opacity:0), FCP ~3,3 s, 809 Ko / 42 req. Desktop 98, LCP 0,95 s.
- Accueil mobile : Perf 69, LCP 6,85 s, 1,82 Mo ; CLS desktop 0,061.
- Node ne compresse pas (313 Kio économisables) ; Caddy hors dépôt, compression/cache non vérifiés.
- Search Console (28 j jusqu'au ~06/11, `sc-domain:nasap3d.com`, compte Google index `u/2` = `authuser=2`) : 72 clics, 3,05 k impressions, CTR 2,4 %, position moyenne 13,1 ; doublon www / non-www (`nasap3d.com/` 49 clics, `www.nasap3d.com/` 16) ; « imprimante 3d » 0 clic / 648 impressions (intention décalée) ; 17 pages non indexées.

## 4. Fait / pas fait
Fait : audit complet, rapport commité, Artifact à jour, vérification texte vs concurrents réels, lecture Search Console, pistes perf, messages à la mère et aux sessions concernées.
Pas fait / non vérifié : Plausible non lu (Nolann reconnecte le soir ; lecture seule, ne jamais taper d'identifiants) ; config Caddy ; INP terrain ; rendu Googlebot réel (inspection d'URL après déploiement) ; plan_3dnatives_frenchtech non relu ; cause du CLS 0,061 de l'accueil ; choix A/B outils ; aucun code du site modifié par moi.

## 5. Corrections à faire (par impact, détail §5 du rapport + pistes perf)
1. Perf (voir `pistes-optimisation-perf.md`) : Caddy compression/cache, polices auto-hébergées, CSS inline, H1 sans fondu depuis 0, hero statique + GSAP différé, frames progressives, allègement accueil.
2. Redirection 301 www → non-www + canonical (doublon mesuré) : côté Caddy (hors dépôt, dev de Nolann).
3. `og:image:alt` codé en dur faux sur toutes les pages (`BaseLayout.astro:63`) + og:image dédiée pour /maquettiste-nantes.
4. Avant le carrousel : structurer `realisations.astro` (19 cartes sans id/lien/titre), corriger libellés erronés (« Maquette filtration systems », real-17), alts cohérents, JSON-LD.
5. Images du storyboard indexables : `<img alt>` dans le HTML initial, pas de `display:none` (en mode animé les `.sb-sfig` sont masqués), sitemap d'images ; valider avec l'inspection d'URL.
6. Détails : `lastmod` /maquettiste-nantes à jour, sitemap manuel (ajouter les nouvelles URL dont /realisations/<slug>), `provider @id /#business` minimal sur les pages service, 5 H2 du storyboard sans mot-clé (mineur), contrastes, CTA « Demander un devis sur mesure » trop peu visible sur mobile (conversion des Ads !).
7. Après mise en ligne : backlinks / Google Business Profile / avis (chantier autorité), suivi de positions sur ~20 requêtes nationales.

## 6. Mots-clés et structures à préserver (ne pas casser le SEO)
- Titres/meta/JSON-LD/URLs existants intacts : /maquettiste-nantes (titre 59 car.), /maquette-industrielle, /reparer-piece-3d (`noindex, follow` voulu, landing Ads), accueil ; ne pas couper les ads (Google Search 2 €/jour, ChatGPT Ads).
- Requêtes cibles : « maquettiste Nantes », « maquette industrielle », « impression 3D sur mesure (Nantes) » (3e place locale actuelle, protégée), « réparation pièce 3D ». Mots à garder dans H1/H2/premier paragraphe et dans le texte statique : maquettiste, maquette (industrielle/architecte/concours), Nantes, impression 3D sur mesure, prototype, expertise.
- Texte des légendes + 5 H2 + pills du storyboard doivent rester dans le HTML initial (pas de contenu rendu seulement au scroll/JS) ; 1 seul H1 par page ; canonical auto-référent, `trailingSlash:'never'`.
- Flux de commande : parler d'« expertise » avant paiement (CLAUDE.md du projet), pas de paiement à la commande.

## 7. Prochains pas proposés
1. Réponse de Nolann A/B sur les outils SEO.
2. Quand le design est validé : passe d'optimisation perf selon `pistes-optimisation-perf.md` (mesure avant, étapes, mesure après, captures avant/après, aucun changement visuel) ; piste 1 (Caddy) et 301 www à transmettre au dev.
3. Corrections de petits restes SEO du §5 (og:image:alt, sitemap, lastmod, alts) : faisables en même temps que la passe perf.
4. Pages `/realisations/<slug>` quand le carrousel est figé.
5. Plausible + Search Console de nouveau après déploiement ; inspection d'URL.

## 8. Questions ouvertes pour Nolann
- Outils : A ou B ? (reco A)
- Accepte-t-il des pages dédiées par projet (reco) ou la variante minimale tout-dans-/realisations ?
- Qui parle à son dev pour Caddy (compression, cache, 301 www) ?
- Le texte « Demander un devis sur mesure » du CTA : OK pour renforcer son contraste ?
