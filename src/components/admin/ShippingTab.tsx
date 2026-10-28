import { useEffect, useState } from "react";
import { api, type ShippingBoxStock } from "../../lib/api-client";

const HELP_ITEMS = [
  "5 cartons karton.eu : S, M et L en simple cannelure (6 kg maximum), XL et XXL en double cannelure (prévus pour 30 kg, limités à 25 kg par colis : limite Mondial Relay et locker). Au-delà de 25 kg, le site répartit la commande sur plusieurs colis.",
  "Au panier, le site range automatiquement les pièces : le moins de colis possible, puis les plus petits cartons. Le client voit un seul prix (somme des tarifs Boxtal des colis + 1,50 € d'emballage par colis).",
  "Le carton indiqué est un format maximum : un carton plus petit convient si les pièces y rentrent.",
  "Point Relais si tous les colis sont en S, M, L ou XL. Locker seulement en S, M ou L. Un colis XXL : Colissimo seul.",
  "Étiquettes : un achat Boxtal par commande, un seul bordereau PDF qui contient les étiquettes de tous les colis, et un numéro de suivi par colis (séparés par des virgules).",
  "Pièce trop grande pour le XXL (cas rare : les machines impriment 30 × 30 cm au maximum) : « Expédition » est grisée au panier, le client ne peut choisir que le retrait à l'atelier et voit pourquoi.",
  "Remise en main propre : après paiement, passer la commande en « En impression » puis « Livré » (pas de numéro de suivi nécessaire).",
  "Le stock ne baisse pas tout seul : ajustez-le à la main avec + et −.",
];

