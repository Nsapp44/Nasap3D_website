import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiBase } from "../lib/api-client";
import { dynamicImport } from "../lib/dynamic-import";

const ALLOWED_EXT = [".stl", ".obj", ".step", ".stp"];
const UNIT_TO_MM: Record<string, number> = { mm: 1, cm: 10, in: 25.4, m: 1000 };

export interface QuoteColor {
  id: string;
  colorName: string;
  colorHex: string;
  inStock: boolean;
}
export interface QuoteMaterial {
  key: string;
  label: string;
  colors: QuoteColor[];
}
export interface DiscountTier {
  minQty: number;
  pct: number;
}
export interface QuoteResult {
  id: string;
  volumeCm3: number;
  weightG: number;
  unitPriceCents: number;
  discountPct: number;
  totalPriceCents: number;
  quantity: number;
}

const DEFAULT_TIERS: DiscountTier[] = [
  { minQty: 5, pct: 5 },
  { minQty: 15, pct: 10 },
  { minQty: 50, pct: 15 },
  { minQty: 100, pct: 20 },
  { minQty: 500, pct: 30 },
];

interface PreviewHandle {
  getSizeMm(): { x: number; y: number; z: number };
  setScale(factor: number): void;
  dispose(): void;
  zoomIn?(): void;
  zoomOut?(): void;
}

function extOk(name: string) {
  const lower = name.toLowerCase();
  return ALLOWED_EXT.some((ext) => lower.endsWith(ext));
}

