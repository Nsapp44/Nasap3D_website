// Nav guard — while the admin "mode vacances" (instant quote) is OFF, hides the
// quote-related navigation (Devis instantané links/buttons + Cart) on every page,
// and restores them when it is turned back ON.
//
// Implemented with a single class toggled on <html> + one !important stylesheet,
// so it NEVER overwrites an element's own inline styles (an earlier version set
// element.style.display directly, which wiped the components' display:flex).
(function () {
  var KEY = 'nasap3d_quote_enabled_v1';
  var CLS = 'nasap-vacation';
  var STYLE_ID = 'nasap-navguard-style';

  function enabled() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw !== null) return raw === 'true';
    } catch (e) {}
    return true;
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    // Chemins propres (/devis-instantane, /panier) — les hrefs littéraux en
    // .dc.html ont été retirés de toutes les pages, ces sélecteurs ne
    // matchaient donc plus rien depuis ce changement.
    st.textContent =
      'html.' + CLS + ' a[href="/devis-instantane"],' +
      'html.' + CLS + ' a[href="/panier"],' +
      'html.' + CLS + ' [data-quote-nav]{display:none !important}';
    (document.head || document.documentElement).appendChild(st);
  }

  function apply() {
    ensureStyle();
    document.documentElement.classList.toggle(CLS, !enabled());
  }

  apply();
  window.addEventListener('nasap3d-quote-changed', apply);
  window.addEventListener('storage', function (e) { if (e.key === KEY) apply(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);
})();
