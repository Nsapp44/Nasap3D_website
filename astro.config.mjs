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
  adapter: node({ mode: 'standalone' }),
  // The adapter's own `port`/`host` options (node({port, host})) are NOT
  // what actually reaches the running server — @astrojs/node's build
  // plugin overwrites them with _config.server.port/.host right after
  // spreading userOptions (see node_modules/@astrojs/node/dist/index.js),
  // baked into the build as a virtual module the standalone entrypoint
  // imports at runtime. So these two values below ARE the real defaults,
  // confirmed by testing both ways:
  //  - host: Astro defaults server.host to false (localhost/::1 only) —
  //    fatal in a container, since nothing outside the container's own
  //    loopback (Docker's port publishing, the reverse proxy on another
  //    container) can reach it: a 502 with zero application-level error.
  //    Confirmed by exec'ing into a running container and finding the
  //    process listening on ::1:3000, not 0.0.0.0:3000.
  //  - port: Astro defaults server.port to 4321 (its usual dev port) —
  //    confirmed in a real production log showing "listening on ...4321"
  //    despite .env's PORT=3000, meaning process.env.PORT wasn't actually
  //    read at that moment and it fell back to this baked-in default
  //    instead of docker-compose.yml's expected 3000. Setting it here
  //    explicitly removes the silent 4321 fallback entirely;
  //    process.env.PORT (see server-entry.mjs) still wins over it when set.
  server: { host: true, port: 3000 },
  site: 'https://nasap3d.com',
  // Les URLs actuelles (Caddyfile) n'ont jamais de slash final (/services, pas
  // /services/) — évite un mismatch avec les liens internes existants pendant
  // la migration.
  trailingSlash: 'never',
  integrations: [react()]
});