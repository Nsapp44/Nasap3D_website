// Verifies an hCaptcha token server-side via hcaptcha.com/siteverify. Never
// trust a client-supplied "I solved it" claim — only what hCaptcha's own
// API confirms here. See server/README.md for how to obtain
// HCAPTCHA_SITE_KEY/HCAPTCHA_SECRET_KEY.
//
// Switched from Google reCAPTCHA v3: v3 is score-based (an invisible risk
// score per request, no user-visible pass/fail) rather than a deterministic
// checkbox challenge — in practice its score came back too low too often
// during real use, rejecting legitimate visitors with no way for them to
// retry. hCaptcha's checkbox challenge is what the site now uses instead:
// solve it or don't, no hidden threshold.

interface SiteVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

export interface CaptchaResult {
  ok: boolean;
  reason?: string;
}

export async function verifyCaptcha(token: string | undefined): Promise<CaptchaResult> {
  const secret = process.env.HCAPTCHA_SECRET_KEY;

  if (!secret) {
    // No key configured yet (see README) — fail open in development only,
    // so the rest of the flow stays testable while keys are being obtained.
    // Fails CLOSED in production: a misconfiguration must never silently
    // disable bot protection on a live site.
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, reason: "hCaptcha not configured (dev bypass)" };
    }
    return { ok: false, reason: "hCaptcha not configured" };
  }

  if (!token) {
    return { ok: false, reason: "missing token" };
  }

  const params = new URLSearchParams({ secret, response: token });
  const res = await fetch("https://hcaptcha.com/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const data = (await res.json()) as SiteVerifyResponse;

  if (!data.success) {
    return { ok: false, reason: (data["error-codes"] || []).join(",") || "verification failed" };
  }
  return { ok: true };
}
