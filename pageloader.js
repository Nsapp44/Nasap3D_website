// Nasap3D page-load overlay — shows a clean full-screen loader (printer animation
// on a uniform background) only when a page/navigation is actually slow enough to
// notice. Fast loads never see it at all.
//
// Three things make it feel right:
//  1. It's on a delay (SHOW_DELAY_MS): if the destination content is ready before
//     that delay elapses, the overlay is never mounted — no flash on a fast load.
//  2. Once it IS shown, it stays for a minimum duration (MIN_VISIBLE_MS) so it
//     never flickers in and immediately back out.
//  3. It stays until the destination page has actually PAINTED its content
//     (not just window 'load'), so there is no blank pop. The animation phase is
//     carried across the navigation via a sessionStorage timestamp + negative
//     animation-delay, so the loop continues instead of restarting from zero.
(function () {
  var STYLE_ID = 'nasap-pageloader-style';
  var OV_ID = 'nasap-pageloader';
  var T0_KEY = 'nasap-nav-t0';
  var SHOW_DELAY_MS = 220;
  var MIN_VISIBLE_MS = 350;
  var PERIOD_MS = 2500;
  var SAFETY_MS = 5000;

  var CSS =
    '#' + OV_ID + '{position:fixed;inset:0;z-index:99999;background:#161514;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;opacity:1;transition:opacity .3s ease}' +
    '#' + OV_ID + ' .npl-ico{width:66px;height:66px}' +
    '#' + OV_ID + ' .npl-cap{font:600 12px "Inter",system-ui,sans-serif;color:rgba(255,255,255,.5);letter-spacing:1px;text-transform:uppercase}' +
    '.npl-svg{width:100%;height:100%;display:block;color:#ff5a3c}' +
    '.npl-svg .npl-filament{fill:none;stroke:currentColor;stroke-width:6;stroke-linecap:round;stroke-linejoin:round}' +
    '.npl-svg .npl-stack{animation:nplShiftDown 2.5s linear infinite}' +
    '.npl-svg .npl-nozzle{fill:#161514;stroke:currentColor;stroke-width:2.5;stroke-linejoin:round;animation:nplNozzleMove 2.5s linear infinite}' +
    '.npl-svg .npl-line-lr{stroke-dasharray:100;animation:nplDrawLr 2.5s linear infinite}' +
    '.npl-svg .npl-arc-r{stroke-dasharray:100;animation:nplDrawArcR 2.5s linear infinite}' +
    '.npl-svg .npl-line-rl{stroke-dasharray:100;animation:nplDrawRl 2.5s linear infinite}' +
    '.npl-svg .npl-arc-l{stroke-dasharray:100;animation:nplDrawArcL 2.5s linear infinite}' +
    // carry the animation phase across pages (higher specificity than the shorthand above)
    '#' + OV_ID + ' .npl-stack,#' + OV_ID + ' .npl-nozzle,#' + OV_ID + ' .npl-line-lr,#' + OV_ID + ' .npl-arc-r,#' + OV_ID + ' .npl-line-rl,#' + OV_ID + ' .npl-arc-l{animation-delay:var(--npl-delay,0s)}' +
    '@keyframes nplShiftDown{0%,38%{transform:translateY(0px)}50%,88%{transform:translateY(10px)}100%{transform:translateY(20px)}}' +
    '@keyframes nplNozzleMove{0%{transform:translateX(-25px)}38%{transform:translateX(25px)}44%{transform:translateX(30px)}50%{transform:translateX(25px)}88%{transform:translateX(-25px)}94%{transform:translateX(-30px)}100%{transform:translateX(-25px)}}' +
    '@keyframes nplDrawLr{0%{stroke-dashoffset:100}38%,100%{stroke-dashoffset:50}}' +
    '@keyframes nplDrawArcR{0%,38%{stroke-dashoffset:100}50%,100%{stroke-dashoffset:84.3}}' +
    '@keyframes nplDrawRl{0%,50%{stroke-dashoffset:100}88%,100%{stroke-dashoffset:50}}' +
    '@keyframes nplDrawArcL{0%,88%{stroke-dashoffset:100}100%{stroke-dashoffset:84.3}}';

  var SVG =
    '<svg viewBox="0 0 100 100" class="npl-svg">' +
    '<defs><linearGradient id="nplFade" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="65%" stop-color="white" stop-opacity="1"/><stop offset="90%" stop-color="white" stop-opacity="0"/>' +
    '</linearGradient><mask id="nplMask"><rect x="0" y="0" width="100" height="100" fill="url(#nplFade)"/></mask></defs>' +
    '<g mask="url(#nplMask)"><g class="npl-stack">' +
    '<path class="npl-filament" d="M 75 105 L 25 105 A 5 5 0 0 1 25 95 L 75 95 A 5 5 0 0 0 75 85 L 25 85 A 5 5 0 0 1 25 75 L 75 75 A 5 5 0 0 0 75 65 L 25 65 A 5 5 0 0 1 25 55"/>' +
    '<path class="npl-filament npl-line-lr" d="M 25 55 L 75 55"/>' +
    '<path class="npl-filament npl-arc-r" d="M 75 55 A 5 5 0 0 0 75 45"/>' +
    '<path class="npl-filament npl-line-rl" d="M 75 45 L 25 45"/>' +
    '<path class="npl-filament npl-arc-l" d="M 25 45 A 5 5 0 0 1 25 35"/>' +
    '</g></g><g class="npl-nozzle">' +
    '<rect x="40" y="15" width="20" height="15" rx="1"/>' +
    '<line x1="38" y1="20" x2="62" y2="20"/><line x1="38" y1="25" x2="62" y2="25"/>' +
    '<polygon points="35,30 65,30 65,42 35,42"/><polygon points="35,42 65,42 53,55 47,55"/>' +
    '</g></svg>';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS;
    (document.head || document.documentElement).appendChild(st);
  }

  // Phase offset so the loop continues from where the previous page left off.
  function phaseDelay() {
    var t0;
    try { t0 = parseInt(sessionStorage.getItem(T0_KEY), 10); } catch (e) {}
    if (!t0) return '0s';
    var elapsed = (Date.now() - t0) % PERIOD_MS;
    return '-' + (elapsed / 1000) + 's';
  }

  function build() {
    var ov = document.createElement('div');
    ov.id = OV_ID;
    ov.innerHTML = '<div class="npl-ico">' + SVG + '</div><div class="npl-cap">Chargement…</div>';
    return ov;
  }

  function paint() {
    ensureStyle();
    var ov = document.getElementById(OV_ID);
    if (!ov) {
      ov = build();
      (document.body || document.documentElement).appendChild(ov);
    }
    ov.style.setProperty('--npl-delay', phaseDelay());
    ov.style.display = 'flex';
    ov.style.opacity = '1';
    return ov;
  }

  function hide() {
    try { sessionStorage.removeItem(T0_KEY); } catch (e) {}
    var ov = document.getElementById(OV_ID);
    if (!ov) return;
    ov.style.opacity = '0';
    setTimeout(function () { if (ov && ov.parentNode) ov.parentNode.removeChild(ov); }, 320);
  }

  // Only actually paints the overlay if it's still pending SHOW_DELAY_MS after
  // being requested — a load/navigation that finishes before then never shows it.
  var showTimer = null;
  var shownAt = null;
  function scheduleShow() {
    if (showTimer || shownAt) return;
    showTimer = setTimeout(function () {
      showTimer = null;
      shownAt = Date.now();
      if (document.body) paint(); else document.addEventListener('DOMContentLoaded', paint);
    }, SHOW_DELAY_MS);
  }
  function cancelPendingShow() {
    if (showTimer) { clearTimeout(showTimer); showTimer = null; }
  }

  ensureStyle();
  scheduleShow();

  // The DC content mounts asynchronously AFTER window 'load'; wait until the app
  // root has actually painted before hiding, so there is no blank flash / pop.
  function contentReady() {
    var root = document.getElementById('dc-root') || document.querySelector('.sc-host') || document.body;
    if (!root) return false;
    var h = 0;
    try { h = root.getBoundingClientRect().height; } catch (e) {}
    return h > 48 && root.textContent.trim().length > 0;
  }
  function finish() {
    cancelPendingShow();
    if (!shownAt) return; // never actually shown — nothing to hide
    var visible = Date.now() - shownAt;
    if (visible < MIN_VISIBLE_MS) { setTimeout(hide, MIN_VISIBLE_MS - visible); return; }
    hide();
  }
  function hideWhenReady() {
    var start = Date.now();
    (function poll() {
      if (Date.now() - start > SAFETY_MS || contentReady()) { finish(); return; }
      requestAnimationFrame(poll);
    })();
  }
  if (document.readyState === 'complete') hideWhenReady();
  else window.addEventListener('load', hideWhenReady);

  // Re-arm when navigating to another site page — stamp the phase so the next
  // page's loader (if it ends up showing at all) continues the same loop
  // instead of restarting. The overlay itself only appears if SHOW_DELAY_MS
  // passes before the browser actually swaps documents.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!/\.dc\.html($|[?#])/.test(href)) return;
    if (a.target === '_blank' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    try { if (!sessionStorage.getItem(T0_KEY)) sessionStorage.setItem(T0_KEY, String(Date.now())); } catch (e2) {}
    scheduleShow();
  }, true);

  // Coming back via the browser's back/forward cache: never stay stuck.
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted) return;
    cancelPendingShow();
    shownAt = null;
    hide();
  });
})();
