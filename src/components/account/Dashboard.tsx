import type { useAccount } from "../../hooks/useAccount";
import { api } from "../../lib/api-client";

type Account = ReturnType<typeof useAccount>;

const STATUS_LABELS: Record<string, string> = {
  EXPERTISE: "Expertise en cours…",
  AWAITING_PAYMENT: "En attente de paiement",
  PENDING: "Payée",
  PRINTING: "En impression",
  READY: "Expédié / Prêt",
  DELIVERED: "Livré",
  // Volontairement pas "Refusée" tout court : le client ne doit pas lire ça
  // comme un jugement définitif sans recours — voir sendOrderRejectedEmail
  // côté serveur pour le même ton.
  REJECTED: "Problème de faisabilité",
};

function statusClass(status: string) {
  if (status === "DELIVERED") return "delivered";
  if (status === "REJECTED") return "rejected";
  return "";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

const ORDER_STEPS = ["Expertise", "Paiement", "Payée", "En impression", "Expédié / Prêt"];
const STEP_IDX: Record<string, number> = { EXPERTISE: 0, AWAITING_PAYMENT: 1, PENDING: 2, PRINTING: 3, READY: 4 };

export default function Dashboard({ account }: { account: Account }) {
  const { activeOrder, orders, invoices, authEmail, customerNo, checkoutNotice, goSettings, logout } = account;
  const activeOrderIsRejected = !!activeOrder && activeOrder.status === "REJECTED";
  const activeOrderIsExpertise = !!activeOrder && activeOrder.status === "EXPERTISE";
  const activeOrderIsAwaitingPayment = !!activeOrder && activeOrder.status === "AWAITING_PAYMENT";
  const activeOrderIsPickup = !!activeOrder && activeOrder.shippingMode === "PICKUP";
  const activeOrderShowsTracking = !!activeOrder && !!activeOrder.shippingMode && activeOrder.shippingMode !== "PICKUP" && !["EXPERTISE", "AWAITING_PAYMENT"].includes(activeOrder.status);
  const stepIdx = activeOrder ? (STEP_IDX[activeOrder.status] ?? 0) : 0;
  const stepProgressPct = ORDER_STEPS.length > 1 ? Math.round((stepIdx / (ORDER_STEPS.length - 1)) * 100) : 0;

  return (
    <div className="dash">
      <div className="dash-head">
        <div>
          <div className="dash-eyebrow">Mon compte</div>
          <div className="dash-email">{authEmail}</div>
          <div className="dash-customer-no">
            N° de client : <span className="customer-no-badge">{customerNo}</span>
          </div>
        </div>
        <div className="dash-head-actions">
          <div onClick={goSettings} className="btn-outline">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
            Réglages
          </div>
          <div onClick={logout} className="btn-outline">
            Se déconnecter
          </div>
        </div>
      </div>

      {checkoutNotice && (
        <div className="checkout-notice">
          <div className="checkout-notice-title">{checkoutNotice === "paid" ? "Paiement confirmé !" : "Paiement annulé"}</div>
          <div className="checkout-notice-body">
            {checkoutNotice === "paid"
              ? "Votre commande est payée, la production va démarrer. Suivez son avancement juste en dessous."
              : "Le paiement n'a pas été finalisé — votre commande reste en attente de paiement, vous pouvez réessayer quand vous le souhaitez."}
          </div>
        </div>
      )}

      <div className="support-notice">
        <span className="support-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </span>
        <div>
          Un souci avec une commande ou une demande d'annulation suite à une erreur ? Passez par le <a href="/contact">formulaire de contact</a> en indiquant le{" "}
          <strong>numéro de commande dans l'objet</strong> de votre demande.
        </div>
      </div>

      {activeOrder && (
        <>
          <div className="section-label">Commande en cours</div>
          <div className="active-order-card">
            <div className="active-order-head">
              <div className="active-order-ref">Commande #{activeOrder.ref}</div>
              <div className="active-order-desc">{activeOrder.items.map((i) => `${i.nameSnapshot} · ${i.materialSnapshot} · x${i.qty}`).join(" + ")}</div>
            </div>

            {activeOrderIsRejected ? (
              <div className="rejected-block">
                <div className="rejected-title">Problème de faisabilité</div>
                Nous ne sommes malheureusement pas en mesure de réaliser cette pièce telle quelle. Aucun paiement n'a été prélevé — contactez-nous par{" "}
                <a href="/contact">mail</a> en indiquant le numéro de commande pour en discuter.
              </div>
            ) : (
              <>
                <div className="step-current-label">
                  Étape actuelle : <span className="step-current-value">{ORDER_STEPS[stepIdx]}</span>
                </div>
                <div className="order-steps-bar">
                  <div className="order-steps-line" style={{ background: `linear-gradient(to right, #ff5a3c 0%, #ff5a3c ${stepProgressPct}%, rgba(255,255,255,.15) ${stepProgressPct}%, rgba(255,255,255,.15) 100%)` }} />
                  <div className="order-steps-row">
                    {ORDER_STEPS.map((label, i) => {
                      const done = i < stepIdx;
                      const active = i === stepIdx;
                      return (
                        <div key={label} className="order-step">
                          <span className={`order-step-dot${done || active ? " on" : ""}`}>{done ? "✓" : i + 1}</span>
                          <span className={`order-step-label${active ? " active" : done ? " done" : ""}`}>{label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
                {activeOrderIsAwaitingPayment && (
                  <div onClick={account.payActiveOrder} className="pay-btn">
                    {account.payBusy ? "Redirection…" : "Payer avec Stripe"}
                  </div>
                )}
                {activeOrderIsExpertise && (
                  <div onClick={() => account.setCancelOrderPopup(true)} className="cancel-order-btn">
                    Annuler la commande
                  </div>
                )}
                {activeOrderShowsTracking && (
                  <div className="tracking-block">
                    {activeOrder.trackingNumber ? (
                      <>
                        Numéro de suivi : <span className="tracking-number">{activeOrder.trackingNumber}</span>
                      </>
                    ) : (
                      "Numéro de suivi pas encore disponible."
                    )}
                  </div>
                )}
                {activeOrderIsPickup && (
                  <div className="pickup-block">
                    Vous récupérez la commande directement à l'atelier, sur rendez-vous : <strong>29 rue Mellier, 44100 Nantes</strong>. Dès que votre pièce est prête, nous vous appelons pour convenir d'un horaire.
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      <div className="section-label">Historique des commandes</div>
      <div className="list-col">
        {orders.map((o) => (
          <div key={o.id} className="list-card">
            <div>
              <div className="list-card-title">{o.ref}</div>
              <div className="list-card-sub">{o.items.map((i) => `${i.nameSnapshot} · ${i.materialSnapshot} · x${i.qty}`).join(" + ")}</div>
              <div className="list-card-sub">{fmtDate(o.createdAt)}</div>
            </div>
            <div className="list-card-right">
              <span className={`status-chip ${statusClass(o.status)}`}>{STATUS_LABELS[o.status] || o.status}</span>
              <span className="list-card-price">{(o.totalCents / 100).toFixed(2)} €</span>
            </div>
          </div>
        ))}
        {orders.length === 0 && <div className="empty-state">Aucune commande pour l'instant.</div>}
      </div>

      <div className="section-label" style={{ marginTop: "36px" }}>
        Factures
      </div>
      <div className="list-col">
        {invoices.map((inv) => (
          <div key={inv.id} className="list-card">
            <div>
              <div className="list-card-title">{inv.ref}</div>
              <div className="list-card-sub">
                Commande {inv.orderRef} · {fmtDate(inv.issuedAt)}
              </div>
            </div>
            <div className="list-card-right">
              <span className="list-card-price">{(inv.amountCents / 100).toFixed(2)} €</span>
              <a href={api.invoicePdfUrl(inv.id)} target="_blank" rel="noreferrer" className="pdf-link">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                  <polyline points="7 10 12 15 17 10"></polyline>
                  <line x1="12" y1="15" x2="12" y2="3"></line>
                </svg>
                PDF
              </a>
            </div>
          </div>
        ))}
        {invoices.length === 0 && <div className="empty-state">Aucune facture pour l'instant.</div>}
      </div>

      <style>{`
        .dash { max-width: 900px; margin: 0 auto; padding: 44px 24px 60px; }
        .dash-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 28px; flex-wrap: wrap; gap: 14px; }
        .dash-eyebrow { font: 600 12px 'Inter',sans-serif; letter-spacing: 1.2px; color: #ff5a3c; text-transform: uppercase; margin-bottom: 8px; }
        .dash-email { font: 700 26px 'Space Grotesk',sans-serif; color: #f3f1ec; }
        .dash-customer-no { font: 400 11px 'Inter',sans-serif; color: rgba(255,255,255,.45); margin-top: 6px; }
        .customer-no-badge { font: 600 11px ui-monospace,monospace; color: #ff5a3c; background: rgba(255,90,60,.1); border-radius: 4px; padding: 2px 8px; }
        .dash-head-actions { display: flex; gap: 10px; }
        .btn-outline { display: flex; align-items: center; gap: 7px; border: 1px solid rgba(255,255,255,.2); color: #f3f1ec; font: 500 12px 'Inter',sans-serif; padding: 9px 14px; border-radius: 6px; cursor: pointer; transition: border-color .2s ease; }
        .btn-outline:hover { border-color: #ff5a3c; }
        .checkout-notice { border: 1px solid rgba(255,90,60,.35); background: rgba(255,90,60,.1); border-radius: 10px; padding: 16px 18px; margin-bottom: 20px; }
        .checkout-notice-title { font: 600 12.5px 'Inter',sans-serif; color: #f3f1ec; margin-bottom: 4px; }
        .checkout-notice-body { font: 400 11.5px/1.6 'Inter',sans-serif; color: rgba(255,255,255,.65); }
        .support-notice { border: 1px solid rgba(255,90,60,.3); background: rgba(255,90,60,.06); border-radius: 10px; padding: 15px 18px; margin-bottom: 32px; display: flex; gap: 12px; align-items: flex-start; font: 400 11.5px/1.6 'Inter',sans-serif; color: rgba(255,255,255,.6); }
        .support-notice a { color: #ff5a3c; }
        .support-notice strong { color: #f3f1ec; font-weight: 600; }
        .support-icon { color: #ff5a3c; flex: none; margin-top: 1px; }
        .section-label { font: 600 11.5px 'Inter',sans-serif; color: #ff5a3c; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 14px; }
        .active-order-card { border: 1px solid rgba(255,255,255,.1); border-radius: 12px; background: #1a1917; padding: 24px; margin-bottom: 36px; }
        .active-order-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; flex-wrap: wrap; gap: 6px; }
        .active-order-ref { font: 600 13px 'Space Grotesk',sans-serif; color: #f3f1ec; }
        .active-order-desc { font: 400 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.45); }
        .rejected-block { margin-top: 14px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.08); font: 400 11.5px/1.6 'Inter',sans-serif; color: rgba(255,255,255,.65); }
        .rejected-block a { color: #ff5a3c; }
        .rejected-title { font: 600 12px 'Inter',sans-serif; color: #ff8a70; margin-bottom: 6px; }
        .step-current-label { font: 500 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.5); margin-bottom: 14px; }
        .step-current-value { color: #f3f1ec; font-weight: 600; }
        .order-steps-bar { position: relative; padding: 0 13px; }
        .order-steps-line { position: absolute; left: 13px; right: 13px; top: 13px; height: 2px; margin-top: -1px; }
        .order-steps-row { display: flex; justify-content: space-between; position: relative; z-index: 1; }
        .order-step { display: flex; flex-direction: column; align-items: center; gap: 6px; }
        .order-step-dot { width: 26px; height: 26px; border-radius: 50%; text-align: center; font: 700 11px/26px 'Inter',sans-serif; background: #2a2826; color: rgba(255,255,255,.5); }
        .order-step-dot.on { background: #ff5a3c; color: #161514; }
        .order-step-label { font: 600 10px 'Inter',sans-serif; color: rgba(255,255,255,.4); text-align: center; }
        .order-step-label.done { color: rgba(255,255,255,.7); }
        .order-step-label.active { color: #f3f1ec; }
        .pay-btn { margin-top: 18px; background: #635bff; color: #fff; font: 600 12.5px 'Inter',sans-serif; padding: 11px; border-radius: 7px; text-align: center; cursor: pointer; transition: transform .2s ease; }
        .pay-btn:hover { transform: scale(1.02); }
        .cancel-order-btn { margin-top: 18px; border: 1px solid rgba(255,255,255,.2); color: #f3f1ec; font: 500 11px 'Inter',sans-serif; padding: 9px 14px; border-radius: 6px; cursor: pointer; text-align: center; transition: border-color .2s ease; }
        .cancel-order-btn:hover { border-color: #ff5a3c; }
        .tracking-block { margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.08); font: 400 11px 'Inter',sans-serif; color: rgba(255,255,255,.55); }
        .tracking-number { color: #f3f1ec; font-weight: 600; font-family: ui-monospace,monospace; }
        .pickup-block { margin-top: 18px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,.08); font: 400 11px/1.6 'Inter',sans-serif; color: rgba(255,255,255,.55); }
        .pickup-block strong { color: #e8e6e1; }
        .list-col { display: flex; flex-direction: column; gap: 10px; }
        .list-card { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; padding: 16px 18px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
        .list-card-title { font: 600 12px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 3px; }
        .list-card-sub { font: 400 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.45); }
        .list-card-right { display: flex; align-items: center; gap: 16px; }
        .list-card-price { font: 700 13px 'Space Grotesk',sans-serif; color: #f3f1ec; white-space: nowrap; }
        .status-chip { font: 600 10px 'Inter',sans-serif; color: #ff5a3c; background: rgba(255,90,60,.12); border-radius: 5px; padding: 4px 9px; }
        .status-chip.delivered { color: #8fd19e; background: rgba(143,209,158,.12); }
        .status-chip.rejected { color: #ff8a70; background: rgba(255,138,112,.12); }
        .pdf-link, .pdf-link:hover { text-decoration: none; }
        .pdf-link { display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(255,255,255,.2); color: #f3f1ec; font: 600 10.5px 'Inter',sans-serif; padding: 7px 12px; border-radius: 6px; cursor: pointer; transition: border-color .2s ease, color .2s ease; }
        .pdf-link:hover { border-color: #ff5a3c; color: #ff5a3c; }
        .empty-state { border: 1px dashed rgba(255,255,255,.15); border-radius: 10px; padding: 24px; text-align: center; font: 500 12px 'Inter',sans-serif; color: rgba(255,255,255,.4); }
      `}</style>
    </div>
  );
}
