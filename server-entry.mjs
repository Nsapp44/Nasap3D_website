// Docker CMD / production entrypoint — replaces server/src/index.ts's boot
// sequence. Deliberately a plain script at the repo root, outside src/ (not
// part of the Astro/Vite build graph), because the ordering below can't be
// guaranteed by Vite's own module bundling/chunking behavior:
//
//   1. dotenv, loaded first, so every subsequent step sees the real .env.
//   2. sanitizeEnv() — strips stray quotes Docker Compose's env_file: can
//      leave on values (see bootstrap/sanitizeEnv.mjs) — must run before
//      anything reads process.env, including the Astro bundle's own modules
//      (many read SMTP_*/S3_*/etc. at import time). This is why step 3 is a
//      dynamic import rather than a static one at the top of this file: a
//      static import is hoisted by the JS spec and would execute before
//      steps 1-2 regardless of source order.
//   3. The built Astro SSR server (@astrojs/node, standalone mode) — its
//      entry module starts listening as a side effect of being imported,
//      reading PORT/HOST from process.env the same way server/src/index.ts
//      used to.
import "dotenv/config";
import { sanitizeEnv } from "./bootstrap/sanitizeEnv.mjs";

sanitizeEnv();

await import("./dist/server/entry.mjs");
