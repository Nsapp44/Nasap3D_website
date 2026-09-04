import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiBase } from "../lib/api-client";
import { dynamicImport } from "../lib/dynamic-import";
import { buildKiriDevice, buildKiriProcess, filamentLengthToWeightG, CLIENT_QUALITY_LAYER_HEIGHT } from "../lib/kiriProfiles";

const ALLOWED_EXT = [".stl", ".obj", ".3mf"];
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
  densityGCm3: number;
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

interface OrientedModel {
  positions: Float32Array;
  manifold: boolean;
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
  const [manifoldWarning, setManifoldWarning] = useState(false);
  // True while prepareOrientedModel (orientation + manifold check) is
  // in-flight for the currently-uploaded file — real user report: without
  // this, "Suivant" only checked manifoldWarning, which still holds its
  // default `false` until that async check actually resolves, so clicking
  // fast enough (or on a big/slow file) skipped straight past a check that
  // hadn't run yet, manifold and all. See next() below.
  const [orientationLoading, setOrientationLoading] = useState(false);
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
  // The best-of-6-rotations orientation suggestion (see orientationSuggest.js),
  // computed exactly once per upload — right away, not deferred to the
  // analysis step — so every consumer (preview, thin-wall check, manifold
  // check, slice) agrees on the same oriented geometry the server will
  // eventually bake into the stored/produced file. Previously each of those
  // ran its own independent orient-from-scratch, and neither preview ever
  // did it at all — the viewer always showed the raw as-uploaded rotation,
  // never what actually got sliced/priced/printed.
  const orientedModelPromiseRef = useRef<Promise<OrientedModel | null> | null>(null);
  // One persistent geometryWorker.js instance, created lazily on first
  // upload and reused for every file afterward (a fresh Worker per upload
  // would mean re-fetching/re-parsing its module graph each time) — see
  // getGeometryWorker below. Real report: the upload-time parse+orient+
  // manifold-check pipeline used to run inline on the main thread, so a big
  // file froze the page (no scrolling, no other clicks registering) for as
  // long as it took — moving it here doesn't make any single step faster,
  // but it stops blocking everything else while it runs.
  const geometryWorkerRef = useRef<Worker | null>(null);
  const geometryRequestIdRef = useRef(0);

  function getGeometryWorker(): Worker {
    if (!geometryWorkerRef.current) {
      geometryWorkerRef.current = new Worker(new URL("/geometryWorker.js", window.location.origin), { type: "module" });
    }
    return geometryWorkerRef.current;
  }

  // Wraps one request/response round-trip with the worker in a Promise,
  // keyed by an incrementing id so overlapping requests (a second file
  // dropped before the first one's worker response arrives) never get
  // crossed — matches a plain HTTP request/response pattern, just over
  // postMessage instead of fetch.
  function runInGeometryWorker(fileBuffer: ArrayBuffer, ext: string): Promise<{ positions: Float32Array; manifold: boolean }> {
    const worker = getGeometryWorker();
    const id = ++geometryRequestIdRef.current;
    return new Promise((resolve, reject) => {
      function cleanup() {
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
      }
      function onMessage(event: MessageEvent) {
        if (event.data.id !== id) return; // a different, still-in-flight request
        cleanup();
        if (event.data.error) reject(new Error(event.data.error));
        else resolve({ positions: event.data.positions, manifold: event.data.manifold });
      }
      // Without this, a worker that fails to even load (a 404 on the
      // script, a syntax error, a browser refusing module workers) never
      // sends a 'message' at all — onMessage above would then never fire,
      // and this promise would hang forever instead of rejecting. That
      // only ever hangs the one visitor's own upload (this Promise lives
      // in their browser tab, not the server), but it's still a real gap:
      // prepareOrientedModel's caller would wait on it indefinitely instead
      // of falling back to the as-uploaded file the way every other failure
      // path here already does.
      function onError(event: ErrorEvent) {
        cleanup();
        reject(new Error(event.message || "geometry worker failed to load"));
      }
      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      worker.postMessage({ id, fileBuffer, ext }, [fileBuffer]);
    });
  }

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

