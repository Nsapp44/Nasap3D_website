import { randomBytes, randomInt, createHash } from "node:crypto";

// Opaque bearer tokens (session/refresh/password-reset): the raw value is
// handed to the client once and never stored — only its SHA-256 hash is
// persisted, so a stolen database dump alone can't be replayed as a live
// token (same principle as storing a password hash instead of the password).
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// Email verification code: short enough to type by hand. Low entropy on its
// own (1 in 1,000,000) — safe only because the routes using it also enforce
// a short expiry and a small max-attempts count (see src/lib/api routes).
export function generateNumericCode(): string {
  return String(randomInt(100000, 1000000));
}
