import { useQuoteEnabledCached } from "../hooks/useQuoteEnabled";

// The "Devis instantané" nav link, hidden while the workshop is paused
// (Settings.quoteEnabled=false) — ported from Home.dc.html's
// NAV_ITEMS.filter(item => item.key !== 'devis' || this.state.quoteEnabled).
// A real island (not plain Header.astro markup) since quoteEnabled is only
// known client-side; every other page previously just left this link up
// permanently regardless of pause state, which is the bug being fixed here.
//
// Trusts the cache only (see useQuoteEnabledCached) — this link appears on
// every page, but the actual configurator only lives on Home and
// /devis-instantane; those pages do the real check (QuoteWizardSection),
// this one just reflects whatever they last found.
export default function QuoteNavLink({ isCurrent }: { isCurrent: boolean }) {
  const quoteEnabled = useQuoteEnabledCached();
  if (!quoteEnabled) return null;
  return isCurrent ? (
    <span className="nav-current nav-hover-scale n3d-quote-gate">Devis instantané</span>
  ) : (
    <a href="/devis-instantane" className="nav-hover-scale n3d-quote-gate">
      Devis instantané
    </a>
  );
}