export default function ShippingTab() {
  const [boxes, setBoxes] = useState<ShippingBoxStock[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Carton dont l'enregistrement est en cours : ses boutons attendent la réponse (pas de clics qui se chevauchent).
  const [busyCode, setBusyCode] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.adminGetShippingBoxes().then((res) => {
      if (cancelled) return;
      if (res.ok && res.data) setBoxes(res.data);
      else setLoadError(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function changeQty(code: string, delta: number) {
    if (!boxes) return;
    const current = boxes.find((b) => b.code === code);
    if (!current) return;
    const next = current.qty + delta;
    if (next < 0 || busyCode) return;
    setBusyCode(code);
    setMessage(null);
    const previous = current.qty;
    setBoxes((list) => (list ? list.map((b) => (b.code === code ? { ...b, qty: next } : b)) : list));
    const res = await api.adminSetShippingBoxQty(code, next);
    if (!res.ok) {
      setBoxes((list) => (list ? list.map((b) => (b.code === code ? { ...b, qty: previous } : b)) : list));
      setMessage(`Le stock du carton ${code} n'a pas pu être enregistré : la quantité est revenue à ${previous}. Réessayez.`);
    }
    setBusyCode(null);
  }

  const fmt = (d: readonly number[]) => d.join(" × ");
  const mmToCm = (d: readonly number[]) => d.map((v) => Math.round(v) / 10);

  return (
    <div className="ship-tab">
      <div className="ship-eyebrow">Logistique</div>
      <div className="ship-title">Expédition</div>

      <details className="ship-help">
        <summary>Comment ça marche ?</summary>
        <ol>
          {HELP_ITEMS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ol>
      </details>

      <div className="ship-status" role="status" aria-live="polite">
        {message && <div className="ship-error">{message}</div>}
        {loadError && <div className="ship-error">Impossible de charger les cartons. Rechargez la page.</div>}
      </div>

      {!boxes && !loadError && <div className="ship-loading">Chargement des cartons…</div>}

      <div className="ship-list">
        {boxes?.map((b) => (
          <div key={b.code} className={`ship-card${b.qty === 0 ? " empty" : ""}`}>
            <div className="ship-card-main">
              <div className="ship-card-head">
                <span className="ship-name">Carton {b.code}</span>
                {b.qty === 0 && <span className="ship-alert">À racheter</span>}
              </div>
              <div className="ship-specs">
                <span>Intérieur : {fmt(mmToCm(b.innerMm))} cm</span>
                <span>Extérieur : {fmt(b.outerCm)} cm</span>
                <span>Charge max : {b.maxWeightG / 1000} kg</span>
                <span>{b.karton.flute === "double" ? "Double cannelure" : "Simple cannelure"}</span>
                <span>{b.lockerOk ? "Relais + locker" : b.relayOk ? "Relais OK, pas de locker" : "Colissimo seulement"}</span>
              </div>
              <a className="ship-buy" href={b.karton.url} target="_blank" rel="noopener noreferrer">
                Acheter sur karton.eu
              </a>
            </div>
            <div className="ship-qty" role="group" aria-label={`Stock du carton ${b.code}`}>
              <button type="button" className="ship-btn" aria-label={`Retirer un carton ${b.code} du stock`} disabled={b.qty <= 0 || busyCode === b.code} onClick={() => changeQty(b.code, -1)}>
                −
              </button>
              <span className="ship-qty-value" aria-live="polite">
                {b.qty}
              </span>
              <button type="button" className="ship-btn" aria-label={`Ajouter un carton ${b.code} au stock`} disabled={busyCode === b.code} onClick={() => changeQty(b.code, 1)}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <style>{`
        .ship-tab { max-width: 1000px; margin: 0 auto; padding: 44px 24px 60px; color: #f3f1ec; }
        .ship-eyebrow { font: 600 12px 'Inter',sans-serif; letter-spacing: 1.2px; color: #ff5a3c; text-transform: uppercase; margin-bottom: 10px; }
        .ship-title { font: 700 26px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 24px; }
        .ship-help { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; padding: 0 20px; margin-bottom: 20px; }
        .ship-help summary { cursor: pointer; padding: 14px 0; min-height: 20px; font: 600 12.5px 'Space Grotesk',sans-serif; color: #f3f1ec; }
        .ship-help summary:focus-visible { outline: 2px solid #ff5a3c; outline-offset: 2px; border-radius: 4px; }
        .ship-help ol { margin: 0; padding: 0 0 16px 18px; font: 400 11.5px/1.6 'Inter',sans-serif; color: rgba(255,255,255,.7); }
        .ship-help li { margin-bottom: 6px; }
        .ship-status { min-height: 0; }
        .ship-error { border: 1px solid rgba(255,90,60,.35); background: rgba(255,90,60,.08); color: #ff8a70; border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; font: 500 11.5px/1.5 'Inter',sans-serif; }
        .ship-loading { font: 500 12px 'Inter',sans-serif; color: rgba(255,255,255,.5); padding: 20px 0; }
        .ship-list { display: flex; flex-direction: column; gap: 10px; }
        .ship-card { display: flex; align-items: center; justify-content: space-between; gap: 20px; border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; padding: 16px 20px; animation: ship-in .5s ease both; }
        .ship-card.empty { border-color: rgba(255,90,60,.35); }
        .ship-card-main { min-width: 0; flex: 1; }
        .ship-card-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; flex-wrap: wrap; }
        .ship-name { font: 700 15px 'Space Grotesk',sans-serif; color: #f3f1ec; }
        .ship-alert { font: 700 9.5px 'Inter',sans-serif; letter-spacing: .5px; text-transform: uppercase; padding: 4px 8px; border-radius: 5px; background: rgba(255,90,60,.18); color: #ff8a70; }
        .ship-specs { display: flex; flex-wrap: wrap; gap: 4px 18px; font: 400 11px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.65); font-variant-numeric: tabular-nums; margin-bottom: 8px; }
        .ship-buy { display: inline-flex; align-items: center; min-height: 32px; font: 600 11px 'Inter',sans-serif; color: #ff8a70; text-decoration: underline; }
        .ship-buy:focus-visible { outline: 2px solid #ff5a3c; outline-offset: 2px; border-radius: 3px; }
        .ship-qty { display: flex; align-items: center; gap: 12px; flex: none; }
        .ship-qty-value { min-width: 32px; text-align: center; font: 700 18px 'Space Grotesk',sans-serif; color: #f3f1ec; font-variant-numeric: tabular-nums; }
        .ship-btn { width: 40px; height: 40px; border-radius: 8px; border: 1px solid rgba(255,255,255,.2); background: #201d1b; color: #f3f1ec; font: 600 20px 'Inter',sans-serif; line-height: 1; cursor: pointer; transition: background .2s ease, border-color .2s ease; }
        .ship-btn:hover:not(:disabled) { border-color: #ff5a3c; background: rgba(255,90,60,.12); }
        .ship-btn:focus-visible { outline: 2px solid #ff5a3c; outline-offset: 2px; }
        .ship-btn:disabled { opacity: .35; cursor: not-allowed; }
        @keyframes ship-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @media (prefers-reduced-motion: reduce) {
          .ship-card { animation: none; }
          .ship-btn { transition: none; }
        }
        @media (max-width: 640px) {
          .ship-tab { padding: 32px 16px 48px; }
          .ship-card { flex-direction: column; align-items: stretch; gap: 14px; padding: 14px 16px; }
          .ship-qty { justify-content: flex-start; }
          .ship-buy { min-height: 40px; }
          .ship-btn { width: 44px; height: 44px; }
        }
      `}</style>
    </div>
  );
}
