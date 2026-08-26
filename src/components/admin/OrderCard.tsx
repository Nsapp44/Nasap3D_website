import { useState } from "react";
import { api } from "../../lib/api-client";
import type { AdminOrder } from "../../hooks/useAdminOrders";

const STATUS_DEFS = [
  { key: "PENDING", label: "Payée" },
  { key: "PRINTING", label: "En impression" },
  { key: "READY", label: "Expédié / Prêt" },
  { key: "DELIVERED", label: "Livré" },
];

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
  const [trackingDraft, setTrackingDraft] = useState(order.trackingNumber || "");

  const needsAcceptance = order.status === "EXPERTISE";
  const isAwaitingPayment = order.status === "AWAITING_PAYMENT";
  const isRejected = order.status === "REJECTED";
  const hasFiles = order.items.some((i) => i.fileName);
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
        <span className="order-price">{(order.totalCents / 100).toFixed(2)} €</span>
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
      </div>

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
