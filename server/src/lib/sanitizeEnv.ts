// `dotenv` (used by `npm run dev`) strips quotes around values in .env —
// but in the real Docker deployment, env vars come straight from
// docker-compose.yml's `env_file:`, which does NOT strip them: a value
// written as KEY="value" in server/.env, a very natural thing to type,
// arrives in process.env as the literal string `"value"`, quotes included.
// Confirmed in production: S3_REGION="eu-west-1" broke the AWS SDK with
// `region=""eu-west-1"" is not a valid hostname component`.
//
// Rather than rely on server/.env never having quotes (one habit slip away
// from the same bug recurring on any variable), this strips a single
// matching pair of leading/trailing quotes — and surrounding whitespace —
// from every environment variable, once, at boot. Call this before
// anything else reads process.env.
export function sanitizeEnv(): void {
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
