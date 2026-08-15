// Thin shared helper around the hCaptcha JS API. Unlike Google reCAPTCHA v3,
// hCaptcha's free tier has no invisible auto-minted token: each page must
// render a real, visible, user-solved checkbox widget (the
// <script src="https://js.hcaptcha.com/1/api.js?render=explicit"> tag lives
// in each page's helmet) and read the token back out of a callback.

function waitForHcaptcha(timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function poll() {
      if (typeof window !== 'undefined' && window.hcaptcha && typeof window.hcaptcha.render === 'function') {
        resolve(window.hcaptcha);
        return;
      }
      if (Date.now() - start > timeoutMs) { reject(new Error('hcaptcha_load_timeout')); return; }
      setTimeout(poll, 100);
    })();
  });
}

// Renders the widget into `container` and returns its widgetId (needed to
// reset it after each submit attempt, since a solved token is single-use).
// hCaptcha only offers "normal" (~huge next to our compact forms) or
// "compact" (narrower but taller) — neither fits well, so the "normal"
// widget is shrunk with CSS `zoom` instead.
//
// Two earlier approaches were tried and both broke in practice (seen live,
// not just in theory): `transform: scale()` only affects paint, not
// layout, so the container's height had to be measured and copied over by
// hand — first a one-shot measurement (missed hCaptcha resizing its own
// iframe a second time after the logo loaded, clipping the bottom of the
// widget), then a ResizeObserver-based fix (still collapsed the widget to
// a sliver in testing — the observer's first callback can fire before
// hCaptcha's iframe has any real content, and nothing forced a re-check
// afterward). `zoom` sidesteps the whole class of bug: unlike `transform`,
// it's a real layout property — the browser lays out `inner` (and by
// extension `container`, an auto-height block) as if it natively were that
// much smaller, so there's no separate height to compute or keep in sync
// at all, whatever hCaptcha's real size turns out to be or however many
// times it changes.
export async function renderHcaptcha(container, { sitekey, onToken, onExpire, scale = 0.8 }) {
  if (!container) return null;
  const hcaptcha = await waitForHcaptcha();
  container.innerHTML = '';
  const inner = document.createElement('div');
  inner.style.zoom = scale;
  container.appendChild(inner);
  return hcaptcha.render(inner, {
    sitekey,
    theme: 'dark',
    hl: 'fr',
    callback: (token) => { if (onToken) onToken(token); },
    'expired-callback': () => { if (onExpire) onExpire(); },
    'error-callback': () => { if (onExpire) onExpire(); },
  });
}

export async function resetHcaptcha(widgetId) {
  if (widgetId === null || widgetId === undefined) return;
  try {
    const hcaptcha = await waitForHcaptcha();
    hcaptcha.reset(widgetId);
  } catch (e) {}
}
