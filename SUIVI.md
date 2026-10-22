# SUIVI : état courant (22/10/2026)

## Fait
- Échelle du projet stockée/affichée partout : commit `bb1989b` poussé sur master.
- Point « expertise humaine avant paiement » (NON commité, en attente d'accord de Nolann) :
  `ExpertiseSteps.astro` (nouveau) sur `/devis-instantane` et accueil ; FAQ, meta et CGU art. 3 corrigées.
  Responsive vérifié : mobile 375, tablette 768 (pas de scroll horizontal), accueil mobile OK.
- Skill `verif-responsive-web` créé ; `CLAUDE.md` du projet créé.

## Reste pour le point expertise
- Libellés de boutons : `CartPage.tsx` (:597 « Se connecter pour commander », :386 « Passer la commande »),
  `QuoteWizard.tsx:361`, `Dashboard.tsx`, pages ville (Angers/Cholet « du devis au paiement »),
  `QuoteDocument.tsx:150` « Paiement à la commande. », e-mails `orderEmails.ts`.
- Captures desktop larges à montrer à Nolann, puis accord → retirer `astro.dev.tmp.mjs` → commit/push.

## Prochain pas exact
Ajuster les libellés ci-dessus, puis montrer les captures et demander l'accord de commit.

## Ensuite
Stratégie X-Tools C1 (shop Etsy séparé sans diluer NASAP 3D, `machines.astro` Cricut→C1, mention discrète, SEO, TikTok auto).
Points ouverts : goals Plausible, Search Console `/devis-instantane`, prix admin, retest STL, bilan ads (1-2 sem.), migration d'échelle après déploiement.

## Ce qui n'a pas marché
Hydratation React cassée en dev via jonction `node_modules` (403 `@fs`) → `fs.strict=false` temporaire.
