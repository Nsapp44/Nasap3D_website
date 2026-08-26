import { useQuoteEnabled } from "../hooks/useQuoteEnabled";

// The "Devis instantané" nav link, hidden while the workshop is paused
// (Settings.quoteEnabled=false) — ported from Home.dc.html's
// NAV_ITEMS.filter(item => item.key !== 'devis' || this.state.quoteEnabled).
// A real island (not plain Header.astro markup) since quoteEnabled is only
// known client-side; every other page previously just left this link up
// permanently regardless of pause state, which is the bug being fixed here.
export default function QuoteNavLink({ isCurrent }: { isCurrent: boolean }) {
  // quoteEnabled defaults to true (optimistic) until the real check
  // resolves, same as the original — shows immediately, only disappears if
  // actually confirmed paused, instead of flashing hidden on every load.
  const { quoteEnabled } = useQuoteEnabled();
  if (!quoteEnabled) return null;
  return isCurrent ? (
    <span className="nav-current nav-hover-scale">Devis instantané</span>
  ) : (
    <a href="/devis-instantane" className="nav-hover-scale">
      Devis instantané
    </a>
  );
}
