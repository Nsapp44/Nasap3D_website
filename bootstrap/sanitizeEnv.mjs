// Defense-in-depth against a real, confirmed-in-production bug: Docker
// Compose's `env_file:` injects .env into the container as-is — quotes
// included, since unlike `dotenv` it never strips them. A value written as
// KEY="value" in .env (a very natural thing to type) then arrives in
// process.env as the literal string `"value"`, quotes included. This has
// now been confirmed twice: S3_REGION broke the AWS SDK this way, and SMTP
// auth started failing (wrong "username"/"password" — literally containing
// quote characters — rejected by the mail server).
//
// Deliberately a plain .mjs file outside src/ (not part of the Astro/Vite
// build graph): it has to run before the Astro SSR bundle is even imported,
// since that bundle's own modules read process.env at module scope. See
// server-entry.mjs for the exact ordering this depends on. This is the only
// copy of this logic — it was ported unmodified from the pre-migration
// server/src/lib/sanitizeEnv.ts.
export function sanitizeEnv() {
  for (const key of Object.keys(process.env)) {
    const raw = process.env[key];
    if (raw === undefined) continue;
    const trimmed = raw.trim();
    const isQuoted =
      trimmed.length >= 2 &&
      ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'")));
    const cleaned = isQuoted ? trimmed.slice(1, -1) : trimmed;
    if (cleaned !== raw) process.env[key] = cleaned;
  }
}
