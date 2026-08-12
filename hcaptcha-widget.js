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
// widget is rendered into an inner wrapper and scaled down uniformly with
// CSS, then the outer container is resized to the scaled height so no blank
// gap is left below it (CSS transform doesn't affect flow layout sizing).
export async function renderHcaptcha(container, { sitekey, onToken, onExpire, scale = 0.8 }) {
  if (!container) return null;
  const hcaptcha = await waitForHcaptcha();
  container.innerHTML = '';
  const inner = document.createElement('div');
  container.appendChild(inner);
  const widgetId = hcaptcha.render(inner, {
    sitekey,
    theme: 'dark',
    hl: 'fr',
    callback: (token) => { if (onToken) onToken(token); },
    'expired-callback': () => { if (onExpire) onExpire(); },
    'error-callback': () => { if (onExpire) onExpire(); },
  });
  requestAnimationFrame(() => {
    const h = inner.offsetHeight;
    if (!h) return;
    inner.style.transform = `scale(${scale})`;
    inner.style.transformOrigin = 'center top';
    container.style.height = `${Math.ceil(h * scale)}px`;
    container.style.overflow = 'hidden';
  });
  return widgetId;
}

export async function resetHcaptcha(widgetId) {
  if (widgetId === null || widgetId === undefined) return;
  try {
    const hcaptcha = await waitForHcaptcha();
    hcaptcha.reset(widgetId);
  } catch (e) {}
}
