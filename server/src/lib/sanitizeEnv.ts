// Defense-in-depth against a real, confirmed-in-production bug: Docker
// Compose's `env_file:` injects server/.env into the container as-is —
// quotes included, since unlike `dotenv` it never strips them. A value
// written as KEY="value" in server/.env (a very natural thing to type)
// then arrives in process.env as the literal string `"value"`, quotes
// included. This has now been confirmed twice: S3_REGION broke the AWS SDK
// this way, and SMTP auth started failing (wrong "username"/"password" —
// literally containing quote characters — rejected by the mail server).
//
// docker-compose.yml was switched to a bind-mount + `dotenv` (which does
// strip quotes when it parses the file itself) instead of `env_file:` —
// but that fix lives in a file that isn't part of the deployed image, so
// it only takes effect once someone runs `git pull` *and* recreates the
// container on the server; the auto-deploy pipeline there only re-pulls
// the image, never the compose file or an already-running container's
// mount config. Rather than depend on that manual step happening (and
// staying done), this strips a single matching pair of leading/trailing
// quotes — and surrounding whitespace — from every environment variable,
// once, at boot. Cheap, idempotent, and harmless for values that were
// never quoted to begin with.
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
