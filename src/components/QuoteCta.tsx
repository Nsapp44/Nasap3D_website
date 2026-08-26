import { useQuoteEnabled } from "../hooks/useQuoteEnabled";

// A "get an instant quote" button that swaps to a "contact us instead"
// fallback while the workshop is paused, wherever this CTA appears outside
// Home/Devis Instantane themselves (Services, the local-SEO pages, the
// empty cart state) — those pages never tracked quoteEnabled at all in the
// old framework, so this button stayed up (and broken) during a pause
// everywhere except Home's own hero. Reusing the same className keeps each
// call site's existing button styling.
export default function QuoteCta({ className, label = "Obtenir un devis instantané →" }: { className: string; label?: string }) {
  const { quoteEnabled } = useQuoteEnabled();
  return quoteEnabled ? (
    <a href="/devis-instantane" className={`${className} n3d-quote-gate`}>
      {label}
    </a>
  ) : (
    <a href="/contact" className={className}>
      Nous contacter →
    </a>
  );
}
