// Thin shared helper around the hCaptcha JS API — near-verbatim port of
// hcaptcha-widget.js. Unlike Google reCAPTCHA v3, hCaptcha's free tier has
// no invisible auto-minted token: each page must render a real, visible,
// user-solved checkbox widget (the
// <script src="https://js.hcaptcha.com/1/api.js?render=explicit"> tag is
// added directly to the page that needs it) and read the token back out of
// a callback.

declare global {
  interface Window {
    hcaptcha?: {
      render: (el: HTMLElement, opts: Record<string, unknown>) => string;
      reset: (widgetId: string) => void;
    };
  }
}

function waitForHcaptcha(timeoutMs = 10000): Promise<NonNullable<Window["hcaptcha"]>> {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (typeof window !== "undefined" && window.hcaptcha && typeof window.hcaptcha.render === "function") {
        resolve(window.hcaptcha);
        return;
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error("hcaptcha_load_timeout"));
        return;
      }
      setTimeout(poll, 100);
    })();
  });
}

// hCaptcha's "normal" checkbox widget's fixed footprint — documented/stable
// across renders, since the whole point of shrinking it below is a static
// scale-down, not something that needs runtime measurement.
const NORMAL_WIDTH = 303;
const NORMAL_HEIGHT = 78;

// Renders the widget into `container` and returns its widgetId (needed to
// reset it after each submit attempt, since a solved token is single-use).
// hCaptcha only offers "normal" (huge next to our compact forms) or
// "compact" (narrower but taller) — neither fits well, so the "normal"
// widget is shrunk instead.
//
// Previously used CSS `zoom` for this (a real layout property, unlike
// `transform: scale()` — no separate height to measure/keep in sync as
// hCaptcha resizes its own iframe). That broke on Safari specifically: its
// `zoom` implementation doesn't shrink a cross-origin iframe's reserved
// layout box the same way Chrome does, leaving a blank gap on the right and
// bottom of the widget (confirmed live, Safari only — reported as "the
// captcha displays wrong, white on the right and a bit at the bottom").
// `transform: scale()` doesn't have that iframe-specific quirk, but does
// need its own fix for the problem `zoom` was chosen to avoid: the
// transformed element still occupies its *unscaled* footprint in the
// layout unless the container is given an explicit size matching the
// scaled-down result — done here directly instead of measuring anything at
// runtime, since the pre-scale size is fixed and known (NORMAL_WIDTH/HEIGHT
// above).
export async function renderHcaptcha(
  container: HTMLElement | null,
  opts: { sitekey: string; onToken?: (token: string) => void; onExpire?: () => void; scale?: number },
): Promise<string | null> {
  if (!container) return null;
  const { sitekey, onToken, onExpire, scale = 0.8 } = opts;
  const hcaptcha = await waitForHcaptcha();
  container.innerHTML = "";
  const outer = document.createElement("div");
  outer.style.width = `${NORMAL_WIDTH * scale}px`;
  outer.style.height = `${NORMAL_HEIGHT * scale}px`;
  outer.style.overflow = "hidden";
  const inner = document.createElement("div");
  inner.style.transform = `scale(${scale})`;
  inner.style.transformOrigin = "top left";
  outer.appendChild(inner);
  container.appendChild(outer);
  return hcaptcha.render(inner, {
    sitekey,
    theme: "dark",
    hl: "fr",
    callback: (token: string) => onToken?.(token),
    "expired-callback": () => onExpire?.(),
    "error-callback": () => onExpire?.(),
  });
}

export async function resetHcaptcha(widgetId: string | null | undefined): Promise<void> {
  if (widgetId === null || widgetId === undefined) return;
  try {
    const hcaptcha = await waitForHcaptcha();
    hcaptcha.reset(widgetId);
  } catch {
    // widget already gone (page navigated away) — nothing to reset
  }
}
