import { useEffect, useState } from "react";
import { api } from "../../lib/api-client";
import { useAdminMaterials } from "../../hooks/useAdminMaterials";
import { useSavedFlash } from "../../hooks/useSavedFlash";

interface Settings {
  hourlyRateCents: number;
  minUnitPriceCents: number;
  dailyOrderLimit: number;
}

// White/off-white swatches need a visible border to read against the dark
// card background — ported verbatim from Admin.dc.html's swatchBorder check.
function needsLightBorder(hex: string) {
  return hex === "#f4f4ef" || hex === "#d8d3c8";
}

function parseEuros(input: string): number | null {
  const cents = Math.round(parseFloat(input.replace(",", ".")) * 100);
  return Number.isFinite(cents) ? cents : null;
}

export default function StockTab({ settings, onSettingsSaved }: { settings: Settings | null; onSettingsSaved: () => void }) {
  const { materials, toggleSpool, savePrice } = useAdminMaterials(true);

  const [hourlyRateDraft, setHourlyRateDraft] = useState("");
  const [minPriceDraft, setMinPriceDraft] = useState("");
  const [dailyLimitDraft, setDailyLimitDraft] = useState("");
  const hourlyRateFlash = useSavedFlash();
  const minPriceFlash = useSavedFlash();
  const dailyLimitFlash = useSavedFlash();
  const [priceDrafts, setPriceDrafts] = useState<Record<string, string>>({});
  const [priceFlashIds, setPriceFlashIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!settings) return;
    setHourlyRateDraft((settings.hourlyRateCents / 100).toFixed(2));
    setMinPriceDraft((settings.minUnitPriceCents / 100).toFixed(2));
    setDailyLimitDraft(String(settings.dailyOrderLimit));
  }, [settings]);

  async function saveHourlyRate() {
    const cents = parseEuros(hourlyRateDraft);
    if (cents === null || cents <= 0) return;
    const res = await api.adminUpdateSettings({ hourlyRateCents: cents });
    if (res.ok) {
      hourlyRateFlash.flash();
      onSettingsSaved();
    }
  }
  async function saveMinPrice() {
    const cents = parseEuros(minPriceDraft);
    if (cents === null || cents < 0) return;
    const res = await api.adminUpdateSettings({ minUnitPriceCents: cents });
    if (res.ok) {
      minPriceFlash.flash();
      onSettingsSaved();
    }
  }
  async function saveDailyLimit() {
    const n = Math.round(parseFloat(dailyLimitDraft.replace(",", ".")));
    if (!Number.isFinite(n) || n < 0) return;
    const res = await api.adminUpdateSettings({ dailyOrderLimit: n });
    if (res.ok) {
      dailyLimitFlash.flash();
      onSettingsSaved();
    }
  }
  async function saveMaterialPrice(materialId: string) {
    const draft = priceDrafts[materialId];
    const cents = draft !== undefined ? parseEuros(draft) : null;
    if (cents === null || cents <= 0) return;
    const ok = await savePrice(materialId, cents);
    if (ok) {
      setPriceFlashIds((s) => ({ ...s, [materialId]: true }));
      setTimeout(() => setPriceFlashIds((s) => ({ ...s, [materialId]: false })), 2000);
    }
  }

  return (
    <div className="stock-tab">
      <div className="eyebrow">Inventaire</div>
      <div className="title">Stock filament</div>

      <div className="pricing-card">
        <div className="pricing-title">Tarification atelier</div>
        <div className="pricing-hint">Prix pièce = taux horaire × temps d'impression + prix matière (ci-dessous), avec un minimum discret par pièce.</div>
        <div className="pricing-row">
          <div className="pricing-field">
            <span className="field-label">Taux horaire</span>
            <input value={hourlyRateDraft} onChange={(e) => setHourlyRateDraft(e.target.value)} className="field-input" />
            <span className="field-label">€/h</span>
            <span onClick={saveHourlyRate} className={`save-btn${hourlyRateFlash.saved ? " saved" : ""}`}>
              {hourlyRateFlash.saved ? "✓" : "OK"}
            </span>
          </div>
          <div className="pricing-field">
            <span className="field-label">Prix minimum / pièce</span>
            <input value={minPriceDraft} onChange={(e) => setMinPriceDraft(e.target.value)} className="field-input" />
            <span className="field-label">€</span>
            <span onClick={saveMinPrice} className={`save-btn${minPriceFlash.saved ? " saved" : ""}`}>
              {minPriceFlash.saved ? "✓" : "OK"}
            </span>
          </div>
          <div className="pricing-field">
            <span className="field-label">Limite de commandes / jour</span>
            <input value={dailyLimitDraft} onChange={(e) => setDailyLimitDraft(e.target.value)} className="field-input" />
            <span className="field-label">/ jour (0 = pas de limite)</span>
            <span onClick={saveDailyLimit} className={`save-btn${dailyLimitFlash.saved ? " saved" : ""}`}>
              {dailyLimitFlash.saved ? "✓" : "OK"}
            </span>
          </div>
        </div>
      </div>

      {materials.map((m) => {
        const priceDraft = priceDrafts[m.id] !== undefined ? priceDrafts[m.id] : (m.pricePerKgCents / 100).toFixed(2);
        const priceSaved = !!priceFlashIds[m.id];
        return (
          <div key={m.id} className="material-group">
            <div className="material-head">
              <div className="material-label">{m.label}</div>
              <div className="material-price-field">
                <span className="field-label">Prix</span>
                <input value={priceDraft} onChange={(e) => setPriceDrafts((s) => ({ ...s, [m.id]: e.target.value }))} className="field-input" />
                <span className="field-label">€/kg</span>
                <span onClick={() => saveMaterialPrice(m.id)} className={`save-btn${priceSaved ? " saved" : ""}`}>
                  {priceSaved ? "✓" : "OK"}
                </span>
              </div>
            </div>
            <div className="swatch-grid">
              {m.colors.map((sw) => (
                <div key={sw.id} className={`swatch-card${sw.inStock ? "" : " out"}`}>
                  <div className="swatch-head">
                    <span className={`swatch-dot${needsLightBorder(sw.colorHex) ? " light" : ""}`} style={{ background: sw.colorHex }} />
                    <span className="swatch-name">{sw.colorName}</span>
                  </div>
                  <div className="swatch-status-row">
                    <span className={`swatch-status${sw.inStock ? "" : " out"}`}>{sw.inStock ? "En stock" : "Rupture"}</span>
                    <span className={`toggle-track${sw.inStock ? " on" : ""}`} onClick={() => toggleSpool(m.id, sw.id, sw.inStock)}>
                      <span className={`toggle-knob${sw.inStock ? " on" : ""}`} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <style>{`
        .stock-tab { max-width: 1000px; margin: 0 auto; padding: 44px 24px 60px; }
        .eyebrow { font: 600 12px 'Inter',sans-serif; letter-spacing: 1.2px; color: #ff5a3c; text-transform: uppercase; margin-bottom: 10px; }
        .title { font: 700 26px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 28px; }
        .pricing-card { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; padding: 18px 20px; margin-bottom: 32px; }
        .pricing-title { font: 600 12.5px 'Space Grotesk',sans-serif; color: #f3f1ec; margin-bottom: 4px; }
        .pricing-hint { font: 400 10.5px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.45); margin-bottom: 14px; }
        .pricing-row { display: flex; gap: 28px; flex-wrap: wrap; }
        .pricing-field { display: flex; align-items: center; gap: 8px; }
        .field-label { font: 400 10px 'Inter',sans-serif; color: rgba(255,255,255,.4); }
        .field-input { width: 70px; box-sizing: border-box; height: 28px; border: 1px solid rgba(255,255,255,.15); border-radius: 5px; background: #161514; padding: 0 8px; font: 11px 'Inter',sans-serif; color: #e8e6e1; outline: none; text-align: right; }
        .save-btn { font: 600 10px 'Inter',sans-serif; padding: 5px 10px; border-radius: 5px; cursor: pointer; background: #ff5a3c; color: #161514; }
        .save-btn.saved { background: rgba(143,209,158,.15); color: #8fd19e; }
        .material-group { margin-bottom: 30px; }
        .material-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 10px; }
        .material-label { font: 600 9.5px 'Inter',sans-serif; color: rgba(255,255,255,.5); text-transform: uppercase; letter-spacing: .6px; }
        .material-price-field { display: flex; align-items: center; gap: 8px; }
        .swatch-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
        .swatch-card { border: 1px solid rgba(255,255,255,.1); border-radius: 10px; background: #1a1917; padding: 14px; opacity: 1; }
        .swatch-card.out { border-color: rgba(255,90,60,.25); opacity: .55; }
        .swatch-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
        .swatch-dot { width: 16px; height: 16px; border-radius: 50%; flex: none; border: 1px solid rgba(255,255,255,.15); }
        .swatch-dot.light { border: 1px solid rgba(255,255,255,.35); }
        .swatch-name { font: 600 10.5px 'Inter',sans-serif; color: #f3f1ec; line-height: 1.2; }
        .swatch-status-row { display: flex; align-items: center; justify-content: space-between; }
        .swatch-status { font: 700 9.5px 'Inter',sans-serif; color: #8fd19e; }
        .swatch-status.out { color: #ff5a3c; }
        .toggle-track { width: 38px; height: 20px; border-radius: 10px; position: relative; cursor: pointer; background: rgba(255,255,255,.15); transition: background .2s ease; display: inline-block; }
        .toggle-track.on { background: #ff5a3c; }
        .toggle-knob { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #fff; transition: left .2s ease; }
        .toggle-knob.on { left: 20px; }

        @media (max-width: 900px) {
          .swatch-grid { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 640px) {
          .swatch-grid { grid-template-columns: repeat(2, 1fr); }
        }
      `}</style>
    </div>
  );
}
