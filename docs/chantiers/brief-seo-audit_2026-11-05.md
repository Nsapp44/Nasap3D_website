# Brief : audit SEO complet Nasap3D (à coller dans une NOUVELLE conversation)

Dossier de travail : le même worktree (`.claude/worktrees/maquettage-b2b-propre`, branche `claude/maquettage-b2b`). Modèle : Sonnet, effort medium (l'agent `architecte` pour le jugement dur).

Mission : audit SEO + marketing complet et honnête du site Nasap3D (Astro), pour que Nolann soit sûr « à 200 % » que la direction (design premium, storyboard animé en hero de /maquettiste-nantes, /maquette-industrielle, /reparer-piece-3d, futur carrousel de projets) ne dégrade pas le référencement. Il veut un verdict clair, argumenté, chiffré.

À faire :
1. État des lieux : README, CLAUDE.md, SUIVI.md, docs/, recherches concurrents déjà faites (grep docs/), titres/meta/JSON-LD/URLs/maillage/sitemap/robots/canonical, pages ads (Google Search 2 €/jour, ChatGPT Ads, /reparer-piece-3d).
2. Risques du storyboard : texte crawlable (DOM sans JS ?), H1 unique, CLS/LCP/INP, poids (mesuré : 328 Ko initial mobile, 508 Ko desktop, 1,2 / 2,1 Mo après parcours complet ; scène 1000vh), lazy-load, version reduced-motion/no-JS. Mesurer (Lighthouse/PageSpeed), ne pas supposer.
3. Carrousel de projets à venir : clic = le projet s'agrandit au premier plan (pas une page séparée), croix = retour. Recommander l'approche SEO-sûre : texte complet de chaque projet dans le HTML, adresse par projet (#projet-x), images alt/dimensions/lazy, schema ; dire si des pages dédiées sont indispensables ou non.
4. Recherche large via `chercheur-web` (15 recherches minimum, GitHub/GitLab, annuaires de skills/plugins marketing-SEO Claude) : tableau candidats / licence / utile ou non / on prend ou pas ; comparer aux concurrents.
5. Skills déjà installés : searchfit-seo (seo-auditor, competitor-analyzer, content-strategist), agent `seo`.

Contraintes : ne PAS pousser, ne PAS modifier le code du site (lecture seule + rapport). Ne pas couper les ads ni changer titres/meta/JSON-LD/URLs. Rapport dans `docs/chantiers/seo-audit_2026-11-05.md` (commit local de ce seul fichier, git add ciblé), puis un Artifact : verdict « bonne voie / à corriger » en tête, top 5 actions par impact, vrais vs faux risques, ce qui est bien, ce qui manque, outils trouvés. Français, direct, conclusions d'abord.
