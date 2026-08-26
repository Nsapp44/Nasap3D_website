import { useQuoteEnabled } from "../../hooks/useQuoteEnabled";
import QuoteWizard from "./QuoteWizard";

// Gates the configurator behind the server-authoritative quoteEnabled flag
// (see useQuoteEnabled) — the paused message replaces the whole wizard,
// same as Devis Instantane.dc.html's quotePaused/quoteEnabled sc-if pair.
export default function QuoteWizardSection() {
  const { quoteEnabled } = useQuoteEnabled();

  if (!quoteEnabled) {
    return (
      <div className="quote-paused">
        <div className="quote-paused-icon">🛠️</div>
        <div>
          <div className="quote-paused-title">Devis instantané momentanément indisponible</div>
          <div className="quote-paused-text">
            L'atelier est en pause (congés / maintenance). Le configurateur rouvrira très vite — en attendant, décrivez votre projet via le <a href="/contact">formulaire de contact</a> et nous vous répondons dès le retour.
          </div>
        </div>
        <style>{`
          .quote-paused { border: 1px solid rgba(255,90,60,.3); background: rgba(255,90,60,.08); border-radius: 12px; padding: 30px 28px; display: flex; align-items: center; gap: 20px; }
          .quote-paused-icon { font-size: 32px; flex: none; }
          .quote-paused-title { font: 700 17px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 6px; }
          .quote-paused-text { font: 400 12px/1.6 'Inter',sans-serif; color: rgba(255,255,255,.6); max-width: 640px; }
          .quote-paused-text a { color: #ff5a3c; }
        `}</style>
      </div>
    );
  }

  return <QuoteWizard />;
}