// Ported 1:1 from Devis Instantane.dc.html's Component — the shared
// configurator, also embedded on Home (Phase 8). One big hook rather than
// several small ones: the original state machine is a single tightly
// coupled unit (nearly every field feeds into _submitQuote/renderVals), and
// splitting it up would just move the coupling around without reducing it.
export function useQuoteWizard() {
  const [step, setStep] = useState(1);
  const [file, setFileState] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [previewUnavailable, setPreviewUnavailable] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [unit, setUnit] = useState("mm");
  const [scalePct, setScalePct] = useState<string | number>(100);
  const [sizeMm, setSizeMm] = useState<{ x: number; y: number; z: number } | null>(null);
  const [thinWallWarning, setThinWallWarning] = useState(false);
  const [infillDropdownOpen, setInfillDropdownOpen] = useState(false);
  const [materialDropdownOpen, setMaterialDropdownOpen] = useState(false);
  const [qualityDropdownOpen, setQualityDropdownOpen] = useState(false);
  const [material, setMaterial] = useState("PLA");
  const [colorId, setColorId] = useState<string | null>(null);
  const [infill, setInfill] = useState(40);
  const [quality, setQuality] = useState("Standard");
  const [qty, setQty] = useState(1);
  const [showDiscountInfo, setShowDiscountInfo] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisReady, setAnalysisReady] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [showAddedToast, setShowAddedToast] = useState(false);
  const [materials, setMaterials] = useState<QuoteMaterial[]>([]);
  const [discountTiers, setDiscountTiers] = useState<DiscountTier[]>(DEFAULT_TIERS);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const analysisPreviewRef = useRef<HTMLDivElement>(null);
  const previewHandleRef = useRef<PreviewHandle | null>(null);
  const analysisPreviewHandleRef = useRef<PreviewHandle | null>(null);
  const previewLoaderTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addedToCartRef = useRef(false);
  const apiBaseRef = useRef<string | null>(null);

  // Kept as refs mirroring the latest state so the pagehide listener (added
  // once on mount) always sees current values without re-subscribing on
  // every keystroke — same effect as the original reading `this.state`
  // directly from a listener attached once in componentDidMount.
  const quoteRef = useRef<QuoteResult | null>(null);
  quoteRef.current = quote;
  const fileRef = useRef<File | null>(null);
  fileRef.current = file;

  const effectiveScale = useCallback(() => {
    const pct = typeof scalePct === "string" ? parseFloat(scalePct) : scalePct;
    return (UNIT_TO_MM[unit] || 1) * ((Number.isFinite(pct) ? pct : 100) / 100);
  }, [unit, scalePct]);

  const scaleFitsPrinter = useCallback(() => {
    if (!sizeMm) return true;
    const f = effectiveScale();
    const dims = [sizeMm.x * f, sizeMm.y * f, sizeMm.z * f].sort((a, b) => a - b);
    const bed = [330, 320].sort((a, b) => a - b);
    return dims[0] <= bed[0] && dims[1] <= bed[1] && dims[2] <= 325;
  }, [sizeMm, effectiveScale]);

  async function renderInto(ref: React.RefObject<HTMLDivElement | null>, handleRef: React.RefObject<PreviewHandle | null>, extraOpts?: Record<string, unknown>) {
    if (handleRef.current) {
      handleRef.current.dispose();
      handleRef.current = null;
    }
    if (!file || !ref.current) return null;
    const ext = "." + file.name.split(".").pop()!.toLowerCase();
    const { isRenderableExt, renderModelPreview } = await dynamicImport("/viewer3d.js");
    if (!isRenderableExt(ext)) {
      setPreviewUnavailable(true);
      return null;
    }
    setPreviewUnavailable(false);
    const targetFile = file;
    const buffer = await targetFile.arrayBuffer();
    if (fileRef.current !== targetFile || !ref.current) return null; // stale by the time the read finished
    const mat = materials.find((m) => m.key === material);
    const color = mat ? mat.colors.find((c) => c.id === colorId)?.colorHex : null;
    const handle = await renderModelPreview(ref.current, { fileBuffer: buffer, ext, colorHex: color, ...extraOpts });
    handleRef.current = handle;
    return handle;
  }

  const renderPreview = useCallback(async () => {
    if (previewLoaderTimerRef.current) clearTimeout(previewLoaderTimerRef.current);
    previewLoaderTimerRef.current = setTimeout(() => {
      previewLoaderTimerRef.current = null;
      setPreviewLoading(true);
    }, 500);
    const handle = await renderInto(previewRef, previewHandleRef, { animate: false, showGrid: true });
    if (previewLoaderTimerRef.current) {
      clearTimeout(previewLoaderTimerRef.current);
      previewLoaderTimerRef.current = null;
    }
    if (!handle) {
      setSizeMm(null);
      setThinWallWarning(false);
      setPreviewLoading(false);
      return;
    }
    const size = handle.getSizeMm();
    setSizeMm(size);
    setThinWallWarning(false);
    setPreviewLoading(false);
    handle.setScale(effectiveScale());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, material, colorId]);

  function applyScalePreview() {
    if (!previewHandleRef.current || !sizeMm) return;
    previewHandleRef.current.setScale(effectiveScale());
  }

  function renderAnalysisPreview() {
    return renderInto(analysisPreviewRef, analysisPreviewHandleRef);
  }

  // Best-effort, approximate — only .stl (see original comment: .obj/.step
  // aren't parsed client-side here). Casts a ray inward from a sample of
  // triangle centers along their inverse normal, same idea a slicer uses
  // for a wall-thickness check. Never blocks the quote, just flags a
  // likely-thin area.
  async function checkThinWalls(targetFile: File) {
    if (!targetFile.name.toLowerCase().endsWith(".stl")) return;
    try {
      const buffer = await targetFile.arrayBuffer();
      if (fileRef.current !== targetFile) return; // superseded by a newer upload
      const THREE = await dynamicImport("/vendor/three/three.module.min.js");
      const { STLLoader } = await dynamicImport("/vendor/three/STLLoader.js");
      const geometry = new STLLoader().parse(buffer);
      const pos = geometry.attributes.position;
      const triCount = pos.count / 3;
      if (triCount === 0) return;
      geometry.computeVertexNormals();
      // DoubleSide required: a ray fired from just inside one wall toward
      // the opposite wall always approaches that wall from its back side on
      // a correctly-wound watertight mesh — three.js backface-culls that by
      // default, silently discarding every such hit (confirmed live: a
      // 0.2mm test plate produced zero hits without this).
      const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
      const raycaster = new THREE.Raycaster();
      raycaster.firstHitOnly = true;
      const REAL_THRESHOLD_MM = 0.4;
      const scale = effectiveScale() || 1;
      const THRESHOLD_MM = REAL_THRESHOLD_MM / scale;
      const MIN_THIN_AREA_MM2 = 2;
      const MAX_RAY_TRIANGLE_COST = 6000000;
      const sampleBudget = Math.min(1500, Math.max(20, Math.floor(MAX_RAY_TRIANGLE_COST / triCount)));
      const step = Math.max(1, Math.floor(triCount / sampleBudget));
      const a = new THREE.Vector3(),
        b = new THREE.Vector3(),
        c = new THREE.Vector3(),
        centroid = new THREE.Vector3(),
        normal = new THREE.Vector3();
      let thinAreaMm2 = 0;
      const CHUNK_MS = 12;
      let chunkStart = performance.now();
      for (let i = 0; i < triCount; i += step) {
        if (fileRef.current !== targetFile) return; // superseded by a newer upload
        a.fromBufferAttribute(pos, i * 3);
        b.fromBufferAttribute(pos, i * 3 + 1);
        c.fromBufferAttribute(pos, i * 3 + 2);
        centroid.copy(a).add(b).add(c).divideScalar(3);
        normal.subVectors(b, a).cross(c.clone().sub(a)).normalize();
        if (normal.lengthSq() < 1e-8) continue;
        raycaster.set(centroid.clone().addScaledVector(normal, -1e-3), normal.clone().negate());
        raycaster.near = 0;
        raycaster.far = THRESHOLD_MM;
        const hits = raycaster.intersectObject(mesh, false);
        if (hits.length && hits[0].distance < THRESHOLD_MM) {
          const triArea = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
          thinAreaMm2 += triArea * step * scale * scale;
          if (thinAreaMm2 >= MIN_THIN_AREA_MM2) {
            setThinWallWarning(true);
            geometry.dispose();
            mesh.material.dispose();
            return;
          }
        }
        if (performance.now() - chunkStart > CHUNK_MS) {
          await new Promise((r) => setTimeout(r, 0));
          chunkStart = performance.now();
        }
      }
      geometry.dispose();
      mesh.material.dispose();
    } catch {
      // best-effort — a parse hiccup just means no warning shown
    }
  }

  useEffect(() => {
    apiBaseRef.current = apiBase();

    async function loadMaterials() {
      const res = await api.getMaterials();
      if (!res.ok || !res.data) return;
      const list = (res.data as { materials: QuoteMaterial[] }).materials.filter((m) => m.colors.some((c) => c.inStock));
      setMaterials(list);
      setMaterial((cur) => {
        const found = list.find((m) => m.key === cur) || list[0];
        setColorId(found ? found.colors.find((c) => c.inStock)?.id ?? null : null);
        return found ? found.key : cur;
      });
    }
    async function loadDiscountTiers() {
      const res = await api.getDiscountTiers();
      if (res.ok && res.data && (res.data as { tiers: DiscountTier[] }).tiers.length) {
        setDiscountTiers((res.data as { tiers: DiscountTier[] }).tiers);
      }
    }
    loadMaterials();
    loadDiscountTiers();

    // Best-effort cleanup: if the tab closes (or the user navigates away)
    // with an analyzed quote never added to the cart, tell the server it
    // can delete the uploaded file right away instead of waiting for the
    // periodic sweep (see server/src/lib/quoteCleanup.ts). 'pagehide' not
    // 'beforeunload' — the latter is unreliable on mobile and can block
    // navigation with a confirm dialog in some browsers. sendBeacon never
    // blocks navigation either way.
    const discardListener = () => {
      const q = quoteRef.current;
      if (q && !addedToCartRef.current && apiBaseRef.current) {
        navigator.sendBeacon(apiBaseRef.current + "/quotes/" + q.id + "/discard");
      }
    };
    window.addEventListener("pagehide", discardListener);
    return () => {
      window.removeEventListener("pagehide", discardListener);
      clearTimeout(toastTimerRef.current || undefined);
      if (previewHandleRef.current) previewHandleRef.current.dispose();
      if (analysisPreviewHandleRef.current) analysisPreviewHandleRef.current.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function selectMaterial(key: string) {
    const mat = materials.find((m) => m.key === key);
    const firstColor = mat ? mat.colors.find((c) => c.inStock) : null;
    setMaterial(key);
    setColorId(firstColor ? firstColor.id : null);
    setAnalysisReady(false);
    setQuote(null);
  }
  // Re-render the preview once the material/color selection that just
  // reset the analysis has actually committed (renderPreview reads them
  // from state via its own closure/deps).
  useEffect(() => {
    if (file) renderPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material, colorId]);

  function discountFor(q: number) {
    let pct = 0;
    for (const t of discountTiers) if (q >= t.minQty) pct = Math.max(pct, t.pct);
    return pct;
  }

  function setFile(f: File | null | undefined) {
    if (!f) return;
    if (!extOk(f.name)) {
      setFileError("Format non supporté — utilisez .stl, .obj ou .step");
      return;
    }
    if (f.size > 150 * 1024 * 1024) {
      setFileError("Fichier trop volumineux (150 Mo max)");
      return;
    }
    setFileState(f);
    setFileError(null);
  }
  // Also re-runs on `step`, not just `file`: previewRef's DOM node only
  // exists while step 1 is showing (see QuoteWizard.tsx's JSX), so coming
  // back to step 1 via goStep() needs a fresh render into the newly
  // (re)mounted node too, not just the initial upload. A useEffect — not a
  // setTimeout(fn, 0) — is what actually guarantees the DOM has committed
  // first: a bare setTimeout races the render/commit and can fire before
  // the ref is attached, silently rendering into nothing (confirmed live:
  // this was exactly what made step 3's "Analyse terminée" preview show an
  // empty box before this fix).
  useEffect(() => {
    if (file && step === 1) renderPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file, step]);

  // Same reasoning as above, for the step-3 analysis preview: its DOM node
  // only exists once analysisReady is true (see QuoteWizard.tsx), so this
  // must wait for that commit rather than a same-tick setTimeout.
  useEffect(() => {
    if (step === 3 && analysisReady) renderAnalysisPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, analysisReady]);

  function dropFile() {
    if (file) return;
    fileInputRef.current?.click();
  }
  // Not in the original — added on request, to let someone swap the
  // uploaded file for a different one without reloading the page. Clears
  // everything that file fed into (size/preview/thin-wall flag and any
  // already-run analysis, since a different file invalidates all of it) and
  // disposes the live preview handle, matching what a fresh file selection
  // would already do via the [file, step] effect above.
  function removeFile() {
    if (previewHandleRef.current) {
      previewHandleRef.current.dispose();
      previewHandleRef.current = null;
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
    setFileState(null);
    setFileError(null);
    setSizeMm(null);
    setThinWallWarning(false);
    setPreviewUnavailable(false);
    setAnalysisReady(false);
    setAnalysisError(null);
    setQuote(null);
  }
  function onFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files && e.target.files[0]);
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!dragging) setDragging(true);
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    setFile(e.dataTransfer.files && e.dataTransfer.files[0]);
  }

  function onUnitChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setUnit(e.target.value);
    setTimeout(applyScalePreview, 0);
  }
  function onScalePctChange(e: React.ChangeEvent<HTMLInputElement>) {
    setScalePct(e.target.value);
    setTimeout(applyScalePreview, 0);
  }
  function bumpScalePct(delta: number) {
    const cur = typeof scalePct === "string" ? parseFloat(scalePct) : scalePct;
    const next = Math.max(0.01, (Number.isFinite(cur) ? cur : 100) + delta);
    setScalePct(Math.round(next * 100) / 100);
    setTimeout(applyScalePreview, 0);
  }

  async function submitQuote() {
    if (!file || !colorId) {
      setAnalysisError("Options incomplètes — retournez à l'étape précédente.");
      return;
    }
    setAnalyzing(true);
    setAnalysisError(null);
    const thinWallPromise = checkThinWalls(file);
    const res = await api.submitQuote({
      file,
      material,
      colorId,
      quality,
      infillPct: infill,
      quantity: qty,
      scale: effectiveScale(),
    });
    if (!res.ok) {
      const messages: Record<string, string> = {
        quote_disabled: "Le devis instantané est momentanément indisponible.",
        part_too_large: "Cette pièce dépasse le volume imprimable de toutes nos machines (max 330×320×325mm). Possibilité d'imprimer vos pièces en plusieurs morceaux, utilisez le formulaire de contact.",
        non_manifold_model: "Le modèle contient des erreurs de géométrie (maillage non étanche) — vérifiez le fichier dans votre logiciel de CAO.",
        unreadable_file: "Fichier illisible — vérifiez qu'il s'agit bien d'un .stl, .obj ou .step valide.",
        slicing_failed: "L'analyse a échoué pour ce fichier. Contactez-nous si le problème persiste.",
        color_out_of_stock: "Cette couleur vient de passer en rupture de stock — choisissez-en une autre.",
        invalid_scale: "Échelle invalide — vérifiez l'unité et le pourcentage saisis à l'étape précédente.",
      };
      const errKey = (res.data as { error?: string } | null)?.error;
      setAnalyzing(false);
      setAnalysisError((errKey && messages[errKey]) || "Une erreur est survenue pendant l'analyse, réessayez.");
      return;
    }
    await thinWallPromise;
    setAnalyzing(false);
    setAnalysisReady(true);
    setQuote((res.data as { quote: QuoteResult }).quote);
    // Preview render is handled by the [step, analysisReady] effect above —
    // it needs the step-3 DOM node to exist first, which this setState
    // batch hasn't committed yet at this point in the function.
  }

  function next() {
    if (step === 1 && !scaleFitsPrinter()) return;
    const nextStep = Math.min(4, step + 1);
    setStep(nextStep);
    if (nextStep === 3 && !analysisReady && !analyzing) submitQuote();
    // Re-entering step 3 with analysisReady already true is handled by the
    // [step, analysisReady] effect above (step changing is enough to
    // re-trigger it here, since analysisReady doesn't change in that case).
  }
  function goStep(n: number) {
    if (n >= step) return;
    setStep(n);
    // Re-rendering into step 1's remounted previewRef node is handled by
    // the [file, step] effect above.
  }
  function retryAnalysis() {
    setAnalysisError(null);
    submitQuote();
  }

  async function addToCart() {
    if (!quote) return;
    const res = await api.addCartItem(quote.id, quote.quantity);
    if (!res.ok) {
      setAnalysisError("Impossible d'ajouter au panier, réessayez.");
      return;
    }
    addedToCartRef.current = true;
    window.dispatchEvent(new Event("nasap3d-cart-changed"));
    setShowAddedToast(true);
    clearTimeout(toastTimerRef.current || undefined);
    toastTimerRef.current = setTimeout(() => setShowAddedToast(false), 4000);
  }

  return {
    step,
    file,
    fileError,
    dragging,
    previewUnavailable: previewUnavailable && !previewLoading,
    previewLoading,
    unit,
    scalePct,
    sizeMm,
    thinWallWarning,
    infillDropdownOpen,
    setInfillDropdownOpen,
    materialDropdownOpen,
    setMaterialDropdownOpen,
    qualityDropdownOpen,
    setQualityDropdownOpen,
    material,
    colorId,
    setColorId,
    infill,
    setInfill,
    quality,
    setQuality,
    qty,
    setQty,
    showDiscountInfo,
    setShowDiscountInfo,
    analyzing,
    analysisReady,
    analysisError,
    quote,
    showAddedToast,
    materials,
    discountTiers,
    fileInputRef,
    previewRef,
    analysisPreviewRef,
    effectiveScale,
    scaleFitsPrinter,
    selectMaterial,
    discountFor,
    dropFile,
    removeFile,
    onFileInputChange,
    onDragOver,
    onDragLeave,
    onDrop,
    onUnitChange,
    onScalePctChange,
    bumpScalePct,
    next,
    goStep,
    retryAnalysis,
    addToCart,
    zoomIn: () => previewHandleRef.current?.zoomIn?.(),
    zoomOut: () => previewHandleRef.current?.zoomOut?.(),
    setAnalysisReady,
    setQuote,
  };
}
