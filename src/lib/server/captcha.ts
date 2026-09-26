// Verifies an hCaptcha token server-side via hcaptcha.com/siteverify. Never
// trust a client-supplied "I solved it" claim — only what hCaptcha's own
// API confirms here.
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
    // No key configured yet — fail open in development only, so the rest of
    // the flow stays testable while keys are being obtained. Fails CLOSED in
    // production: a misconfiguration must never silently disable bot
    // protection on a live site.
    if (process.env.NODE_ENV !== "production") {
      return { ok: true, reason: "hCaptcha not configured (dev bypass)" };
    }
    return { ok: false, reason: "hCaptcha not configured" };
  }

  if (!token) {
    return { ok: false, reason: "missing token" };
  }

  const params = new URLSearchParams({ secret, response: token });
  // Node's global fetch() has no default timeout — without this, a slow/
  // unresponsive hCaptcha would hang this call forever. Higher-risk than
  // most other external calls in this app precisely because this one fires
  // on every signup/login/contact submission, not just an occasional admin
  // action — the highest-frequency path that could leak a socket per hang.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let res: Response;
  try {
    res = await fetch("https://hcaptcha.com/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  const data = (await res.json()) as SiteVerifyResponse;

  if (!data.success) {
    return { ok: false, reason: (data["error-codes"] || []).join(",") || "verification failed" };
  }
  return { ok: true };
}
