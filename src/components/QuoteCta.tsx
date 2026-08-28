import { useQuoteEnabledCached } from "../hooks/useQuoteEnabled";

// A "get an instant quote" button that swaps to a "contact us instead"
// fallback while the workshop is paused, wherever this CTA appears outside
// Home/Devis Instantane themselves (Services, the local-SEO pages, the
// empty cart state) — those pages never tracked quoteEnabled at all in the
// old framework, so this button stayed up (and broken) during a pause
// everywhere except Home's own hero. Reusing the same className keeps each
// call site's existing button styling.
//
// Trusts the cache only (see useQuoteEnabledCached) — the real check
// happens on Home/devis-instantane (QuoteWizardSection), not here. Not
// pre-paint-gated like QuoteNavLink/HomeHeader (see .n3d-quote-gate in
// global.css): this swaps between two different CTAs rather than
// showing/hiding one, so a wrong initial guess here reads as a label
// change, not the same "text pops in then vanishes" flash — not the
// reported symptom, not worth the added complexity of gating both branches.
export default function QuoteCta({ className, label = "Obtenir un devis instantané →" }: { className: string; label?: string }) {
  const quoteEnabled = useQuoteEnabledCached();
  return quoteEnabled ? (
    <a href="/devis-instantane" className={className}>
      {label}
    </a>
  ) : (
    <a href="/contact" className={className}>
      Nous contacter →
    </a>
  );
}
