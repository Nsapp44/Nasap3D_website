import argon2 from "argon2";

// Argon2id parameters are tunable via env so they can be raised as the
// production hardware allows, without a code change. Defaults follow OWASP's
// current minimum recommendation (memory >= 19 MiB, iterations >= 2).
function options() {
  return {
    type: argon2.argon2id,
    memoryCost: Number(process.env.ARGON2_MEMORY_COST || 19456),
    timeCost: Number(process.env.ARGON2_TIME_COST || 2),
    parallelism: Number(process.env.ARGON2_PARALLELISM || 1),
  };
}

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, options());
}

export function verifyPassword(hash: string, plain: string): Promise<boolean> {
  return argon2.verify(hash, plain);
}

// Same policy already enforced client-side today: >=8 chars, >=1 uppercase,
// >=1 special character. Re-checked here because the client-side check can
// be bypassed by anyone calling the API directly.
const SPECIAL_RE = /[!@#$%^&*(),.?":{}|<>_\-+=~`[\]/\\;']/;

export function isValidPassword(plain: string): boolean {
  return plain.length >= 8 && /[A-Z]/.test(plain) && SPECIAL_RE.test(plain);
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
