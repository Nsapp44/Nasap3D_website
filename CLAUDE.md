# Nasap3D : site (maintenu par Claude)

Impression 3D / fabrication sur mesure, Nantes. Astro + React (îlots `client:load`) + Prisma/PostgreSQL + Stripe + Boxtal + react-pdf + Plausible (proxy `/m/s.js`, `/m/e`). Déploiement Docker OVH, **redéploiement auto au push sur `master`**.

## Règles dures
- **Ne jamais commiter ni pousser sans l'accord de Nolann** : résumer les changements, montrer les captures, demander.
- **Responsive à chaque changement d'interface** (mobile 375, tablette 768, desktop/grand écran) : skill `verif-responsive-web`. Aucun scroll horizontal.
- **Respecter le design existant** : fond sombre `#161514`/`#1a1917`/`#201d1b`, accent `#ff5a3c`, Space Grotesk (titres) + Inter, cartes arrondies bordure `rgba(255,255,255,0.1)`, animation d'entrée `translateY(6px)` 0,5 s, `prefers-reduced-motion` respecté. Fixer soi-même fond et texte (thème sombre de Windows).
- Montrer des captures avant/après pour tout changement visuel.
- Ne pas couper les ads (Google Search 2 €/jour, ChatGPT Ads, landing `/reparer-piece-3d`) ni casser le SEO (titres, meta, JSON-LD, URLs).

## Flux de commande réel
`OrderStatus` : EXPERTISE → AWAITING_PAYMENT → PENDING → PRINTING → READY → DELIVERED (ou REJECTED).
`POST /api/checkout` crée la commande en EXPERTISE (pas de Stripe). Admin « Accepter » → AWAITING_PAYMENT. Le client paie depuis son compte (`POST /api/orders/[id]/pay`, session Stripe) ; webhook `checkout.session.completed` → PENDING + facture. **Donc : expertise humaine avant tout paiement** (message de réassurance : `src/components/ExpertiseSteps.astro`). Les textes doivent parler d'« expertise », pas de paiement à la commande.

## Dev local
- `astro dev` (ou Docker : `docker-compose.yml`, Docker Desktop à lancer). Un worktree n'a pas de `node_modules` : jonction vers le dépôt principal + `.env` ; si l'hydratation React échoue (403 Vite `@fs`), config temporaire `server.fs.strict=false` (ne pas commiter, ex. `astro.dev.tmp.mjs`).
- Navigateur intégré pour les captures.

## Docs
`README.md`, `PRICING.md`, `SHIPPING.md`, `LESSONS_LEARNED.md`, `SUIVI.md` (état courant, réécrit à chaque étape). `HANDOFF_CLAUDE_CODE.md` = ancien prompt de reprise, obsolète.
