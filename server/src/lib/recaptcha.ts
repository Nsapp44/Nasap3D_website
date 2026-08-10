// Verifies a reCAPTCHA v3 token server-side via Google's siteverify endpoint.
// Never trust a client-supplied score — only the value Google returns here.
// See server/README.md for how to obtain RECAPTCHA_SITE_KEY/SECRET_KEY.

interface SiteVerifyResponse {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
}

export interface RecaptchaResult {
  ok: boolean;
  score: number | null;
  reason?: string;
}

export async function verifyRecaptcha(
  token: string | undefined,
  expectedAction: string,
  minScore: number,
): Promise<RecaptchaResult> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;

  if (!secret) {
    // No keys configured yet (see README) — fail open in development only,
    // so the rest of the flow stays testable while keys are being obtained.
    // Fails CLOSED in production: a misconfiguration must never silently
    // disable bot protection on a live site.
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, score: null, reason: "recaptcha not configured (dev bypass)" };
    }
    return { ok: false, score: null, reason: "recaptcha not configured" };
  }

  if (!token) {
    return { ok: false, score: null, reason: "missing token" };
  }

  const params = new URLSearchParams({ secret, response: token });
  const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = (await res.json()) as SiteVerifyResponse;

  if (!data.success) {
    return { ok: false, score: null, reason: (data["error-codes"] || []).join(",") || "verification failed" };
  }
  if (data.action && data.action !== expectedAction) {
    return { ok: false, score: data.score ?? null, reason: "action mismatch" };
  }
  const score = data.score ?? 0;
  if (score < minScore) {
    return { ok: false, score, reason: "score below threshold" };
  }
  return { ok: true, score };
}
