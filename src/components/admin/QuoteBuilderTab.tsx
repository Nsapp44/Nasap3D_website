import { useEffect, useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { api } from "../../lib/api-client";
import { useAdminMaterials } from "../../hooks/useAdminMaterials";
import { QuoteDocument, type QuotePdfData } from "./QuoteDocument";
// Pure function, no DB/network access (see its own file) — same discount
// math the real instant-devis cart uses (src/lib/server/cart.ts), reused
// here rather than re-implemented so a manual devis quantity discount can
// never silently drift from what a real online order would get.
import { discountForQty } from "../../lib/server/pricing";

// Full descriptive text printed on the PDF differs from the short label
// shown in the dropdown for two of these (the admin's own words, verbatim).
// Only "Impression 3D" carries the filament/couleur/qualité/remplissage
// fields — the other three are flat-priced services with nothing else to
// configure.
const SERVICE_TYPES = [
  { key: "retroconception", shortLabel: "Rétro-conception", pdfLabel: "Rétro-conception de votre pièce selon le modèle fourni", isPrint: false },
  { key: "impression3d", shortLabel: "Impression 3D", pdfLabel: "Impression 3D", isPrint: true },
  { key: "maintenance", shortLabel: "Maintenance machine", pdfLabel: "Maintenance machine", isPrint: false },
  { key: "modelisation", shortLabel: "Modélisation 3D", pdfLabel: "Modélisation 3D de votre projet suite aux différents échanges", isPrint: false },
] as const;

interface QuoteLineItem {
  id: string;
  shortLabel: string;
  pdfLabel: string;
  isPrint: boolean;
  materialLabel?: string;
  colorName?: string;
  colorHex?: string;
  qualityLabel?: string;
  infill?: string;
  detail?: string | null;
  // Only meaningful (asked for/shown) on an Impression 3D line — printed on
  // the devis as "×N" so the client sees how many identical pieces the line
  // covers, and drives the automatic quantity discount below.
  quantity?: number;
  // Quantity-tier discount auto-applied on print lines (same tiers/logic as
  // the real instant-devis cart, see discountForQty) — set only when > 0.
  // priceCents below is always the REAL final total (post-discount, what's
  // actually charged/printed); preDiscountCents is what the admin typed
  // (the pre-discount amount), kept so editing the line restores the typed
  // value rather than the already-discounted one.
  discountPct?: number;
  preDiscountCents?: number;
  priceCents: number;
}

function parseEuros(input: string): number | null {
  const cents = Math.round(parseFloat(input.replace(",", ".")) * 100);
  return Number.isFinite(cents) ? cents : null;
}
function eur(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + " €";
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function fmtLayerHeight(mm: number): string {
  return `${mm.toFixed(2).replace(".", ",")}mm`;
}

// The catalog's color names are the real spool/product names (English,
// as sold) — used as-is everywhere else in the site (client configurator,
// admin stock tab, order specs), since that's what actually appears on the
// filament packaging. Translated to French only for display in this devis
// builder (dropdown + printed PDF), per request — doesn't touch the
// underlying MaterialColor data, so nothing else in the app is affected.
// Falls back to the original English name for anything not in this map
// (a new catalog color added later) rather than showing nothing.
const COLOR_NAME_FR: Record<string, string> = {
  Beige: "Beige",
  Black: "Noir",
  "Black (CF)": "Noir (fibre carbone)",
  Blue: "Bleu",
  Bronze: "Bronze",
  Brown: "Marron",
  Charcoal: "Anthracite",
  "Cobalt Blue": "Bleu cobalt",
  Cyan: "Cyan",
  "Dark Red": "Rouge foncé",
  Gold: "Or",
  "Grass Green": "Vert gazon",
  Gray: "Gris",
  "Gray (CF)": "Gris (fibre carbone)",
  Green: "Vert",
  "Ice Blue": "Bleu glacier",
  "Jade White": "Blanc jade",
  "Lime Green": "Vert citron",
  Magenta: "Magenta",
  "Maroon Red": "Rouge bordeaux",
  "Mistletoe Green": "Vert gui",
  Natural: "Naturel",
  "Navy Blue": "Bleu marine",
  Orange: "Orange",
  "Peanut Brown": "Marron cacahuète",
  Pink: "Rose",
  Purple: "Violet",
  Red: "Rouge",
  Silver: "Argent",
  "Tangerine Yellow": "Jaune mandarine",
  "Translucent Teal": "Sarcelle translucide",
  Turquoise: "Turquoise",
  White: "Blanc",
  Yellow: "Jaune",
};
function colorNameFr(en: string): string {
  return COLOR_NAME_FR[en] || en;
}

// No persistence anywhere in this tab, by design (per the request this was
// built from): no DB table, no API write, nothing saved server-side. Every
// field below lives only in this component's local state, and the PDF is
// rendered straight in the browser (pdf(...).toBlob(), see @react-pdf's
// browser build — same @react-pdf/renderer package already used server-side
// for the real invoice, just its browser entry point instead of Node's)
// then handed to the admin as a native download. Once that download
// happens, nothing about this devis exists anywhere except on the admin's
// own machine — a mistake means composing a new one and downloading again,
// not editing/canceling something that was never stored.
export default function QuoteBuilderTab() {
  const { materials } = useAdminMaterials(true);
  const [qualities, setQualities] = useState<{ key: string; label: string; layerHeightMm: number }[]>([]);
  const [discountTiers, setDiscountTiers] = useState<{ minQty: number; pct: number }[]>([]);

  useEffect(() => {
    api.getQualityProfiles().then((res) => {
      if (res.ok && res.data) setQualities(res.data.qualities);
    });
    api.getDiscountTiers().then((res) => {
      if (res.ok && res.data) setDiscountTiers(res.data.tiers);
    });
  }, []);

  const [clientName, setClientName] = useState("");
  const [items, setItems] = useState<QuoteLineItem[]>([]);

  const [serviceKey, setServiceKey] = useState<(typeof SERVICE_TYPES)[number]["key"]>(SERVICE_TYPES[0].key);
  const [materialId, setMaterialId] = useState("");
  const [colorId, setColorId] = useState("");
  const [qualityKey, setQualityKey] = useState("");
  const [infillDraft, setInfillDraft] = useState("");
  const [quantityDraft, setQuantityDraft] = useState("1");
  const [priceDraft, setPriceDraft] = useState("");

  // Set while modifying an existing prestation instead of adding a new one
  // (see startEdit/cancelEdit below) — per request, an admin who mistyped a
  // detail on a line they already added shouldn't have to delete it and
  // recompose it from scratch.
  const [editingId, setEditingId] = useState<string | null>(null);

  const service = SERVICE_TYPES.find((s) => s.key === serviceKey)!;
  const selectedMaterial = materials.find((m) => m.id === materialId);

  // Couleur resets whenever the admin picks a different filament — an old
  // selection from a different filament's color list would otherwise
  // silently linger as a stale, invalid colorId. Deliberately wired into
  // the <select>'s own onChange rather than a useEffect(watch materialId):
  // startEdit() below also calls setMaterialId (to restore a prestation
  // being edited) immediately followed by setColorId with the real color to
  // restore — a materialId-watching effect would run after both and wipe
  // that restored colorId right back out, since it can't tell "the admin
  // just changed filament" apart from "materialId changed as part of
  // loading a whole prestation back into the form".
  function handleMaterialChange(id: string) {
    setMaterialId(id);
    setColorId("");
  }

  const quantity = parseInt(quantityDraft, 10);
  const canAdd =
    parseEuros(priceDraft) !== null &&
    parseEuros(priceDraft)! >= 0 &&
    (!service.isPrint || (materialId && colorId && qualityKey && Number.isInteger(quantity) && quantity >= 1));

  // Live preview of the automatic quantity discount while composing/editing
  // a print line — same tiers/formula as the real instant-devis cart
  // (discountForQty), so "10 pièces" here gives the same -X% a real online
  // order of 10 would get. Only ever applies to Impression 3D lines, never
  // to the devis as a whole — a rétro-conception/maintenance/modélisation
  // line next to it is untouched.
  const previewDiscountPct =
    service.isPrint && Number.isInteger(quantity) && quantity >= 1 ? discountForQty(quantity, discountTiers) : 0;
  // The specific tier that produced previewDiscountPct, just to show "dès
  // combien de pièces" in the preview below — discountForQty itself only
  // returns the percentage, not which threshold it came from.
  const previewTierMinQty =
    previewDiscountPct > 0
      ? discountTiers.filter((t) => t.pct === previewDiscountPct).reduce((min, t) => Math.min(min, t.minQty), Infinity)
      : null;
  const previewPreDiscountCents = parseEuros(priceDraft);
  const previewNetCents =
    previewPreDiscountCents !== null ? Math.round(previewPreDiscountCents * (1 - previewDiscountPct / 100)) : null;

  // Shared by both "+ Ajouter la prestation" and "Enregistrer les
  // modifications" — editingId (set by startEdit) decides whether this
  // replaces an existing line in place or appends a new one.
  function saveItem() {
    const preDiscountCents = parseEuros(priceDraft);
    if (preDiscountCents === null || preDiscountCents < 0) return;
    if (service.isPrint && (!materialId || !colorId || !qualityKey || !Number.isInteger(quantity) || quantity < 1)) return;

    // Only print lines ever carry a quantity discount — a rétro-conception/
    // maintenance/modélisation line always charges exactly what's typed.
    const discountPct = service.isPrint ? discountForQty(quantity, discountTiers) : 0;
    const priceCents = Math.round(preDiscountCents * (1 - discountPct / 100));

    let detail: string | null = null;
    let materialLabel: string | undefined;
    let colorName: string | undefined;
    let colorHex: string | undefined;
    let qualityLabel: string | undefined;

    if (service.isPrint) {
      const material = materials.find((m) => m.id === materialId);
      const color = material?.colors.find((c) => c.id === colorId);
      const quality = qualities.find((q) => q.key === qualityKey);
      materialLabel = material?.label;
      colorName = color ? colorNameFr(color.colorName) : undefined;
      colorHex = color?.colorHex;
      qualityLabel = quality ? `${quality.label} (${fmtLayerHeight(quality.layerHeightMm)})` : undefined;
      const parts = [qualityLabel, infillDraft.trim() ? `${infillDraft.trim()}% remplissage` : null].filter(Boolean);
      detail = parts.length > 0 ? parts.join(" · ") : null;
    }

    const newItem: QuoteLineItem = {
      id: editingId ?? Math.random().toString(36).slice(2),
      shortLabel: service.shortLabel,
      pdfLabel: service.pdfLabel,
      isPrint: service.isPrint,
      materialLabel,
      colorName,
      colorHex,
      qualityLabel,
      infill: infillDraft.trim() || undefined,
      quantity: service.isPrint ? quantity : undefined,
      discountPct: discountPct > 0 ? discountPct : undefined,
      preDiscountCents: discountPct > 0 ? preDiscountCents : undefined,
      detail,
      priceCents,
    };

    setItems((prev) => (editingId ? prev.map((it) => (it.id === editingId ? newItem : it)) : [...prev, newItem]));

    resetForm();
  }

  // Resets the form for the next prestation, service type included — an
  // admin composing a devis with several different services shouldn't have
  // to manually reset filament/couleur/qualité each time. Also exits edit
  // mode, whether called after saving an edit or via "Annuler".
  function resetForm() {
    setEditingId(null);
    setServiceKey(SERVICE_TYPES[0].key);
    setMaterialId("");
    setColorId("");
    setQualityKey("");
    setInfillDraft("");
    setQuantityDraft("1");
    setPriceDraft("");
  }

  // Loads an existing prestation's fields back into the form above instead
  // of making the admin delete it and recompose it from scratch — per
  // request, editing a prestation shouldn't have to mean removing it first.
  function startEdit(item: QuoteLineItem) {
    const matchedService = SERVICE_TYPES.find((s) => s.pdfLabel === item.pdfLabel && s.isPrint === item.isPrint) ?? SERVICE_TYPES[0];
    setEditingId(item.id);
    setServiceKey(matchedService.key);
    setQuantityDraft(String(item.quantity ?? 1));
    setInfillDraft(item.infill ?? "");
    // Restores what was actually typed (pre-discount), not the already-
    // discounted priceCents — otherwise re-saving an edited discounted line
    // unchanged would apply the discount a second time on top of itself.
    setPriceDraft(((item.preDiscountCents ?? item.priceCents) / 100).toFixed(2).replace(".", ","));
    if (item.isPrint) {
      const material = materials.find((m) => m.label === item.materialLabel);
      setMaterialId(material?.id ?? "");
      const color = material?.colors.find((c) => colorNameFr(c.colorName) === item.colorName);
      setColorId(color?.id ?? "");
      const quality = qualities.find((q) => item.qualityLabel?.startsWith(q.label));
      setQualityKey(quality?.key ?? "");
    } else {
      setMaterialId("");
      setColorId("");
      setQualityKey("");
    }
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    // A "Supprimer" on the very line being edited must also drop out of
    // edit mode — otherwise "Enregistrer les modifications" would silently
    // resurrect the line the admin just removed.
    if (editingId === id) resetForm();
  }

  const totalCents = useMemo(() => items.reduce((sum, it) => sum + it.priceCents, 0), [items]);

  const [generating, setGenerating] = useState(false);

  async function createQuotePdf() {
    if (items.length === 0) return;
    setGenerating(true);
    try {
      const now = new Date();
      // Real day-based sequence, not a timestamp guess — see
      // adminNextQuoteRef's own comment for exactly what this endpoint does
      // and doesn't persist. Falls back to "001" if the call fails so a
      // transient network hiccup doesn't block generating the PDF outright.
      const seqRes = await api.adminNextQuoteRef();
      const dailySeq = seqRes.ok && seqRes.data ? seqRes.data.dailySeq : 1;
      const dd = pad(now.getDate());
      const mm = pad(now.getMonth() + 1);
      const yyyy = now.getFullYear();
      const ref = `DEV_${String(dailySeq).padStart(3, "0")}_${dd}${mm}${yyyy}`;
      const data: QuotePdfData = {
        ref,
        issuedAt: now,
        clientName: clientName.trim() || null,
        items: items.map((it) => ({
          label: it.pdfLabel,
          material: it.materialLabel,
          detail: it.detail,
          colorHex: it.colorHex,
          colorName: it.colorName,
          priceCents: it.priceCents,
          isPrint: it.isPrint,
          quantity: it.quantity,
          discountPct: it.discountPct,
          preDiscountCents: it.preDiscountCents,
        })),
        totalCents,
      };
      const blob = await pdf(<QuoteDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ref}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="quote-tab">
      <div className="eyebrow">Devis</div>
      <div className="title">Créer un devis</div>

      <div className="pricing-card">
        <div className="pricing-title">Informations</div>
        <div className="pricing-row">
          <div className="pricing-field">
            <span className="field-label">Client (optionnel)</span>
            <input value={clientName} onChange={(e) => setClientName(e.target.value)} className="field-input wide" placeholder="Nom / société" />
          </div>
        </div>
      </div>

      <div className="pricing-card">
        <div className="pricing-title">{editingId ? "Modifier la prestation" : "Ajouter une prestation"}</div>
        <div className="add-grid">
          <div className="form-field">
            <span className="field-label">Prestation</span>
            <select value={serviceKey} onChange={(e) => setServiceKey(e.target.value as typeof serviceKey)} className="admin-select">
              {SERVICE_TYPES.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.shortLabel}
                </option>
              ))}
            </select>
          </div>

          {service.isPrint && (
            <>
              <div className="form-field">
                <span className="field-label">Filament</span>
                <select value={materialId} onChange={(e) => handleMaterialChange(e.target.value)} className="admin-select">
                  <option value="">Choisir...</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <span className="field-label">Couleur</span>
                <select value={colorId} onChange={(e) => setColorId(e.target.value)} className="admin-select" disabled={!selectedMaterial}>
                  <option value="">Choisir...</option>
                  {selectedMaterial?.colors.map((c) => (
                    <option key={c.id} value={c.id}>
                      {colorNameFr(c.colorName)}
                      {c.inStock ? "" : " (rupture)"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <span className="field-label">Qualité</span>
                <select value={qualityKey} onChange={(e) => setQualityKey(e.target.value)} className="admin-select">
                  <option value="">Choisir...</option>
                  {qualities.map((q) => (
                    <option key={q.key} value={q.key}>
                      {q.label} ({fmtLayerHeight(q.layerHeightMm)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <span className="field-label">Remplissage (%)</span>
                <input value={infillDraft} onChange={(e) => setInfillDraft(e.target.value)} className="field-input" placeholder="20" />
              </div>
              <div className="form-field">
                <span className="field-label">Quantité de pièces</span>
                <input
                  value={quantityDraft}
                  onChange={(e) => setQuantityDraft(e.target.value)}
                  className="field-input"
                  placeholder="1"
                  inputMode="numeric"
                />
              </div>
            </>
          )}

          <div className="form-field">
            <span className="field-label">{service.isPrint ? "Prix TTC (avant remise)" : "Prix TTC"}</span>
            <input value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} className="field-input" placeholder="0,00 €" />
          </div>
        </div>

        {service.isPrint && previewDiscountPct > 0 && previewNetCents !== null && (
          <div className="discount-preview">
            Remise quantité automatique : <strong>-{previewDiscountPct}%</strong> (dès {previewTierMinQty} pièces) → total net{" "}
            <strong>{eur(previewNetCents)}</strong>
          </div>
        )}

        <div className="form-actions">
          <span onClick={canAdd ? saveItem : undefined} className={`save-btn add-btn${canAdd ? "" : " disabled"}`}>
            {editingId ? "Enregistrer les modifications" : "+ Ajouter la prestation"}
          </span>
          {editingId && (
            <span onClick={resetForm} className="cancel-edit-btn">
              Annuler
            </span>
          )}
        </div>
      </div>

      <div className="quote-items">
        {items.length === 0 && <div className="empty-orders">Aucune prestation ajoutée pour l'instant.</div>}
        {items.map((it) => (
          <div key={it.id} className={`order-card${editingId === it.id ? " editing" : ""}`}>
            <div className="order-head">
              <div>
                <div className="order-title">
                  {it.shortLabel}
                  {it.isPrint && it.quantity && it.quantity > 1 ? ` ×${it.quantity}` : ""}
                </div>
                {it.isPrint && (
                  <div className="order-desc">
                    {it.materialLabel} · {it.qualityLabel}
                    {it.infill ? ` · ${it.infill}% remplissage` : ""} · {it.colorName}
                    {it.discountPct ? ` · remise -${it.discountPct}%` : ""}
                  </div>
                )}
              </div>
              <div className="order-head-right">
                {it.discountPct && it.preDiscountCents ? (
                  <span className="order-price-discounted">
                    <span className="order-price-before">{eur(it.preDiscountCents)}</span>
                    <span className="order-price">{eur(it.priceCents)}</span>
                  </span>
                ) : (
                  <span className="order-price">{eur(it.priceCents)}</span>
                )}
                <span className="btn-edit" onClick={() => startEdit(it)} title="Modifier">
                  ✎
                </span>
                <span className="btn-close" onClick={() => removeItem(it.id)} title="Supprimer">
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

      <span onClick={items.length > 0 && !generating ? createQuotePdf : undefined} className={`save-btn generate-btn${items.length > 0 && !generating ? "" : " disabled"}`}>
        {generating ? "Génération..." : "Créer le devis"}
      </span>

      <style>{`
        .quote-tab { max-width: 1000px; margin: 0 auto; padding: 44px 24px 60px; }
        .eyebrow { font: 600 12px 'Inter',sans-serif; letter-spacing: 1.2px; color: #ff5a3c; text-transform: uppercase; margin-bottom: 10px; }
        .title { font: 700 26px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 28px; }
        .pricing-card { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; padding: 18px 20px; margin-bottom: 20px; }
        .pricing-title { font: 600 12.5px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 14px; }
        .pricing-row { display: flex; gap: 28px; flex-wrap: wrap; }
        .pricing-field { display: flex; align-items: center; gap: 8px; }
        .field-label { font: 400 10px 'Inter',sans-serif; color: rgba(255,255,255,.4); }
        .field-input { width: 90px; box-sizing: border-box; height: 32px; border: 1px solid rgba(255,255,255,.15); border-radius: 5px; background: #161514; padding: 0 10px; font: 11.5px 'Inter',sans-serif; color: #e8e6e1; outline: none; }
        .field-input.wide { width: 260px; }
        .admin-select { width: 200px; box-sizing: border-box; height: 32px; border: 1px solid rgba(255,255,255,.15); border-radius: 5px; background: #161514; padding: 0 10px; font: 11.5px 'Inter',sans-serif; color: #e8e6e1; outline: none; }
        .admin-select:disabled { opacity: .4; cursor: not-allowed; }
        .add-grid { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
        .form-field { display: flex; flex-direction: column; gap: 6px; }
        .save-btn { font: 600 11px 'Inter',sans-serif; padding: 9px 16px; border-radius: 6px; cursor: pointer; background: #ff5a3c; color: #161514; display: inline-block; }
        .save-btn.disabled { opacity: .35; cursor: not-allowed; }
        .add-btn { font-size: 11px; }
        .discount-preview { font: 500 11px 'Inter',sans-serif; color: #ff8a70; background: rgba(255,90,60,.08); border: 1px solid rgba(255,90,60,.25); border-radius: 6px; padding: 8px 12px; margin-bottom: 16px; }
        .discount-preview strong { color: #ff5a3c; }
        .order-price-discounted { display: flex; flex-direction: column; align-items: flex-end; line-height: 1.3; }
        .order-price-before { font: 400 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.4); text-decoration: line-through; }
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
        .btn-edit:hover { border-color: rgba(255,90,60,.5); color: #ff8a70; background: rgba(255,90,60,.08); }
        .btn-close:hover { border-color: rgba(255,90,60,.5); color: #ff8a70; background: rgba(255,90,60,.08); }
        .quote-total-row { display: flex; align-items: center; justify-content: space-between; margin-top: 16px; padding: 14px 20px; border-radius: 10px; background: #1a1917; border: 1px solid rgba(255,255,255,.1); font: 600 13px 'Space Grotesk',sans-serif; color: #f3f1ec; }
        .quote-total-value { color: #ff5a3c; font-size: 16px; }

        @media (max-width: 640px) {
          .add-grid { flex-direction: column; }
          .admin-select, .field-input.wide { width: 100%; }
        }
      `}</style>
    </div>
  );
}
