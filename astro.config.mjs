// @ts-check
import { defineConfig } from 'astro/config';

import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  site: 'https://nasap3d.com',
  // Les URLs actuelles (Caddyfile) n'ont jamais de slash final (/services, pas
  // /services/) — évite un mismatch avec les liens internes existants pendant
  // la migration.
  trailingSlash: 'never',
  integrations: [react()]
});