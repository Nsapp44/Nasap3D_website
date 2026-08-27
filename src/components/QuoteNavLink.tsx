import { useQuoteEnabled } from "../hooks/useQuoteEnabled";
import PrinterLoaderIcon from "./PrinterLoaderIcon";

// The "Devis instantané" nav link, hidden while the workshop is paused
// (Settings.quoteEnabled=false) — ported from Home.dc.html's
// NAV_ITEMS.filter(item => item.key !== 'devis' || this.state.quoteEnabled).
// A real island (not plain Header.astro markup) since quoteEnabled is only
// known client-side; every other page previously just left this link up
// permanently regardless of pause state, which is the bug being fixed here.
export default function QuoteNavLink({ isCurrent }: { isCurrent: boolean }) {
  const { quoteEnabled, loading } = useQuoteEnabled();
  // A brief, honest "we don't know yet" instead of guessing — see
  // useQuoteEnabled's own comment. Only ever visible on a visitor's
  // first-ever page this session; every page after that already has the
  // real answer cached, before this even renders.
  if (loading) {
    return (
      <span style={{ display: "inline-flex", width: 15, height: 15, color: "rgba(255,255,255,.5)" }}>
        <PrinterLoaderIcon maskId="plMaskNavQuote" />
      </span>
    );
  }
  if (!quoteEnabled) return null;
  return isCurrent ? (
    <span className="nav-current nav-hover-scale">Devis instantané</span>
  ) : (
    <a href="/devis-instantane" className="nav-hover-scale">
      Devis instantané
    </a>
  );
}
