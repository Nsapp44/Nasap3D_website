import { useRef, useState } from "react";
import { api } from "../../lib/api-client";
import type { AdminOrder } from "../../hooks/useAdminOrders";

const STATUS_DEFS = [
  { key: "PENDING", label: "Payée" },
  { key: "PRINTING", label: "En impression" },
  { key: "READY", label: "Expédié / Prêt" },
  { key: "DELIVERED", label: "Livré" },
];

// Real incident: the Stripe webhook can fail to record a real payment (see
// webhooks/stripe.ts), leaving an order stuck in AWAITING_PAYMENT with no
// normal way to advance it — statusOptions below doesn't even show chips
// for that status at all. Scoped to ONLY that one transition on purpose
// (not PENDING/PRINTING/READY too) — those already have working, visible
// status chips with no known bug, so an extra "force" button next to them
// would just be redundant clutter, not a real safety net for anything.
const EMERGENCY_NEXT: Record<string, string> = {
  AWAITING_PAYMENT: "PENDING",
};

// Requested: picking the right one out of 4 status chips (which let you
// jump to ANY of them, including skipping steps — nothing actually stops
// clicking straight from "Payée" to "Livré") wasn't a clear, guided
// workflow. A dedicated "Suivant" button computing the actual next step and
// going through the exact same setOrderStatus() as the chips (so it still
// respects tracking_number_required etc. — unlike EMERGENCY_NEXT above,
// this is not a bypass) sits alongside them rather than replacing them, so
// the chips remain available for the rare case of jumping/correcting.
const NORMAL_NEXT: Record<string, string> = {
  PENDING: "PRINTING",
  PRINTING: "READY",
  READY: "DELIVERED",
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

// Ported from Admin.dc.html's per-order renderVals() mapping + template —
// one order's full card: status chips, file downloads, shipping/pickup
// details, label purchase, tracking number. Kept as a single component
// (not split further) since the original's own structure is already one
// cohesive unit per order, not several independently-reusable pieces.
export default function OrderCard({ order, onChanged }: { order: AdminOrder; onChanged: () => void }) {
  const [labelBusy, setLabelBusy] = useState(false);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [invoiceUploadBusy, setInvoiceUploadBusy] = useState(false);
  const [trackingDraft, setTrackingDraft] = useState(order.trackingNumber || "");
  const invoiceFileInputRef = useRef<HTMLInputElement>(null);

  const needsAcceptance = order.status === "EXPERTISE";
  const isAwaitingPayment = order.status === "AWAITING_PAYMENT";
  const isRejected = order.status === "REJECTED";
  // A paid order (anything past AWAITING_PAYMENT/EXPERTISE/REJECTED) should
  // always end up with an invoice — normally automatic (the webhook, or
  // "Forcer → Payée"'s own auto-generation, see invoiceGenerator.ts), but
  // either can still fail (a transient error, unexpected order data). Without
  // a manual fallback here, that specific order would be stuck with no
  // invoice and no way to fix it short of a direct DB/storage edit.
  const needsInvoiceFallback = !order.hasInvoice && !["EXPERTISE", "AWAITING_PAYMENT", "REJECTED"].includes(order.status);
  const hasFiles = order.items.some((i) => i.fileName);
  // Useful for the workshop while actually printing the parts (picking
  // material/quality/infill/color on the printer) — no longer needed once
  // shipped/delivered, per explicit request, so hidden past that point
  // rather than cluttering the card for every order forever.
  const showPrintSpecs = !["READY", "DELIVERED"].includes(order.status);
  // A small-order-fee line (see computePrice/pricing.ts) is a real
  // OrderItem row but not an actual printed part — confirmed live on a real
  // order: its material/quality/color snapshots are all empty strings,
  // which rendered as an empty, confusing row here before this filter.
  const printableItems = order.items.filter((i) => i.qualitySnapshot);
  const canBuyLabel = order.status === "PRINTING" && order.canBuyLabel && !order.shippingLabelUrl && !order.shippingOversized;
  const hasLabel = !!order.shippingLabelUrl;
  const labelPending = !!order.boxtalOrderRef && !order.shippingLabelUrl;
  const isPickup = order.shippingMode === "PICKUP" && order.status !== "DELIVERED";
  const hasShipping = !!order.shippingMode && order.shippingMode !== "PICKUP" && order.status !== "DELIVERED";
  const hasParcelDims = !!order.shippingParcelLengthCm && !!order.shippingParcelWidthCm && !!order.shippingParcelHeightCm;
  const hasRelayPoint = order.shippingMode === "RELAY" && !!order.relayPointName;
  const showTracking = !!order.shippingMode && order.shippingMode !== "PICKUP" && ["PRINTING", "READY"].includes(order.status);
  const hasTrackingNumber = !!order.trackingNumber;
  const noTrackingNumber = order.status === "PRINTING" && !order.trackingNumber;
  const canCheckTracking = !!order.boxtalOrderRef;
  const statusOptions = ["PENDING", "PRINTING", "READY", "DELIVERED"].includes(order.status) ? STATUS_DEFS : [];
  // One button, not two: same slot, same computed "next" step either way —
  // just the AWAITING_PAYMENT case needs the force+confirm treatment
  // (EMERGENCY_NEXT), everything else advances normally through the exact
  // same setOrderStatus() the chips use (NORMAL_NEXT), guards and all.
  const emergencyNextStatus = EMERGENCY_NEXT[order.status];
  const nextStatus = emergencyNextStatus ?? NORMAL_NEXT[order.status];
  const nextLabel = nextStatus ? (STATUS_DEFS.find((d) => d.key === nextStatus)?.label ?? nextStatus) : "";

  async function advanceStatus() {
    if (!nextStatus) return;
    if (emergencyNextStatus) {
      if (
        !window.confirm(
          `Forcer cette commande à l'étape "${nextLabel}" sans passer par les vérifications normales (paiement confirmé, numéro de suivi) ?\n\nÀ utiliser uniquement en cas de bug confirmé (ex: le webhook Stripe n'a pas marché malgré un paiement réel) — vérifiez d'abord vous-même que c'est bien le cas.`,
        )
      )
        return;
      await api.adminUpdateOrderStatus(order.id, nextStatus, true);
      onChanged();
      return;
    }
    await setOrderStatus(nextStatus);
  }

  async function setOrderStatus(status: string) {
    const res = await api.adminUpdateOrderStatus(order.id, status);
    if (!res.ok) {
      const messages: Record<string, string> = {
        tracking_number_required: "Ajoutez d'abord un numéro de suivi avant de passer cette commande à l'étape Expédié.",
        order_already_delivered: "Cette commande est déjà marquée livrée — impossible de revenir en arrière.",
      };
      const errKey = (res.data as { error?: string } | null)?.error;
      if (errKey && messages[errKey]) window.alert(messages[errKey]);
      return;
    }
    onChanged();
  }

  async function acceptOrder() {
    await api.adminAcceptOrder(order.id);
    onChanged();
  }
  async function rejectOrder() {
    await api.adminRejectOrder(order.id);
    onChanged();
  }
  async function deleteFile(itemId: string) {
    const res = await api.adminDeleteOrderFile(order.id, itemId);
    if (res.ok) onChanged();
  }
  async function buyShippingLabel() {
    if (labelBusy) return;
    if (!window.confirm("Ceci achète réellement une étiquette d'expédition auprès de Boxtal (facturé au compte). Confirmer ?")) return;
    setLabelBusy(true);
    const res = await api.adminBuyShippingLabel(order.id);
    setLabelBusy(false);
    if (!res.ok) {
      const messages: Record<string, string> = {
        label_already_purchased: "Une étiquette a déjà été achetée pour cette commande.",
        missing_shipping_info: "Informations de livraison incomplètes pour cette commande.",
        missing_relay_point: "Aucun point relais enregistré pour cette commande.",
        parcel_oversized: "Pièce hors gabarit (aucun des cartons habituels ne convient) — vérifiez l'emballage et achetez l'étiquette manuellement sur le site Boxtal pour cette commande.",
        boxtal_not_configured: "Boxtal non configuré côté serveur.",
      };
      const data = res.data as { error?: string; reason?: string } | null;
      const msg = data?.error === "boxtal_order_failed" ? "Échec de l'achat auprès de Boxtal : " + (data.reason || "raison inconnue") : (data?.error && messages[data.error]) || "Échec de l'achat de l'étiquette.";
      window.alert(msg);
      return;
    }
    onChanged();
  }
  async function checkShippingLabel() {
    if (labelBusy) return;
    setLabelBusy(true);
    const res = await api.adminCheckShippingLabel(order.id);
    setLabelBusy(false);
    const data = res.data as { autoDelivered?: boolean; shippingLabelUrl?: string; trackingNumber?: string } | null;
    if (res.ok && data?.autoDelivered) {
      onChanged();
      window.alert('Boxtal indique cette commande comme livrée — passée automatiquement à "Livré".');
    } else if (res.ok && data && (data.shippingLabelUrl || data.trackingNumber)) {
      onChanged();
    } else if (res.ok) {
      window.alert("Rien de nouveau chez Boxtal pour l'instant, réessayez plus tard.");
    } else {
      window.alert("Échec de la vérification du statut auprès de Boxtal.");
    }
  }
  async function saveTrackingNumber() {
    const draft = trackingDraft.trim();
    if (!draft || trackingBusy) return;
    setTrackingBusy(true);
    const res = await api.adminSetTrackingNumber(order.id, draft);
    setTrackingBusy(false);
    if (res.ok) onChanged();
    else window.alert("Échec de l'enregistrement du numéro de suivi.");
  }
  async function deleteOrder() {
    if (deleteBusy) return;
    if (
      !window.confirm(
        `Supprimer définitivement la commande ${order.ref} ? Action irréversible.${
          order.hasInvoice ? "\n\nUne facture existe pour cette commande — seul l'enregistrement sera supprimé, pas le PDF déjà généré." : ""
        }`,
      )
    )
      return;
    setDeleteBusy(true);
    const res = await api.adminDeleteOrder(order.id);
    setDeleteBusy(false);
    if (res.ok) onChanged();
    else window.alert("Échec de la suppression de la commande.");
  }
  async function uploadInvoice(file: File) {
    if (invoiceUploadBusy) return;
    setInvoiceUploadBusy(true);
    const res = await api.adminUploadOrderInvoice(order.id, file);
    setInvoiceUploadBusy(false);
    if (invoiceFileInputRef.current) invoiceFileInputRef.current.value = "";
    if (res.ok) onChanged();
    else {
      const errKey = (res.data as { error?: string } | null)?.error;
      const messages: Record<string, string> = {
        invalid_file_type: "Le fichier doit être un PDF.",
        file_too_large: "Fichier trop volumineux (10 Mo max).",
        invoice_already_exists: "Cette commande a déjà une facture.",
      };
      window.alert((errKey && messages[errKey]) || "Échec de l'envoi de la facture.");
    }
  }

  return (
    <div className="order-card">
      <div className="order-head">
        <div>
          <div className="order-title">
            {order.ref} — {order.clientEmail}
          </div>
          <div className="order-desc">
            {order.items.map((i) => `${i.nameSnapshot} · ${i.materialSnapshot} · x${i.qty}`).join(" + ")} · reçu le {fmtDate(order.createdAt)}
          </div>
          <div className="order-customer-no">{order.customerNo}</div>
        </div>
        <div className="order-head-right">
          <span className="order-price">{(order.totalCents / 100).toFixed(2)} €</span>
          <span onClick={deleteOrder} className="btn-close" title="Supprimer cette commande">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </span>
        </div>
      </div>

      <div className="order-status-row">
        <div className="status-chips">
          {statusOptions.map((def) => {
            const active = order.status === def.key;
            const locked = order.status === "DELIVERED";
            const blockedByTracking = def.key === "READY" && !!order.shippingMode && order.shippingMode !== "PICKUP" && !order.trackingNumber;
            const dim = locked || blockedByTracking;
            return (
              <span
                key={def.key}
                onClick={() => setOrderStatus(def.key)}
                className={`status-chip${active ? " active" : ""}${dim ? " dim" : ""}`}
              >
                {def.label}
              </span>
            );
          })}
          {isAwaitingPayment && <span className="hint-text">En attente de paiement du client</span>}
          {isRejected && <span className="hint-text rejected">Refusée — suppression automatique sous 72h</span>}
        </div>
        {needsAcceptance && (
          <div style={{ display: "flex", gap: "8px" }}>
            <span onClick={acceptOrder} className="btn-accept">
              Accepter
            </span>
            <span onClick={rejectOrder} className="btn-reject">
              Refuser
            </span>
          </div>
        )}
        {!needsAcceptance && nextStatus && (
          <span onClick={advanceStatus} className={emergencyNextStatus ? "btn-emergency" : "btn-next"}>
            {emergencyNextStatus ? "🚨 Forcer" : "Suivant"} → {nextLabel}
          </span>
        )}
      </div>

      {order.hasInvoice && (
        <div className="order-section">
          <a href={api.adminOrderInvoiceDownloadUrl(order.id)} target="_blank" rel="noreferrer" className="btn-label">
            Télécharger la facture
          </a>
        </div>
      )}

      {needsInvoiceFallback && (
        <div className="order-section">
          <span onClick={() => invoiceFileInputRef.current?.click()} className="btn-emergency">
            {invoiceUploadBusy ? "Envoi…" : "⚠ Aucune facture — Uploader une facture (PDF)"}
          </span>
          {/* display:none can silently break programmatic .click() on a file
              input in some browsers (confirmed live) — visually hidden via
              near-zero size + clipping instead, same standard pattern as a
              "sr-only" utility class, keeps the element genuinely clickable. */}
          <input
            ref={invoiceFileInputRef}
            type="file"
            accept="application/pdf"
            style={{ position: "absolute", width: "1px", height: "1px", padding: 0, margin: "-1px", overflow: "hidden", clip: "rect(0,0,0,0)", border: 0 }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadInvoice(file);
            }}
          />
        </div>
      )}

      {showPrintSpecs && printableItems.length > 0 && (
        <div className="order-section">
          <div className="section-label">Réglages d'impression</div>
          {printableItems.map((i) => (
            <div key={i.id} className="section-text">
              {i.nameSnapshot} · {i.materialSnapshot} · {i.layerHeightMm !== null ? `${i.layerHeightMm.toFixed(2).replace(".", ",")}mm` : i.qualitySnapshot} · {i.infillSnapshot}% remplissage ·{" "}
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <span
                  style={{
                    display: "inline-block",
                    width: "10px",
                    height: "10px",
                    borderRadius: "50%",
                    background: i.colorHexSnapshot,
                    border: "1px solid rgba(255,255,255,.3)",
                  }}
                />
                {i.colorNameSnapshot}
              </span>{" "}
              · x{i.qty}
            </div>
          ))}
        </div>
      )}

      {hasFiles && (
        <div className="order-section">
          {order.items
            .filter((i) => i.fileName)
            .map((file) => (
              <div key={file.id} className="file-row">
                <span className="file-label">{file.fileName}</span>
                <div style={{ display: "flex", gap: "6px", flex: "none" }}>
                  {file.fileAvailable ? (
                    <>
                      <a href={api.adminOrderFileUrl(order.id, file.id)} className="btn-outline">
                        Télécharger
                      </a>
                      <span onClick={() => deleteFile(file.id)} className="btn-delete">
                        Supprimer
                      </span>
                    </>
                  ) : (
                    <span className="file-gone">Fichier supprimé</span>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {isPickup && (
        <div className="order-section">
          <div className="section-label">Retrait à l'atelier</div>
          <div className="section-text">
            {order.recipientName} · {order.recipientPhone}
          </div>
        </div>
      )}

      {hasShipping && (
        <div className="order-section">
          <div className="section-label">Livraison — {order.shippingLabel}</div>
          <div className="section-text">
            {order.recipientName} · {order.recipientPhone}
            <br />
            {order.recipientAddress}, {order.recipientZipcode} {order.recipientCity}, {order.recipientCountry}
          </div>
          {hasRelayPoint && (
            <div className="section-text" style={{ color: "rgba(255,255,255,.6)", marginTop: "4px" }}>
              Point relais : {order.relayPointName} — {order.relayPointAddress}, {order.relayPointZipcode} {order.relayPointCity}
            </div>
          )}
          {hasParcelDims && (
            <div className="parcel-dims">
              Carton : {order.shippingParcelLengthCm} × {order.shippingParcelWidthCm} × {order.shippingParcelHeightCm} cm
              {order.shippingWeightG ? ` · ${(order.shippingWeightG / 1000).toFixed(2)} kg` : ""}
            </div>
          )}
          {order.shippingOversized && <div className="oversized-warning">⚠ Hors gabarit — carton à vérifier, étiquette à acheter manuellement sur Boxtal</div>}
        </div>
      )}

      {canBuyLabel && (
        <div className="order-section">
          <span onClick={buyShippingLabel} className="btn-outline">
            {labelBusy ? "Achat en cours…" : "Créer l'étiquette"}
          </span>
        </div>
      )}

      {hasLabel && (
        <div className="order-section">
          <a href={api.adminOrderLabelDownloadUrl(order.id)} target="_blank" rel="noreferrer" className="btn-label">
            Télécharger l'étiquette
          </a>
        </div>
      )}

      {labelPending && (
        <div className="order-section" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span className="hint-text">Étiquette en cours de génération…</span>
          <span onClick={checkShippingLabel} className="btn-outline">
            Vérifier
          </span>
        </div>
      )}

      {showTracking && (
        <div className="order-section" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {hasTrackingNumber && <span className="tracking-number">Suivi : {order.trackingNumber}</span>}
          {noTrackingNumber && (
            <>
              <input value={trackingDraft} onChange={(e) => setTrackingDraft(e.target.value)} type="text" placeholder="Numéro de suivi" className="tracking-input" />
              <span onClick={saveTrackingNumber} className="btn-outline">
                {trackingBusy ? "…" : "Enregistrer"}
              </span>
            </>
          )}
          {canCheckTracking && (
            <span onClick={checkShippingLabel} className="btn-outline muted">
              Vérifier auprès de Boxtal
            </span>
          )}
        </div>
      )}
    </div>
  );
}
