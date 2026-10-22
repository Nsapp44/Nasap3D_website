# SUIVI : état courant (22/10/2026)

## Fait (poussé sur master)
- Échelle du projet stockée/affichée partout (`bb1989b`).
- Point « expertise humaine avant paiement » terminé (`addf8b3` + libellés panier) : `ExpertiseSteps.astro`,
  FAQ, meta, CGU art. 3, pages ville, devis PDF ; panier : « Passer la commande pour expertise »,
  « Se connecter pour commander », « Envoyer pour expertise ». E-mails et compte déjà conformes.
- Plausible goals, Search Console `/devis-instantane` : OK selon Nolann. Ads : marchent bien.

## Prochain pas exact
Nolann fait un point sur le prochain sujet (probablement stratégie X-Tools C1) ; retour ads possible.

## Ensuite
Stratégie X-Tools C1 (shop Etsy séparé sans diluer NASAP 3D, `machines.astro` Cricut→C1, mention discrète, SEO, TikTok auto).
Points ouverts : prix admin, retest STL, migration d'échelle après déploiement (à vérifier en prod).

## Ce qui n'a pas marché
Hydratation React cassée en dev via jonction `node_modules` (403 `@fs`) → `fs.strict=false` temporaire (jamais commité).
