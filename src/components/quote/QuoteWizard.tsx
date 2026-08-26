import { useQuoteWizard } from "../../hooks/useQuoteWizard";
import PrinterLoaderIcon from "../PrinterLoaderIcon";

// Ported 1:1 from Devis Instantane.dc.html's configurator (also embedded on
// Home, see Phase 8) — the wizard box only; the surrounding hero/advice/FAQ
// content lives in the page itself so this component can be reused as-is.
export default function QuoteWizard() {
  const w = useQuoteWizard();

  const railStep = (n: number, label: string) => {
    const done = n < w.step;
    const active = n === w.step;
    return (
      <div key={n} className={`qw-rail-step${done ? " done" : ""}${active ? " active" : ""}`} onClick={() => w.goStep(n)}>
        <span className="qw-rail-dot">{done ? "✓" : n}</span>
        <span className="qw-rail-label">{label}</span>
      </div>
    );
  };

  const selectedMaterial = w.materials.find((m) => m.key === w.material);
  const availableColors = selectedMaterial ? selectedMaterial.colors.filter((c) => c.inStock) : [];
  const selColor = availableColors.find((c) => c.id === w.colorId);

  const infillHints: Record<number, string> = { 15: "Minimum, déco fragile", 30: "Décoratif standard", 40: "Usage courant", 60: "Renforcé", 80: "Forte contrainte", 100: "Pièce pleine" };
  const qualityHints: Record<string, string> = {
    Rapide: "Couche 0,28 mm — plus rapide et économique, lignes de couche visibles.",
    Standard: "Couche 0,20 mm — le compromis détail / délai par défaut.",
    Fine: "Couche 0,12 mm — plus de détails, surface plus lisse, délai plus long.",
  };

  const qty = w.qty;
  const q = w.quote;
  const unitPriceEuros = q ? q.unitPriceCents / 100 : 0;
  const rawTotal = unitPriceEuros * qty;
  const pct = q ? q.discountPct : w.discountFor(qty);
  const finalTotal = q ? q.totalPriceCents / 100 : 0;
  const scaleTooLarge = !!w.sizeMm && !w.scaleFitsPrinter();
  const sizeLabel = w.sizeMm
    ? (() => {
        const f = w.effectiveScale();
        const fmt = (n: number) => (n * f).toFixed(1).replace(".", ",");
        return `${fmt(w.sizeMm!.x)} × ${fmt(w.sizeMm!.y)} × ${fmt(w.sizeMm!.z)} mm`;
      })()
    : "";

  return (
    <div className="qw-box">
      <div className="qw-rail">
        {railStep(1, "Fichier STL")}
        {railStep(2, "Options")}
        {railStep(3, "Analyse auto")}
        {railStep(4, "Prix & panier")}
      </div>
      <div className="qw-content">
        {w.step === 1 && (
          <>
            {w.file ? (
              <>
                <div className="qw-file-ready">
                  <div className="qw-file-head">
                    <span className="qw-file-name">{w.file.name}</span>
                    <span className="qw-file-check">✓</span>
                  </div>
                  <div className="qw-file-body">
                    <div className="qw-preview-wrap">
                      <div ref={w.previewRef} className="qw-preview" />
                      {w.previewLoading && (
                        <div className="qw-preview-overlay">
                          <div className="qw-preview-overlay-inner">
                            <div className="qw-loader-icon qw-loader-icon--small">
                              <PrinterLoaderIcon maskId="d3" />
                            </div>
                            <div className="qw-overlay-text">Chargement de l'aperçu…</div>
                          </div>
                        </div>
                      )}
                      {w.previewUnavailable && (
                        <div className="qw-preview-overlay">
                          <div className="qw-preview-overlay-inner">
                            <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="qw-overlay-svg">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                              <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <div className="qw-overlay-text">Aperçu non disponible pour ce format</div>
                          </div>
                        </div>
                      )}
                      {!!w.sizeMm && (
                        <div className="qw-zoom-controls">
                          <div onClick={w.zoomIn} className="qw-zoom-btn">+</div>
                          <div onClick={w.zoomOut} className="qw-zoom-btn">−</div>
                        </div>
                      )}
                    </div>
                    {!!w.sizeMm && (
                      <div className="qw-size-panel">
                        <div>
                          <div className="qw-field-label">Unité</div>
                          <select value={w.unit} onChange={w.onUnitChange} className="qw-unit-select">
                            <option value="mm">Millimètres (mm)</option>
                            <option value="cm">Centimètres (cm)</option>
                            <option value="in">Pouces (in)</option>
                            <option value="m">Mètres (m)</option>
                          </select>
                        </div>
                        <div>
                          <div className="qw-field-label">Échelle</div>
                          <div className="qw-scale-row">
                            <div onClick={() => w.bumpScalePct(-5)} className="qw-scale-btn">−</div>
                            <div className="qw-scale-input-wrap">
                              <input value={w.scalePct} onChange={w.onScalePctChange} type="text" inputMode="decimal" className="qw-scale-input" />
                              <span className="qw-scale-pct">%</span>
                            </div>
                            <div onClick={() => w.bumpScalePct(5)} className="qw-scale-btn">+</div>
                          </div>
                        </div>
                        <div className="qw-real-size">
                          Taille réelle
                          <br />
                          <span className={`qw-real-size-value${scaleTooLarge ? " too-large" : ""}`}>{sizeLabel}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  {scaleTooLarge && (
                    <div className="qw-scale-warning">⚠ À cette échelle, la pièce dépasse le format imprimable de nos machines (330×320×325mm max). Réduisez le pourcentage ou changez l'unité pour continuer.</div>
                  )}
                  <div className="qw-file-success">Fichier chargé avec succès</div>
                </div>
                <div className="qw-next-row">
                  <div onClick={w.next} className={`qw-next-btn${scaleTooLarge ? " disabled" : ""}`}>Suivant →</div>
                </div>
              </>
            ) : (
              <>
                <input ref={w.fileInputRef} type="file" accept=".stl,.obj,.step,.stp" onChange={w.onFileInputChange} className="qw-file-input-hidden" />
                <div onClick={w.dropFile} onDragOver={w.onDragOver} onDragLeave={w.onDragLeave} onDrop={w.onDrop} className={`qw-dropzone${w.dragging ? " dragging" : ""}`}>
                  <div className="qw-dropzone-title">Glissez votre fichier .STL / .OBJ / .STEP ici</div>
                  <div className="qw-dropzone-hint">ou cliquez pour parcourir — 150 Mo max</div>
                </div>
                {w.fileError && <div className="qw-file-error">{w.fileError}</div>}
              </>
            )}
          </>
        )}

        {w.step === 2 && (
          <>
            <div className="qw-section-label">Matériau</div>
            <div className="qw-chips">
              {w.materials.map((m) => (
                <span key={m.key} onClick={() => w.selectMaterial(m.key)} className={`qw-chip${w.material === m.key ? " active" : ""}`}>{m.key}</span>
              ))}
            </div>
            <div className="qw-select-wrap">
              <div onClick={() => w.setMaterialDropdownOpen((v) => !v)} className="qw-select-toggle">
                <span>{w.material}</span>
                <span className={`qw-chevron${w.materialDropdownOpen ? " open" : ""}`}>▾</span>
              </div>
              {w.materialDropdownOpen && (
                <div className="qw-select-dropdown">
                  {w.materials.map((m) => (
                    <div key={m.key} onClick={() => { w.selectMaterial(m.key); w.setMaterialDropdownOpen(false); }} className={`qw-select-row${w.material === m.key ? " active" : ""}`}>{m.key}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="qw-microhint">PEEK / PEKK non proposés</div>

            <div className="qw-section-label">Couleur</div>
            <div className="qw-colors">
              {availableColors.map((c) => (
                <span
                  key={c.id}
                  onClick={() => w.setColorId(c.id)}
                  className={`qw-color-dot${w.colorId === c.id ? " selected" : ""}`}
                  style={{ background: c.colorHex }}
                />
              ))}
            </div>

            <div className="qw-section-label">Taux de remplissage</div>
            <div className="qw-chips">
              {[15, 30, 40, 60, 80, 100].map((v) => (
                <span key={v} onClick={() => w.setInfill(v)} className={`qw-chip${w.infill === v ? " active" : ""}`}>{v}%</span>
              ))}
            </div>
            <div className="qw-select-wrap">
              <div onClick={() => w.setInfillDropdownOpen((v) => !v)} className="qw-select-toggle">
                <span>{w.infill}%</span>
                <span className={`qw-chevron${w.infillDropdownOpen ? " open" : ""}`}>▾</span>
              </div>
              {w.infillDropdownOpen && (
                <div className="qw-select-dropdown">
                  {[15, 30, 40, 60, 80, 100].map((v) => (
                    <div key={v} onClick={() => { w.setInfill(v); w.setInfillDropdownOpen(false); }} className={`qw-select-row${w.infill === v ? " active" : ""}`}>{v}% — {infillHints[v]}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="qw-hint">{infillHints[w.infill]}</div>

            <div className="qw-section-label">Qualité d'impression</div>
            <div className="qw-chips qw-chips--quality">
              {["Rapide", "Standard", "Fine"].map((qv) => (
                <span key={qv} onClick={() => w.setQuality(qv)} className={`qw-chip${w.quality === qv ? " active" : ""}`}>{qv}</span>
              ))}
            </div>
            <div className="qw-select-wrap">
              <div onClick={() => w.setQualityDropdownOpen((v) => !v)} className="qw-select-toggle">
                <span>{w.quality}</span>
                <span className={`qw-chevron${w.qualityDropdownOpen ? " open" : ""}`}>▾</span>
              </div>
              {w.qualityDropdownOpen && (
                <div className="qw-select-dropdown">
                  {["Rapide", "Standard", "Fine"].map((qv) => (
                    <div key={qv} onClick={() => { w.setQuality(qv); w.setQualityDropdownOpen(false); }} className={`qw-select-row${w.quality === qv ? " active" : ""}`}>{qv}</div>
                  ))}
                </div>
              )}
            </div>
            <div className="qw-hint">{qualityHints[w.quality]}</div>

            <div className="qw-section-label">Quantité</div>
            <div className="qw-qty-wrap" onMouseEnter={() => w.setShowDiscountInfo(true)} onMouseLeave={() => w.setShowDiscountInfo(false)}>
              <div className="qw-qty-row">
                <span onClick={() => w.setQty(Math.max(1, w.qty - 1))} className="qw-qty-btn">–</span>
                {w.qty}
                <span onClick={() => w.setQty(w.qty + 1)} className="qw-qty-btn">+</span>
                {pct > 0 && <span className="qw-discount-badge">−{pct}%</span>}
              </div>
              {w.showDiscountInfo && (
                <div className="qw-discount-popover">
                  <div className="qw-discount-popover-title">Remises par quantité</div>
                  {w.discountTiers.map((t) => (
                    <div key={t.minQty} className={`qw-discount-row${qty >= t.minQty ? " active" : ""}`}>
                      <span>≥ {t.minQty} : −{t.pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="qw-next-row"><div onClick={w.next} className="qw-next-btn">Suivant →</div></div>
          </>
        )}

        {w.step === 3 && (
          <>
            {w.analysisReady && (
              <>
                <div className="qw-file-ready">
                  <div className="qw-file-head">
                    <span className="qw-file-name">Analyse terminée</span>
                    <span className="qw-file-check">✓</span>
                  </div>
                  <div ref={w.analysisPreviewRef} className="qw-analysis-preview">
                    {w.previewUnavailable && (
                      <div className="qw-preview-overlay-inner">
                        <svg xmlns="http://www.w3.org/2000/svg" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="qw-overlay-svg">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                          <polyline points="14 2 14 8 20 8"></polyline>
                        </svg>
                        <div className="qw-overlay-text">Aperçu non disponible pour ce fichier</div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="qw-next-row"><div onClick={w.next} className="qw-next-btn">Suivant →</div></div>
              </>
            )}
            {w.analyzing && (
              <div className="qw-analyzing">
                <div className="qw-loader-icon qw-loader-icon--large">
                  <PrinterLoaderIcon maskId="d2" />
                </div>
                <div className="qw-analyzing-text">Analyse de votre besoin en cours…</div>
              </div>
            )}
            {!!w.analysisError && (
              <div className="qw-analysis-error">
                <div className="qw-analysis-error-text">{w.analysisError}</div>
                <div onClick={w.retryAnalysis} className="qw-retry-btn">Réessayer</div>
              </div>
            )}
          </>
        )}

        {w.step === 4 && (
          <>
            <div className="qw-summary-grid">
              <div className="qw-summary-card"><div className="qw-summary-label">Volume</div>{q ? q.volumeCm3.toFixed(1) : "—"} cm³</div>
              <div className="qw-summary-card"><div className="qw-summary-label">Poids total</div>{q ? q.weightG.toFixed(0) : "—"} g</div>
              <div className="qw-summary-card">
                <div className="qw-summary-label">Filament</div>
                <div className="qw-summary-filament">
                  <span className="qw-summary-swatch" style={{ background: selColor ? selColor.colorHex : "#ff5a3c" }} />
                  {w.material} · {selColor ? selColor.colorName : "—"}
                </div>
              </div>
              <div className="qw-summary-card"><div className="qw-summary-label">Définition d'impression</div>{w.quality}</div>
            </div>
            {w.thinWallWarning && (
              <div className="qw-thinwall-warning">
                ⚠ Cette pièce contient des parois très fines (moins de 0,4 mm) — un problème d'impression est probable à cet endroit. Vous pouvez continuer, mais on vous conseille de nous{" "}
                <a href="/contact">contacter via le formulaire de contact</a> pour vérifier la faisabilité avant de commander.
              </div>
            )}
            <div className="qw-price-row">
              <div>
                <div className="qw-price-label">Prix estimé</div>
                <div className="qw-price-value-row">
                  {pct > 0 && <span className="qw-price-raw">{rawTotal.toFixed(2)} €</span>}
                  <span className="qw-price-value">{finalTotal.toFixed(2)} €</span>
                  <span className="qw-price-ht">HT</span>
                  {pct > 0 && <span className="qw-discount-badge">−{pct}%</span>}
                </div>
              </div>
              <div onClick={w.addToCart} className="qw-add-btn">Ajouter au panier</div>
            </div>
            {w.showAddedToast && (
              <div className="qw-toast">✓ Ajouté au panier — <a href="/panier">voir le panier</a></div>
            )}
          </>
        )}
      </div>

      <style>{`
        .qw-box { background: #1e1c1a; border: 1px solid rgba(255,255,255,.1); border-radius: 12px; padding: 24px; display: grid; grid-template-columns: 170px 1fr; gap: 24px; }
        .qw-rail { display: flex; flex-direction: column; position: relative; }
        .qw-rail::before { content: ''; position: absolute; left: 9px; top: 10px; bottom: 10px; width: 1px; background: rgba(255,255,255,.15); }
        .qw-rail-step { display: flex; align-items: center; gap: 10px; padding: 9px 0; cursor: default; position: relative; z-index: 1; }
        .qw-rail-step.done { cursor: pointer; }
        .qw-rail-dot { width: 20px; height: 20px; border-radius: 50%; text-align: center; font: 700 10.5px/20px 'Inter',sans-serif; background: #2a2826; color: rgba(255,255,255,.5); border: 1px solid rgba(255,255,255,.25); }
        .qw-rail-step.done .qw-rail-dot, .qw-rail-step.active .qw-rail-dot { background: #ff5a3c; color: #161514; border: none; }
        .qw-rail-label { font: 600 11px 'Inter',sans-serif; color: rgba(255,255,255,.45); }
        .qw-rail-step.done .qw-rail-label { color: rgba(255,255,255,.7); }
        .qw-rail-step.active .qw-rail-label { color: #f3f1ec; }

        .qw-field-label { font: 600 9px 'Inter',sans-serif; color: rgba(255,255,255,.4); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
        .qw-section-label { font: 600 10px 'Inter',sans-serif; color: rgba(255,255,255,.5); text-transform: uppercase; letter-spacing: .6px; margin-bottom: 8px; }
        .qw-microhint { font: 400 9px 'Inter',sans-serif; color: rgba(255,255,255,.35); margin-bottom: 16px; }
        .qw-hint { font: 400 9.5px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.4); margin-bottom: 16px; }

        .qw-file-ready { border: 1px solid rgba(255,90,60,.3); background: #101010; border-radius: 8px; padding: 14px; margin-bottom: 16px; animation: qwFadeUp .35s ease; }
        .qw-file-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
        .qw-file-name { font: 600 10px 'Inter',sans-serif; color: rgba(255,255,255,.5); }
        .qw-file-check { width: 16px; height: 16px; border-radius: 50%; background: #ff5a3c; color: #161514; font: 700 10px/16px 'Inter',sans-serif; text-align: center; }
        .qw-file-body { display: flex; flex-wrap: wrap; gap: 12px; }
        .qw-preview-wrap { flex: 1 1 240px; min-width: 220px; min-height: 260px; align-self: stretch; position: relative; }
        .qw-preview { width: 100%; height: 100%; background: #161514; border-radius: 6px; overflow: hidden; position: relative; display: flex; align-items: center; justify-content: center; }
        .qw-preview-overlay { position: absolute; inset: 0; border-radius: 6px; overflow: hidden; display: flex; align-items: center; justify-content: center; pointer-events: none; }
        .qw-preview-overlay-inner { text-align: center; }
        .qw-overlay-svg { margin-bottom: 6px; }
        .qw-overlay-text { font: 400 9.5px 'Inter',sans-serif; color: rgba(255,255,255,.4); }
        .qw-zoom-controls { position: absolute; bottom: 8px; right: 8px; display: flex; flex-direction: column; gap: 4px; z-index: 2; }
        .qw-zoom-btn { width: 24px; height: 24px; border-radius: 5px; background: rgba(22,21,20,.85); border: 1px solid rgba(255,255,255,.15); color: #e8e6e1; font: 600 14px 'Inter',sans-serif; text-align: center; line-height: 22px; cursor: pointer; user-select: none; }
        .qw-size-panel { flex: 1 1 150px; min-width: 150px; display: flex; flex-direction: column; gap: 14px; }
        .qw-unit-select { width: 100%; box-sizing: border-box; height: 34px; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; background: #161514; color: #e8e6e1; font: 11.5px 'Inter',sans-serif; padding: 0 10px; }
        .qw-scale-row { display: flex; align-items: center; justify-content: center; gap: 5px; }
        .qw-scale-btn { width: 26px; height: 34px; flex: none; box-sizing: border-box; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; background: #161514; color: #e8e6e1; font: 600 15px 'Inter',sans-serif; cursor: pointer; user-select: none; }
        .qw-scale-input-wrap { width: 66px; flex: none; box-sizing: border-box; display: flex; align-items: center; justify-content: center; gap: 3px; height: 34px; border: 1px solid rgba(255,255,255,.15); border-radius: 6px; background: #161514; }
        .qw-scale-input { width: 34px; box-sizing: border-box; border: none; background: transparent; color: #e8e6e1; font: 11.5px 'Inter',sans-serif; padding: 0; text-align: center; }
        .qw-scale-pct { font: 10px 'Inter',sans-serif; color: rgba(255,255,255,.4); }
        .qw-real-size { font: 400 10px/1.5 'Inter',sans-serif; color: rgba(255,255,255,.5); border-top: 1px solid rgba(255,255,255,.08); padding-top: 10px; }
        .qw-real-size-value { font: 600 11px ui-monospace,monospace; color: #f3f1ec; }
        .qw-real-size-value.too-large { color: #ff8a70; }
        .qw-scale-warning { margin-top: 10px; padding: 10px 12px; border: 1px solid rgba(255,138,112,.35); background: rgba(255,90,60,.08); border-radius: 6px; font: 400 10.5px/1.5 'Inter',sans-serif; color: #ffb199; }
        .qw-file-success { font: 400 9.5px 'Inter',sans-serif; color: rgba(255,255,255,.4); text-align: center; margin-top: 10px; }
        .qw-next-row { display: flex; justify-content: flex-end; animation: qwFadeUp .4s ease .05s both; }
        .qw-next-btn { background: #ff5a3c; color: #161514; font: 600 12px 'Inter',sans-serif; padding: 10px 20px; border-radius: 6px; cursor: pointer; }
        .qw-next-btn.disabled { background: rgba(255,255,255,.08); color: rgba(255,255,255,.35); cursor: not-allowed; }
        .qw-file-input-hidden { display: none; }
        .qw-dropzone { border: 1.5px dashed rgba(255,255,255,.25); border-radius: 8px; padding: 34px; text-align: center; cursor: pointer; transition: border-color .2s ease, background .2s ease; }
        .qw-dropzone.dragging { border-color: #ff5a3c; background: rgba(255,90,60,.08); }
        .qw-dropzone-title { font: 600 13px 'Inter',sans-serif; color: #f3f1ec; margin-bottom: 4px; }
        .qw-dropzone-hint { font: 400 10.5px 'Inter',sans-serif; color: rgba(255,255,255,.4); }
        .qw-file-error { margin-top: 10px; font: 600 11px 'Inter',sans-serif; color: #ff8a70; }

        .qw-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 4px; }
        .qw-chips--quality { flex-wrap: nowrap; }
        .qw-chip { padding: 6px 12px; border-radius: 6px; font: 600 10.5px 'Inter',sans-serif; cursor: pointer; background: transparent; color: #e8e6e1; border: 1px solid rgba(255,255,255,.2); }
        .qw-chip.active { background: #ff5a3c; color: #161514; border-color: #ff5a3c; }
        .qw-select-wrap { display: none; position: relative; margin-bottom: 6px; }
        .qw-select-toggle { width: 100%; box-sizing: border-box; height: 36px; border: 1px solid rgba(255,255,255,.2); border-radius: 6px; background: #161514; color: #e8e6e1; font: 600 12px 'Inter',sans-serif; padding: 0 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer; }
        .qw-chevron { display: inline-block; transition: transform .15s ease; }
        .qw-chevron.open { transform: rotate(180deg); }
        .qw-select-dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 10; background: #1a1917; border: 1px solid rgba(255,90,60,.3); border-radius: 8px; box-shadow: 0 12px 24px rgba(0,0,0,.4); animation: qwFadeUp .2s ease; overflow: hidden; }
        .qw-select-row { padding: 9px 12px; font: 500 11.5px 'Inter',sans-serif; cursor: pointer; background: transparent; color: #e8e6e1; }
        .qw-select-row.active { background: rgba(255,90,60,.12); color: #ff5a3c; }

        .qw-colors { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
        .qw-color-dot { width: 20px; height: 20px; border-radius: 50%; cursor: pointer; border: 1px solid rgba(255,255,255,.3); display: inline-block; }
        .qw-color-dot.selected { border: 2px solid #f3f1ec; }

        .qw-qty-wrap { position: relative; margin-bottom: 20px; }
        .qw-qty-row { display: flex; align-items: center; gap: 10px; font: 600 12px 'Inter',sans-serif; color: #f3f1ec; }
        .qw-qty-btn { width: 22px; height: 22px; border: 1px solid rgba(255,255,255,.25); border-radius: 5px; text-align: center; line-height: 20px; cursor: pointer; }
        .qw-discount-badge { font: 700 10px 'Inter',sans-serif; color: #ff5a3c; background: rgba(255,90,60,.12); border-radius: 4px; padding: 3px 8px; }
        .qw-discount-popover { position: absolute; left: 0; top: calc(100% + 8px); z-index: 6; background: #161514; border: 1px solid rgba(255,90,60,.3); border-radius: 8px; padding: 12px 14px; box-shadow: 0 12px 24px rgba(0,0,0,.4); animation: qwFadeUp .2s ease; min-width: 170px; }
        .qw-discount-popover-title { font: 600 9px 'Inter',sans-serif; color: rgba(255,255,255,.4); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 6px; }
        .qw-discount-row { display: flex; justify-content: space-between; gap: 10px; padding: 3px 0; color: rgba(255,255,255,.5); font: 500 10px 'Inter',sans-serif; }
        .qw-discount-row.active { color: #ff5a3c; font-weight: 700; }

        .qw-analysis-preview { height: 150px; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at center, rgba(255,90,60,.08), transparent 70%); border-radius: 6px; overflow: hidden; }
        .qw-analyzing { border: 1.5px dashed rgba(255,255,255,.25); border-radius: 8px; padding: 34px; text-align: center; }
        .qw-analyzing-text { font: 600 12px 'Inter',sans-serif; color: #f3f1ec; }
        .qw-loader-icon { margin: 0 auto 16px; color: #ff5a3c; }
        .qw-loader-icon--small { width: 40px; height: 40px; margin-bottom: 8px; --pl-nozzle-fill: #161514; }
        .qw-loader-icon--large { width: 64px; height: 64px; --pl-nozzle-fill: #1a1917; }
        .qw-analysis-error { border: 1px solid rgba(255,90,60,.3); background: rgba(255,90,60,.08); border-radius: 8px; padding: 24px; text-align: center; }
        .qw-analysis-error-text { font: 600 13px 'Inter',sans-serif; color: #f3f1ec; margin-bottom: 8px; }
        .qw-retry-btn { display: inline-block; border: 1px solid rgba(255,255,255,.25); color: #f3f1ec; font: 600 12px 'Inter',sans-serif; padding: 9px 16px; border-radius: 6px; cursor: pointer; }

        .qw-summary-grid { display: grid; grid-template-columns: repeat(2,1fr); gap: 10px; font: 10px 'Inter',sans-serif; color: rgba(255,255,255,.55); margin-bottom: 20px; }
        .qw-summary-card { background: #161514; border: 1px solid rgba(255,255,255,.08); border-radius: 6px; padding: 10px; }
        .qw-summary-label { color: rgba(255,255,255,.4); font-size: 9px; text-transform: uppercase; margin-bottom: 3px; }
        .qw-summary-filament { display: flex; align-items: center; gap: 6px; }
        .qw-summary-swatch { width: 11px; height: 11px; border-radius: 50%; border: 1px solid rgba(255,255,255,.25); flex: none; display: inline-block; }
        .qw-thinwall-warning { margin-bottom: 16px; padding: 10px 12px; border: 1px solid rgba(255,138,112,.35); background: rgba(255,90,60,.08); border-radius: 6px; font: 400 10.5px/1.5 'Inter',sans-serif; color: #ffb199; }
        .qw-thinwall-warning a { color: #ff5a3c; }
        .qw-price-row { display: flex; align-items: center; justify-content: space-between; padding-top: 2px; }
        .qw-price-label { font: 500 10px 'Inter',sans-serif; color: rgba(255,255,255,.45); }
        .qw-price-value-row { display: flex; align-items: baseline; gap: 9px; }
        .qw-price-raw { font: 500 14px 'Space Grotesk',sans-serif; color: rgba(255,255,255,.4); text-decoration: line-through; }
        .qw-price-value { font: 700 26px 'Space Grotesk',sans-serif; color: #ff5a3c; }
        .qw-price-ht { font: 500 11px 'Inter',sans-serif; color: rgba(255,255,255,.4); }
        .qw-add-btn { background: #ff5a3c; color: #161514; font: 600 12.5px 'Inter',sans-serif; padding: 11px 18px; border-radius: 7px; cursor: pointer; }
        .qw-toast { margin-top: 14px; border: 1px solid rgba(255,90,60,.35); background: rgba(255,90,60,.08); border-radius: 8px; padding: 10px 14px; font: 600 11px 'Inter',sans-serif; color: #f3f1ec; animation: qwFadeUp .3s ease; }
        .qw-toast a { color: #ff5a3c; }

        .printer-loader-svg { width: 100%; height: 100%; display: block; }
        .printer-loader-svg .filament { fill: none; stroke: currentColor; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; }
        .printer-loader-svg .stack { animation: plShiftDown 2.5s linear infinite; }
        .printer-loader-svg .nozzle { fill: var(--pl-nozzle-fill,#161514); stroke: currentColor; stroke-width: 2.5; stroke-linejoin: round; animation: plNozzleMove 2.5s linear infinite; }
        .printer-loader-svg .line-lr { stroke-dasharray: 100; animation: plDrawLr 2.5s linear infinite; }
        .printer-loader-svg .arc-r { stroke-dasharray: 100; animation: plDrawArcR 2.5s linear infinite; }
        .printer-loader-svg .line-rl { stroke-dasharray: 100; animation: plDrawRl 2.5s linear infinite; }
        .printer-loader-svg .arc-l { stroke-dasharray: 100; animation: plDrawArcL 2.5s linear infinite; }
        @keyframes plShiftDown { 0%,38% { transform: translateY(0px); } 50%,88% { transform: translateY(10px); } 100% { transform: translateY(20px); } }
        @keyframes plNozzleMove { 0% { transform: translateX(-25px); } 38% { transform: translateX(25px); } 44% { transform: translateX(30px); } 50% { transform: translateX(25px); } 88% { transform: translateX(-25px); } 94% { transform: translateX(-30px); } 100% { transform: translateX(-25px); } }
        @keyframes plDrawLr { 0% { stroke-dashoffset: 100; } 38%,100% { stroke-dashoffset: 50; } }
        @keyframes plDrawArcR { 0%,38% { stroke-dashoffset: 100; } 50%,100% { stroke-dashoffset: 84.3; } }
        @keyframes plDrawRl { 0%,50% { stroke-dashoffset: 100; } 88%,100% { stroke-dashoffset: 50; } }
        @keyframes plDrawArcL { 0%,88% { stroke-dashoffset: 100; } 100% { stroke-dashoffset: 84.3; } }
        @keyframes qwFadeUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }

        @media (max-width: 900px) {
          .qw-box { grid-template-columns: 1fr; }
        }
        @media (max-width: 640px) {
          .qw-chips { display: none; }
          .qw-select-wrap { display: block; }
        }
      `}</style>
    </div>
  );
}