  // Parses + orients a freshly-uploaded file exactly once, caching the
  // in-flight/resolved promise in orientedModelPromiseRef so every consumer
  // (preview, thin-wall check, slice) awaits the same result instead of
  // redoing the work. Also runs the manifold/watertightness check here (at
  // upload, not deferred to the analysis step, on request — separates the
  // two steps' loading time: upload gets orientation+manifold, "Analyse
  // auto" gets slice+thin-wall). manifoldWarning below is a real, hard
  // block on step 1 (see `next()`) — the file has to actually be fixed
  // before continuing, not just a heads-up.
  // Returns null for anything that isn't STL/OBJ/3MF (shouldn't happen
  // given ALLOWED_EXT, defensive) or on a genuine parse failure — callers
  // fall back to the raw as-uploaded file/skip the check silently, same
  // best-effort spirit as the rest of this client-side path (the server
  // always independently re-validates and falls back on its own full slice
  // regardless).
  //
  // The actual parse+orient+manifold-check work happens in geometryWorker.js
  // (see runInGeometryWorker above), not inline here — real report: on a
  // large file this used to block the main thread for the whole duration
  // (confirmed live: up to ~5s on a 1M-triangle 3MF before threeMfLoader.js
  // was also sped up — see its own comment), freezing the page (no
  // scrolling, no other clicks) for as long as it took. Moving it off-thread
  // doesn't make the work itself faster, just stops it from blocking
  // everything else meanwhile.
  function prepareOrientedModel(targetFile: File): Promise<OrientedModel | null> {
    const promise = (async (): Promise<OrientedModel | null> => {
      try {
        const ext = "." + targetFile.name.split(".").pop()!.toLowerCase();
        const { isKiriSliceable } = await dynamicImport("/kiri-slicer.js");
        if (!isKiriSliceable(ext)) return null;
        const buffer = await targetFile.arrayBuffer();
        if (fileRef.current !== targetFile) return null;
        // Bad-edge-fraction heuristic (orientationSuggest.js's
        // checkManifoldAndParts, ported from orientation.ts's server-side
        // version) — NOT the strict Manifold-library check
        // (manifoldCheck.js): confirmed live that library rejects two real,
        // genuinely printable customer files outright (NotManifold, no
        // tolerance), while this heuristic's existing 1%-bad-edge tolerance
        // correctly accepts both (0.007% and 0.26% bad edges respectively)
        // and still flags real breakage (a genuine hole pushes this into
        // the tens of percent). This one actually BLOCKS — real, upfront
        // rejection right at upload, not just a warning — so a flood of
        // genuinely broken files never even reaches a slice attempt,
        // client or server.
        const { positions, manifold } = await runInGeometryWorker(buffer, ext);
        if (fileRef.current !== targetFile) return null;
        return { positions, manifold };
      } catch (e) {
        console.warn("prepareOrientedModel failed, falling back to as-uploaded", e);
        return null;
      }
    })();
    orientedModelPromiseRef.current = promise;
    promise.then((result) => {
      if (fileRef.current !== targetFile) return;
      setManifoldWarning(result ? !result.manifold : false);
      setOrientationLoading(false);
    });
    return promise;
  }
  useEffect(() => {
    if (file) {
      setOrientationLoading(true);
      prepareOrientedModel(file);
    } else {
      orientedModelPromiseRef.current = null;
      setManifoldWarning(false);
      setOrientationLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file]);

  async function renderInto(ref: React.RefObject<HTMLDivElement | null>, handleRef: React.RefObject<PreviewHandle | null>, extraOpts?: Record<string, unknown>) {
    if (handleRef.current) {
      handleRef.current.dispose();
      handleRef.current = null;
    }
    if (!file || !ref.current) return null;
    const targetFile = file;
    const { isRenderableExt, renderModelPreview } = await dynamicImport("/viewer3d.js");

    // Wait for the oriented model (if this file qualifies for one) so the
    // preview always shows the same rotation that gets sliced/priced/
    // produced — never the raw as-uploaded orientation. Rendered from real,
    // already-parsed geometry directly (no STL encode/re-parse round trip,
    // see viewer3d.js's `positions` option). Falls back to parsing the raw
    // file (previous behavior) when orientation isn't available for this
    // file (STEP, or a genuine parse failure).
    const oriented = orientedModelPromiseRef.current ? await orientedModelPromiseRef.current : null;
    if (fileRef.current !== targetFile || !ref.current) return null; // stale by the time this resolved
    const mat = materials.find((m) => m.key === material);
    const color = mat ? mat.colors.find((c) => c.id === colorId)?.colorHex : null;
    let handle;
    if (oriented) {
      setPreviewUnavailable(false);
      handle = await renderModelPreview(ref.current, { positions: oriented.positions, colorHex: color, ...extraOpts });
    } else {
      const ext = "." + targetFile.name.split(".").pop()!.toLowerCase();
      const buffer = await targetFile.arrayBuffer();
      if (fileRef.current !== targetFile || !ref.current) return null;
      if (!isRenderableExt(ext)) {
        setPreviewUnavailable(true);
        return null;
      }
      setPreviewUnavailable(false);
      handle = await renderModelPreview(ref.current, { fileBuffer: buffer, ext, colorHex: color, ...extraOpts });
    }
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

  // Best-effort, approximate. Casts a ray inward from every triangle's
  // center along its inverse normal, same idea a slicer uses for a
  // wall-thickness check. Never blocks the quote, just flags a likely-thin
  // area. Runs on the already-oriented flat positions array (see
  // prepareOrientedModel/geometryWorker.js) — same geometry that gets
  // sliced/priced/produced, and no longer STL-only (that restriction was
  // only ever about the old STLLoader-based parsing this function used to
  // do itself; now that orientation already normalized every accepted
  // format into this same flat shape upstream, OBJ/3MF get checked too, for
  // free).
  //
  // BVH-accelerated (three-mesh-bvh, vendored — see
  // public/vendor/three-mesh-bvh/THIRD_PARTY_NOTICES.md): each raycast used
  // to be a brute-force O(triangle count) scan, which is why this used to
  // cap itself to a sparse sample (MAX_RAY_TRIANGLE_COST) instead of testing
  // the whole mesh. With a real BVH each query is ~O(log n), so the sample
  // cap is gone — every triangle gets tested now, the same accuracy
  // improvement for free.
  async function checkThinWalls(targetFile: File, positions: Float32Array | null) {
    if (!positions || positions.length === 0) return;
    try {
      const THREE = await dynamicImport("/vendor/three/three.module.min.js");
      const { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } = await dynamicImport(
        "/vendor/three-mesh-bvh/index.module.js",
      );
      // Idempotent prototype patch — cheap to redo on every call, and
      // avoids a module-load-order dependency on doing it exactly once
      // somewhere else.
      THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
      THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
      THREE.Mesh.prototype.raycast = acceleratedRaycast;

      const triCount = positions.length / 9;
      if (triCount === 0) return;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      const pos = geometry.attributes.position;
      geometry.computeVertexNormals();
      geometry.computeBoundsTree();
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
      // 4mm² minimum thin area, not 2mm² — a textured/detailed mesh
      // (embossed logo, engraved text, surface texture) has plenty of
      // individual facets whose nearest ray hit is some other
      // nearby-but-unrelated bump, not the true opposite wall; each one only
      // contributes its own tiny triangle area, so a low threshold flagged
      // perfectly printable parts as "thin" just from texture noise. The
      // main defense against that is MIN_HIT_NORMAL_ALIGNMENT below (reject
      // hits that aren't a genuine opposite wall); this area floor only
      // needs to catch the rare single/handful of aligned but still-
      // spurious hits slipping past that filter, not do the heavy lifting
      // itself — a real thin-wall problem still shows up well past 4mm².
      const MIN_THIN_AREA_MM2 = 4;
      // A genuine thin wall's opposite face points roughly the same way the
      // ray travels (two near-parallel surfaces facing away from each
      // other) — texture noise on a detailed mesh tends to hit facets at
      // much more oblique angles, which this filters out. cos(60°) = 0.5:
      // hits more than 60° off the ray direction don't count.
      const MIN_HIT_NORMAL_ALIGNMENT = 0.5;
      const step = 1;
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
        const hit = hits[0];
        const aligned = hit?.face && hit.face.normal.dot(raycaster.ray.direction) >= MIN_HIT_NORMAL_ALIGNMENT;
        if (hit && hit.distance < THRESHOLD_MM && aligned) {
          const triArea = b.clone().sub(a).cross(c.clone().sub(a)).length() / 2;
          thinAreaMm2 += triArea * step * scale * scale;
          if (thinAreaMm2 >= MIN_THIN_AREA_MM2) {
            setThinWallWarning(true);
            geometry.disposeBoundsTree();
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
      geometry.disposeBoundsTree();
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
      if (geometryWorkerRef.current) {
        geometryWorkerRef.current.terminate();
        geometryWorkerRef.current = null;
      }
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
      setFileError("Format non supporté — utilisez .stl, .obj ou .3mf");
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
    setManifoldWarning(false);
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

  // Real client-side slice via Kiri:Moto (public/kiri-slicer.js) — the
  // primary path (see the Kiri:Moto plan): the visitor's own device
  // computes the real weight/time instead of queuing behind everyone
  // else's on the server. No manifold pre-check here — that already ran
  // and blocked at upload (see prepareOrientedModel), so anything reaching
  // this function has already passed it.
  // `positions`: the already-oriented flat array from prepareOrientedModel
  // (geometryWorker.js) — null means orientation itself failed/unavailable
  // for this file, in which case this returns null immediately and the
  // server's own full slice fallback handles everything (same best-effort
  // spirit as before).
  async function tryClientSlice(
    targetFile: File,
    positions: Float32Array | null,
  ): Promise<{ weightG: number; estimatedTimeMin: number } | null> {
    if (!positions) return null;
    try {
      const mat = materials.find((m) => m.key === material);
      if (!mat) return null;

      const { sliceWithKiri } = await dynamicImport("/kiri-slicer.js");
      const layerHeightMm = CLIENT_QUALITY_LAYER_HEIGHT[quality] ?? 0.2;
      const stats = await sliceWithKiri({
        orientedPositions: positions,
        deviceJson: buildKiriDevice(),
        processJson: buildKiriProcess(quality, layerHeightMm, infill, material),
      });
      if (fileRef.current !== targetFile) return null;
      return {
        weightG: filamentLengthToWeightG(stats.filamentMm, mat.densityGCm3),
        estimatedTimeMin: stats.estimatedTimeMin,
      };
    } catch (e) {
      console.warn("client-side kiri slice failed, server will fall back", e);
      return null;
    }
  }

  async function submitQuote() {
    if (!file || !colorId) {
      setAnalysisError("Options incomplètes — retournez à l'étape précédente.");
      return;
    }
    setAnalyzing(true);
    setAnalysisError(null);
    const targetFile = file;
    const oriented = orientedModelPromiseRef.current ? await orientedModelPromiseRef.current : null;
    if (fileRef.current !== targetFile) return; // superseded while awaiting orientation
    const positions = oriented ? oriented.positions : null;
    const thinWallPromise = checkThinWalls(targetFile, positions);
    const clientSlice = await tryClientSlice(targetFile, positions);
    const res = await api.submitQuote({
      file,
      material,
      colorId,
      quality,
      infillPct: infill,
      quantity: qty,
      scale: effectiveScale(),
      clientWeightG: clientSlice?.weightG,
      clientEstimatedTimeMin: clientSlice?.estimatedTimeMin,
    });
    if (!res.ok) {
      const messages: Record<string, string> = {
        quote_disabled: "Le devis instantané est momentanément indisponible.",
        part_too_large: "Cette pièce dépasse le volume imprimable de toutes nos machines (max 330×320×325mm). Possibilité d'imprimer vos pièces en plusieurs morceaux, utilisez le formulaire de contact.",
        non_manifold_model: "Le modèle contient des erreurs de géométrie (maillage non étanche) — vérifiez le fichier dans votre logiciel de CAO.",
        unreadable_file: "Fichier illisible — vérifiez qu'il s'agit bien d'un .stl, .obj ou .3mf valide.",
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
    if (step === 1 && (!scaleFitsPrinter() || manifoldWarning || orientationLoading)) return;
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
    // Going back to step 2 (material/quality/infill/qty) invalidates the
    // analysis done for the settings the visitor is about to change —
    // without this, next() at line ~455 sees analysisReady still true from
    // the previous run and skips submitQuote() entirely, showing stale
    // price/weight for options that were never actually re-sliced.
    if (n < 3 && analysisReady) {
      setAnalysisReady(false);
      setQuote(null);
    }
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
    manifoldWarning,
    orientationLoading,
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
