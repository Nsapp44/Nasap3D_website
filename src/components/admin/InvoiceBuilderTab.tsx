import { useCallback, useEffect, useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { api, type ManualInvoiceCreated, type ManualInvoiceInput, type ManualInvoiceListItem } from "../../lib/api-client";
import { QuoteDocument, type QuotePdfData } from "./QuoteDocument";

// Même interface que QuoteBuilderTab (devis) — lignes de prestation simples
// (titre / description / quantité / prix unitaire TTC), sans remise quantité
// ni calcul matière. Contrairement au devis, la facture est ÉMISE côté
// serveur : le serveur attribue ref, date et total (numérotation légale), le
// PDF est rendu ici à partir de SA réponse, puis renvoyé au serveur. Une
// facture émise ne se modifie ni ne se supprime.
const SERVICE_TYPES = [
  { key: "retroconception", shortLabel: "Rétro-conception", pdfLabel: "Rétro-conception de votre pièce selon le modèle fourni" },
  { key: "impression3d", shortLabel: "Impression 3D", pdfLabel: "Impression 3D" },
  { key: "maintenance", shortLabel: "Maintenance machine", pdfLabel: "Maintenance machine" },
  { key: "modelisation", shortLabel: "Modélisation 3D", pdfLabel: "Modélisation 3D de votre projet suite aux différents échanges" },
  { key: "libre", shortLabel: "Ligne libre (texte libre)", pdfLabel: "" },
] as const;
const CUSTOM_KEY = "libre";

interface InvoiceLine {
  id: string;
  title: string;
  description?: string;
  quantity: number;
  unitPriceCents: number;
}

function parseEuros(input: string): number | null {
  const cents = Math.round(parseFloat(input.replace(",", ".")) * 100);
  return Number.isFinite(cents) ? cents : null;
}
function eur(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}
function fmtDate(value: string | Date): string {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("fr-FR");
}
function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

export default function InvoiceBuilderTab() {
  const [clientName, setClientName] = useState("");
  const [billingAddress, setBillingAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [items, setItems] = useState<InvoiceLine[]>([]);

  const [serviceKey, setServiceKey] = useState<(typeof SERVICE_TYPES)[number]["key"]>(SERVICE_TYPES[0].key);
  const [quantityDraft, setQuantityDraft] = useState("1");
  const [priceDraft, setPriceDraft] = useState("");
  const [titleDraft, setTitleDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const service = SERVICE_TYPES.find((s) => s.key === serviceKey)!;
  const isCustom = serviceKey === CUSTOM_KEY;
  const quantity = parseInt(quantityDraft, 10);
  const validQty = Number.isInteger(quantity) && quantity >= 1;
  const unitCents = parseEuros(priceDraft);
  const canAdd = unitCents !== null && unitCents >= 0 && validQty && (!isCustom || !!titleDraft.trim());

  function resetForm() {
    setEditingId(null);
    setServiceKey(SERVICE_TYPES[0].key);
    setQuantityDraft("1");
    setPriceDraft("");
    setTitleDraft("");
    setDescDraft("");
  }

  function saveItem() {
    if (!canAdd || unitCents === null) return;
    const line: InvoiceLine = {
      id: editingId ?? Math.random().toString(36).slice(2),
      title: isCustom ? titleDraft.trim() : service.pdfLabel,
      description: descDraft.trim() || undefined,
      quantity,
      unitPriceCents: unitCents,
    };
    setItems((prev) => (editingId ? prev.map((it) => (it.id === editingId ? line : it)) : [...prev, line]));
    resetForm();
  }

  function startEdit(item: InvoiceLine) {
    const matched = SERVICE_TYPES.find((s) => s.key !== CUSTOM_KEY && s.pdfLabel === item.title);
    setEditingId(item.id);
    setServiceKey(matched ? matched.key : CUSTOM_KEY);
    setTitleDraft(matched ? "" : item.title);
    setDescDraft(item.description ?? "");
    setQuantityDraft(String(item.quantity));
    setPriceDraft((item.unitPriceCents / 100).toFixed(2).replace(".", ","));
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (editingId === id) resetForm();
  }

  const totalCents = useMemo(() => items.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0), [items]);

  // --- Liste des factures émises ---
  const [issued, setIssued] = useState<ManualInvoiceListItem[]>([]);
  const [listState, setListState] = useState<"loading" | "ok" | "error">("loading");
  const loadList = useCallback(async () => {
    const res = await api.adminListManualInvoices();
    if (res.ok && res.data) {
      setIssued(res.data);
      setListState("ok");
    } else {
      setListState("error");
    }
  }, []);
  useEffect(() => {
    loadList();
  }, [loadList]);

  // --- Émission ---
  const [issuing, setIssuing] = useState(false);
  const [issueError, setIssueError] = useState<string | null>(null);
  const [emitted, setEmitted] = useState<{ id: string; ref: string; email: string } | null>(null);
  const [mailTo, setMailTo] = useState("");
  const [sending, setSending] = useState(false);
  const [sendMsg, setSendMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const emailOk = clientEmail.trim() === "" || isEmail(clientEmail);
  const canIssue = items.length > 0 && clientName.trim() !== "" && billingAddress.trim() !== "" && emailOk && !issuing;

  function download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function issueInvoice() {
    if (!canIssue || issuing) return;
    setIssuing(true);
    setIssueError(null);
    setSendMsg(null);
    try {
      const payload: ManualInvoiceInput = {
        clientName: clientName.trim(),
        billingAddress: billingAddress.trim(),
        deliveryAddress: deliveryAddress.trim() || undefined,
        clientEmail: clientEmail.trim() || undefined,
        items: items.map((it) => ({
          title: it.title,
          description: it.description,
          quantity: it.quantity,
          unitPriceCents: it.unitPriceCents,
        })),
      };
      const res = await api.adminCreateManualInvoice(payload);
      if (!res.ok || !res.data) {
        setIssueError(
          res.status === 0
            ? "Facture non émise : le serveur ne répond pas. Vérifiez votre connexion puis réessayez."
            : "Facture non émise : le serveur a refusé la demande. Vérifiez les champs puis réessayez.",
        );
        return;
      }
      const created: ManualInvoiceCreated = res.data;

      // PDF construit à partir de la RÉPONSE du serveur (ref, date, total officiels), pas du formulaire.
      const data: QuotePdfData = {
        ref: created.ref,
        issuedAt: new Date(created.issuedAt),
        clientName: created.clientName,
        billingAddress: created.billingAddress,
        deliveryAddress: created.deliveryAddress || null,
        docType: "facture",
        items: created.items.map((it) => ({
          label: it.title,
          material: it.description || null,
          unitPriceCents: it.unitPriceCents,
          quantity: it.quantity,
          priceCents: it.quantity * it.unitPriceCents,
        })),
        totalCents: created.totalCents,
      };
      const blob = await pdf(<QuoteDocument data={data} />).toBlob();
      const up = await api.adminUploadManualInvoicePdf(created.id, blob);
      download(blob, `${created.ref}.pdf`);
      setEmitted({ id: created.id, ref: created.ref, email: created.clientEmail ?? "" });
      setMailTo(created.clientEmail ?? "");
      if (!up.ok) {
        setSendMsg({
          ok: false,
          text: "Facture émise et téléchargée, mais le PDF n'a pas pu être enregistré sur le serveur : l'envoi par e-mail peut échouer. Conservez le PDF téléchargé.",
        });
      }
      // Le formulaire se vide : la facture est émise, rien ne s'édite plus.
      setClientName("");
      setBillingAddress("");
      setDeliveryAddress("");
      setClientEmail("");
      setItems([]);
      resetForm();
      loadList();
    } catch {
      setIssueError("Facture non émise ou PDF non généré : une erreur est survenue. Consultez la liste « Factures émises » avant de réessayer pour éviter un doublon.");
    } finally {
      setIssuing(false);
    }
  }

  async function sendByEmail() {
    if (!emitted || sending || !isEmail(mailTo)) return;
    if (!window.confirm(`Envoyer la facture ${emitted.ref} à ${mailTo.trim()} ?\n\nL'e-mail part immédiatement et ne peut pas être rappelé.`)) return;
    setSending(true);
    setSendMsg(null);
    const res = await api.adminSendManualInvoice(emitted.id, mailTo.trim());
    setSending(false);
    if (res.ok) {
      setSendMsg({ ok: true, text: `Facture ${emitted.ref} envoyée à ${mailTo.trim()}.` });
      loadList();
    } else {
      setSendMsg({ ok: false, text: "Envoi échoué : l'e-mail n'est pas parti. Vérifiez l'adresse puis réessayez." });
    }
  }

  return (
    <div className="quote-tab">
      <div className="eyebrow">Factures</div>
      <div className="title">Facture</div>

      {emitted && (
        <div className="emitted-card" role="status">
          <div className="emitted-title">Facture {emitted.ref} émise</div>
          <div className="emitted-hint">Le PDF a été téléchargé. Vous pouvez aussi l'envoyer au client.</div>
          <div className="emitted-row">
            <input
              type="email"
              value={mailTo}
              onChange={(e) => setMailTo(e.target.value)}
              className="field-input wide"
              placeholder="e-mail du client"
              aria-label="E-mail du client"
            />
            <span
              role="button"
              tabIndex={0}
              onClick={sendByEmail}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && sendByEmail()}
              className={`save-btn${isEmail(mailTo) && !sending ? "" : " disabled"}`}
              aria-disabled={!isEmail(mailTo) || sending}
            >
              {sending ? "Envoi…" : "Envoyer au client par e-mail"}
            </span>
          </div>
          {sendMsg && <div className={sendMsg.ok ? "msg-ok" : "msg-err"}>{sendMsg.text}</div>}
        </div>
      )}

      <div className="pricing-card">
        <div className="pricing-title">Informations</div>
        <div className="pricing-row">
          <div className="pricing-field info">
            <label className="field-label" htmlFor="inv-client">Client</label>
            <input id="inv-client" value={clientName} onChange={(e) => setClientName(e.target.value)} className="field-input wide" placeholder="Nom / société" />
          </div>
        </div>
        <div className="pricing-row">
          <div className="pricing-field info">
            <label className="field-label" htmlFor="inv-billing">Adresse de facturation</label>
            <textarea
              id="inv-billing"
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              className="field-input wide"
              rows={4}
              placeholder="Rue, code postal, ville, pays (une ligne par info)"
            />
          </div>
        </div>
        <div className="pricing-row">
          <div className="pricing-field info">
            <label className="field-label" htmlFor="inv-delivery">Adresse de livraison (optionnel)</label>
            <textarea
              id="inv-delivery"
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              className="field-input wide"
              rows={4}
              placeholder="Attn : prénom nom, société, adresse, pays (une ligne par info)"
            />
          </div>
        </div>
        <div className="pricing-row">
          <div className="pricing-field info">
            <label className="field-label" htmlFor="inv-email">E-mail du client (optionnel)</label>
            <input id="inv-email" type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} className="field-input wide" placeholder="client@exemple.fr" />
          </div>
        </div>
        {!emailOk && <div className="msg-err">Adresse e-mail invalide : corrigez-la ou videz le champ.</div>}
      </div>

      <div className="pricing-card">
        <div className="pricing-title">{editingId ? "Modifier la prestation" : "Ajouter une prestation"}</div>
        <div className="add-grid">
          <div className="form-field">
            <label className="field-label" htmlFor="inv-service">Prestation</label>
            <select id="inv-service" value={serviceKey} onChange={(e) => setServiceKey(e.target.value as typeof serviceKey)} className="admin-select">
              {SERVICE_TYPES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.shortLabel}
                </option>
              ))}
            </select>
          </div>

          {isCustom && (
            <div className="form-field">
              <label className="field-label" htmlFor="inv-title">Titre</label>
              <input id="inv-title" value={titleDraft} onChange={(e) => setTitleDraft(e.target.value)} className="field-input wide" placeholder="Ex : Transport vers Marlborough" />
            </div>
          )}
          <div className="form-field">
            <label className="field-label" htmlFor="inv-desc">{isCustom ? "Description (optionnel)" : "Précision (optionnel)"}</label>
            <input
              id="inv-desc"
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              className="field-input wide"
              placeholder={isCustom ? "Détail affiché sous le titre" : "Ex : nom de la pièce, précision"}
            />
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="inv-qty">Quantité</label>
            <input id="inv-qty" value={quantityDraft} onChange={(e) => setQuantityDraft(e.target.value)} className="field-input" placeholder="1" inputMode="numeric" />
          </div>
          <div className="form-field">
            <label className="field-label" htmlFor="inv-price">Prix unitaire TTC</label>
            <input id="inv-price" value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} className="field-input" placeholder="0,00 €" inputMode="decimal" />
          </div>
        </div>

        {unitCents !== null && validQty && quantity > 1 && (
          <div className="discount-preview">
            Total de la ligne : <strong>{eur(unitCents * quantity)}</strong> ({quantity} × {eur(unitCents)})
          </div>
        )}

        <div className="form-actions">
          <span
            role="button"
            tabIndex={0}
            onClick={canAdd ? saveItem : undefined}
            onKeyDown={(e) => canAdd && (e.key === "Enter" || e.key === " ") && saveItem()}
            aria-disabled={!canAdd}
            className={`save-btn add-btn${canAdd ? "" : " disabled"}`}
          >
            {editingId ? "Enregistrer les modifications" : "+ Ajouter la prestation"}
          </span>
          {editingId && (
            <span role="button" tabIndex={0} onClick={resetForm} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && resetForm()} className="cancel-edit-btn">
              Annuler
            </span>
          )}
        </div>
      </div>

      <div className="quote-items">
        {items.length === 0 && <div className="empty-orders">Aucune prestation ajoutée pour l'instant. Ajoutez-en une ci-dessus pour pouvoir émettre la facture.</div>}
        {items.map((it) => (
          <div key={it.id} className={`order-card${editingId === it.id ? " editing" : ""}`}>
            <div className="order-head">
              <div>
                <div className="order-title">
                  {it.title}
                  {it.quantity > 1 ? ` ×${it.quantity}` : ""}
                </div>
                {it.description && <div className="order-desc">{it.description}</div>}
                {it.quantity > 1 && (
                  <div className="order-desc">
                    {it.quantity} × {eur(it.unitPriceCents)}
                  </div>
                )}
              </div>
              <div className="order-head-right">
                <span className="order-price">{eur(it.quantity * it.unitPriceCents)}</span>
                <span className="btn-edit" role="button" tabIndex={0} aria-label="Modifier la prestation" onClick={() => startEdit(it)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && startEdit(it)} title="Modifier">
                  ✎
                </span>
                <span className="btn-close" role="button" tabIndex={0} aria-label="Supprimer la prestation" onClick={() => removeItem(it.id)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && removeItem(it.id)} title="Supprimer">
                  ✕
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length > 0 && (
        <div className="quote-total-row">
          <span>Total TTC</span>
          <span className="quote-total-value">{eur(totalCents)}</span>
        </div>
      )}

      {issueError && <div className="msg-err" role="alert" style={{ marginTop: 16 }}>{issueError}</div>}
      {items.length > 0 && (clientName.trim() === "" || billingAddress.trim() === "") && (
        <div className="msg-hint">Renseignez le client et l'adresse de facturation pour émettre la facture.</div>
      )}

      <span
        role="button"
        tabIndex={0}
        onClick={canIssue ? issueInvoice : undefined}
        onKeyDown={(e) => canIssue && (e.key === "Enter" || e.key === " ") && issueInvoice()}
        aria-disabled={!canIssue}
        className={`save-btn generate-btn${canIssue ? "" : " disabled"}`}
      >
        {issuing ? "Émission en cours…" : "Émettre la facture"}
      </span>

      <div className="pricing-title issued-title">Factures émises</div>
      {listState === "loading" && <div className="empty-orders">Chargement des factures…</div>}
      {listState === "error" && <div className="msg-err" role="alert">Impossible de charger les factures émises. Rechargez la page ; si cela continue, contactez le développeur.</div>}
      {listState === "ok" && issued.length === 0 && <div className="empty-orders">Aucune facture émise pour l'instant.</div>}
      {listState === "ok" && issued.length > 0 && (
        <div className="quote-items">
          {issued.map((inv) => {
            const sent = !!inv.sentAt;
            return (
              <div key={inv.id} className="order-card">
                <div className="order-head">
                  <div>
                    <div className="order-title">{inv.ref}</div>
                    <div className="order-desc">
                      {inv.clientName} · {fmtDate(inv.issuedAt)} · {sent ? "Envoyée au client" : "Non envoyée"}
                    </div>
                  </div>
                  <div className="order-head-right">
                    <span className="order-price">{eur(inv.totalCents)}</span>
                    <a className="dl-link" href={api.adminManualInvoicePdfUrl(inv.id)} download>
                      Télécharger le PDF
                    </a>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        .quote-tab { max-width: 1000px; margin: 0 auto; padding: 44px 24px 60px; }
        .eyebrow { font: 600 12px 'Inter',sans-serif; letter-spacing: 1.2px; color: #ff5a3c; text-transform: uppercase; margin-bottom: 10px; }
        .title { font: 700 26px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 28px; }
        .pricing-card { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; padding: 18px 20px; margin-bottom: 20px; }
        .pricing-title { font: 600 12.5px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 14px; }
        .issued-title { margin-top: 44px; }
        .pricing-row { display: flex; gap: 28px; flex-wrap: wrap; }
        .pricing-row + .pricing-row { margin-top: 18px; }
        .pricing-field { display: flex; align-items: center; gap: 8px; }
        .pricing-field.info { gap: 16px; align-items: flex-start; }
        .pricing-field.info .field-label { width: 170px; flex: none; padding-top: 10px; }
        .pricing-field.info .admin-select, .pricing-field.info .field-input { margin-top: 0; }
        .field-label { font: 400 10px 'Inter',sans-serif; color: rgba(255,255,255,.4); }
        .field-input { width: 90px; box-sizing: border-box; height: 32px; border: 1px solid rgba(255,255,255,.15); border-radius: 5px; background: #161514; padding: 0 10px; font: 11.5px 'Inter',sans-serif; color: #e8e6e1; outline: none; }
        textarea.field-input { height: auto; padding: 8px 10px; resize: vertical; }
        .field-input.wide { width: 260px; }
        .admin-select { width: 200px; box-sizing: border-box; height: 32px; border: 1px solid rgba(255,255,255,.15); border-radius: 5px; background: #161514; padding: 0 10px; font: 11.5px 'Inter',sans-serif; color: #e8e6e1; outline: none; }
        .field-input:focus-visible, .admin-select:focus-visible, .save-btn:focus-visible, .btn-edit:focus-visible, .btn-close:focus-visible, .cancel-edit-btn:focus-visible, .dl-link:focus-visible { outline: 2px solid #ff5a3c; outline-offset: 2px; }
        .add-grid { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
        .form-field { display: flex; flex-direction: column; gap: 6px; }
        .save-btn { font: 600 11px 'Inter',sans-serif; padding: 9px 16px; border-radius: 6px; cursor: pointer; background: #ff5a3c; color: #161514; display: inline-block; }
        .save-btn.disabled { opacity: .35; cursor: not-allowed; }
        .add-btn { font-size: 11px; }
        .discount-preview { font: 500 11px 'Inter',sans-serif; color: #ff8a70; background: rgba(255,90,60,.08); border: 1px solid rgba(255,90,60,.25); border-radius: 6px; padding: 8px 12px; margin-bottom: 16px; }
        .discount-preview strong { color: #ff5a3c; }
        .form-actions { display: flex; align-items: center; gap: 14px; }
        .cancel-edit-btn { font: 600 11px 'Inter',sans-serif; color: rgba(255,255,255,.5); cursor: pointer; }
        .cancel-edit-btn:hover { color: #f3f1ec; }
        .generate-btn { margin-top: 22px; font-size: 12.5px; padding: 12px 22px; }
        .quote-items { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
        .empty-orders { border: 1px dashed rgba(255,255,255,.15); border-radius: 10px; padding: 34px; text-align: center; font: 500 12px 'Inter',sans-serif; color: rgba(255,255,255,.4); }
        .order-card { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; padding: 16px 20px; }
        .order-card.editing { border-color: rgba(255,90,60,.5); background: rgba(255,90,60,.06); }
        .order-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .order-head-right { flex: none; display: flex; align-items: center; gap: 10px; }
        .order-title { font: 600 13px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 3px; }
        .order-desc { font: 400 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.45); }
        .order-price { flex: none; font: 700 14px 'Space Grotesk',sans-serif; color: #ff5a3c; white-space: nowrap; }
        .btn-edit, .btn-close { flex: none; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid rgba(255,255,255,.15); color: rgba(255,255,255,.45); cursor: pointer; font-size: 11px; }
        .btn-edit:hover, .btn-close:hover { border-color: rgba(255,90,60,.5); color: #ff8a70; background: rgba(255,90,60,.08); }
        .quote-total-row { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding: 14px 20px; border-radius: 10px; background: #1a1917; border: 1px solid rgba(255,255,255,.1); font: 600 13px 'Space Grotesk',sans-serif; color: #f3f1ec; }
        .quote-total-value { color: #ff5a3c; font-size: 16px; }
        .emitted-card { border: 1px solid rgba(255,90,60,.5); border-radius: 10px; background: rgba(255,90,60,.06); padding: 18px 20px; margin-bottom: 20px; }
        .emitted-title { font: 700 15px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 4px; }
        .emitted-hint { font: 400 11px 'Inter',sans-serif; color: rgba(255,255,255,.6); margin-bottom: 14px; }
        .emitted-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
        .msg-ok { font: 500 11.5px 'Inter',sans-serif; color: #8fd9a8; margin-top: 12px; }
        .msg-err { font: 500 11.5px 'Inter',sans-serif; color: #ff8a70; margin-top: 12px; }
        .msg-hint { font: 400 11px 'Inter',sans-serif; color: rgba(255,255,255,.5); margin-top: 12px; }
        .dl-link { font: 600 11px 'Inter',sans-serif; color: #ff8a70; text-decoration: underline; white-space: nowrap; }

        @media (max-width: 640px) {
          .add-grid { flex-direction: column; }
          .admin-select, .field-input.wide { width: 100%; }
          .pricing-field.info { flex-direction: column; gap: 6px; width: 100%; }
          .pricing-field.info .field-label { width: auto; padding-top: 0; }
        }
      `}</style>
    </div>
  );
}
