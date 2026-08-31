// @ts-check
// Must be the very first thing evaluated (literal first import) — this
// config file itself is loaded before Vite/the dev server/the build ever
// start, for both `astro dev` and `astro build`. Astro/Vite do their own
// automatic .env loading, but that only reliably populates
// import.meta.env — server-side code across this project (Prisma, the
// mailer, etc.) reads plain process.env directly, the same convention
// server-entry.mjs's own `dotenv/config` guarantees for the production
// build. `astro dev`'s newer daemon mode was confirmed NOT to carry
// process.env through to route handlers on its own (DATABASE_URL came back
// "not found" mid-session despite a perfectly valid .env — plain `dotenv`
// parsed the same file fine in isolation) — this makes dev mode use the
// exact same explicit loading path as production instead of relying on
// Astro's own env injection.
import 'dotenv/config';
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  // SSR (was 'static'): the API is being migrated in-tree as Astro API
  // routes (src/pages/api/) instead of the separate server/ Fastify
  // process — see the migration plan. 'standalone' node mode produces a
  // self-contained dist/server/entry.mjs runnable with plain `node`, no
  // extra HTTP server needed — required anyway since the quote engine
  // shells out to a real PrusaSlicer binary + writes real temp files,
  // which categorically rules out an edge/serverless target.
  output: 'server',
  // port: 3000 is a safety-net default — @astrojs/node's standalone
  // adapter falls back to 8080 if it can't read PORT from process.env,
  // silently mismatching docker-compose.yml's static 3000:3000 mapping and
  // causing a 502 (upstream unreachable) with no application error at all.
  // process.env.PORT (set via .env, see server-entry.mjs) still wins over
  // this when present — this only guards the case where it's missing.
  adapter: node({ mode: 'standalone', port: 3000 }),
  // server.host defaults to false (Astro binds to localhost/::1 only) —
  // the adapter reads this exact value to decide what to bind to. Inside a
  // container that's fatal: nothing outside the container's own loopback
  // (i.e. neither Docker's port publishing nor the reverse proxy on
  // another container) can ever reach it, producing a 502 with zero
  // application-level error — confirmed by exec'ing into a running
  // container and finding the process listening on ::1:3000, not
  // 0.0.0.0:3000/:::3000. host: true binds all interfaces instead.
  server: { host: true },
  site: 'https://nasap3d.com',
  // Les URLs actuelles (Caddyfile) n'ont jamais de slash final (/services, pas
  // /services/) — évite un mismatch avec les liens internes existants pendant
  // la migration.
  trailingSlash: 'never',
  integrations: [react()]
});