import { useEffect, useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { api } from "../../lib/api-client";
import { useAdminMaterials } from "../../hooks/useAdminMaterials";
import { QuoteDocument, type QuotePdfData } from "./QuoteDocument";

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

  useEffect(() => {
    api.getQualityProfiles().then((res) => {
      if (res.ok && res.data) setQualities(res.data.qualities);
    });
  }, []);

  const [clientName, setClientName] = useState("");
  const [items, setItems] = useState<QuoteLineItem[]>([]);

  const [serviceKey, setServiceKey] = useState<(typeof SERVICE_TYPES)[number]["key"]>(SERVICE_TYPES[0].key);
  const [materialId, setMaterialId] = useState("");
  const [colorId, setColorId] = useState("");
  const [qualityKey, setQualityKey] = useState("");
  const [infillDraft, setInfillDraft] = useState("");
  const [priceDraft, setPriceDraft] = useState("");

  const service = SERVICE_TYPES.find((s) => s.key === serviceKey)!;
  const selectedMaterial = materials.find((m) => m.id === materialId);

  // Filament/couleur pickers reset when the service type changes away from
  // Impression 3D and back, and couleur resets whenever filament changes —
  // an old selection from a different filament's color list would otherwise
  // silently linger as a stale, invalid colorId.
  useEffect(() => {
    setColorId("");
  }, [materialId]);

  const canAdd =
    parseEuros(priceDraft) !== null &&
    parseEuros(priceDraft)! >= 0 &&
    (!service.isPrint || (materialId && colorId && qualityKey));

  function addItem() {
    const priceCents = parseEuros(priceDraft);
    if (priceCents === null || priceCents < 0) return;
    if (service.isPrint && (!materialId || !colorId || !qualityKey)) return;

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

    setItems((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2),
        shortLabel: service.shortLabel,
        pdfLabel: service.pdfLabel,
        isPrint: service.isPrint,
        materialLabel,
        colorName,
        colorHex,
        qualityLabel,
        infill: infillDraft.trim() || undefined,
        detail,
        priceCents,
      },
    ]);

    // Reset the form for the next prestation, service type included — an
    // admin composing a devis with several different services shouldn't
    // have to manually reset filament/couleur/qualité each time.
    setServiceKey(SERVICE_TYPES[0].key);
    setMaterialId("");
    setColorId("");
    setQualityKey("");
    setInfillDraft("");
    setPriceDraft("");
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((it) => it.id !== id));
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
          detail: it.detail,
          colorHex: it.colorHex,
          colorName: it.colorName,
          priceCents: it.priceCents,
          isPrint: it.isPrint,
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
        <div className="pricing-title">Ajouter une prestation</div>
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
                <select value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="admin-select">
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
            </>
          )}

          <div className="form-field">
            <span className="field-label">Prix TTC</span>
            <input value={priceDraft} onChange={(e) => setPriceDraft(e.target.value)} className="field-input" placeholder="0,00 €" />
          </div>
        </div>

        <span onClick={canAdd ? addItem : undefined} className={`save-btn add-btn${canAdd ? "" : " disabled"}`}>
          + Ajouter la prestation
        </span>
      </div>

      <div className="quote-items">
        {items.length === 0 && <div className="empty-orders">Aucune prestation ajoutée pour l'instant.</div>}
        {items.map((it) => (
          <div key={it.id} className="order-card">
            <div className="order-head">
              <div>
                <div className="order-title">{it.shortLabel}</div>
                {it.isPrint && (
                  <div className="order-desc">
                    {it.materialLabel} · {it.qualityLabel}
                    {it.infill ? ` · ${it.infill}% remplissage` : ""} · {it.colorName}
                  </div>
                )}
              </div>
              <div className="order-head-right">
                <span className="order-price">{eur(it.priceCents)}</span>
                <span className="btn-close" onClick={() => removeItem(it.id)}>
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
        .generate-btn { margin-top: 22px; font-size: 12.5px; padding: 12px 22px; }
        .quote-items { display: flex; flex-direction: column; gap: 12px; margin-top: 4px; }
        .empty-orders { border: 1px dashed rgba(255,255,255,.15); border-radius: 10px; padding: 34px; text-align: center; font: 500 12px 'Inter',sans-serif; color: rgba(255,255,255,.4); }
        .order-card { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; padding: 16px 20px; }
        .order-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
        .order-head-right { flex: none; display: flex; align-items: center; gap: 10px; }
        .order-title { font: 600 13px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 3px; }
        .order-desc { font: 400 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.45); }
        .order-price { flex: none; font: 700 14px 'Space Grotesk',sans-serif; color: #ff5a3c; white-space: nowrap; }
        .btn-close { flex: none; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; border: 1px solid rgba(255,255,255,.15); color: rgba(255,255,255,.45); cursor: pointer; font-size: 11px; }
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
