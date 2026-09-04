// Client-side real slicing via Kiri:Moto (public/vendor/kiri/engine.js,
// vendored — see public/vendor/kiri/THIRD_PARTY_NOTICES.md), used so the
// visitor's own device does the actual weight/time computation instead of
// the server queuing behind everyone else's — see src/hooks/useQuoteWizard.ts
// for how the result feeds into the quote flow, and src/pages/api/quotes/
// index.ts for how the server cheaply re-validates it before trusting it.

let kiriLoadPromise = null;
// engine.js is a real ES module (confirmed: `export{wm as Engine, AeA as
// newEngine}`), unlike occt-import-js's classic Emscripten build in
// viewer3d.js's loadOcct() — plain import() works, no <script> tag needed.
// Absolute path for the same reason as loadOcct(): this file is loaded from
// pages at varying routes (/devis-instantane, /panier via the cart's own
// re-quote flow if ever added), a relative import would depend on the
// current page's URL shape.
function loadKiri() {
  if (kiriLoadPromise) return kiriLoadPromise;
  kiriLoadPromise = import('/vendor/kiri/engine.js');
  return kiriLoadPromise;
}

// STL/OBJ/3MF — the instant quote's full accepted format list. STEP isn't
// accepted for quotes at all (see useQuoteWizard.ts's ALLOWED_EXT).
export function isKiriSliceable(ext) {
  return ext === '.stl' || ext === '.obj' || ext === '.3mf';
}

// Kiri:Moto's own engine.parse() only understands STL — confirmed by
// reading grid-apps' source directly: even the real production browser
// build's parse() hardcodes `new load.STL().parse(data)` internally, not
// just the Node CLI's simplified engine. So every format is normalized to a
// flat triangle list first (STL/OBJ/3MF alike), reusing the exact same
// loaders viewer3d.js already uses for preview (OBJLoader,
// threeMfLoader.js) — this also gives a single place to apply the print-
// orientation suggestion before slicing (see below), instead of only doing
// that server-side.
export async function loadTriangles(fileBuffer, ext) {
  if (ext === '.stl') {
    const { parseStlTriangles } = await import('/orientationSuggest.js');
    return parseStlTriangles(fileBuffer);
  }

  if (ext === '.obj') {
    const { trianglesFromFlatPositions } = await import('/orientationSuggest.js');
    const { OBJLoader } = await import('/vendor/three/OBJLoader.js');
    const text = new TextDecoder().decode(fileBuffer);
    const group = new OBJLoader().parse(text);
    const positions = [];
    group.traverse((child) => {
      if (!child.isMesh) return;
      const pos = child.geometry.attributes.position;
      const idx = child.geometry.index;
      if (idx) {
        for (let i = 0; i < idx.count; i++) {
          const vi = idx.getX(i);
          positions.push(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
        }
      } else {
        for (let i = 0; i < pos.count; i++) positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    });
    return trianglesFromFlatPositions(positions);
  }

  if (ext === '.3mf') {
    const { trianglesFromFlatPositions } = await import('/orientationSuggest.js');
    const { read3mfFile } = await import('/threeMfLoader.js');
    const result = await read3mfFile(fileBuffer);
    // Merge every mesh object into one flat triangle list — same
    // best-effort scope as the server-side 3mf reader (no per-object build
    // transforms), see src/lib/server/threeMfParse.ts's own comment.
    const positions = [];
    for (const mesh of result.meshes) {
      const pos = mesh.attributes.position.array;
      const idx = mesh.index.array;
      for (let i = 0; i < idx.length; i++) {
        const vi = idx[i] * 3;
        positions.push(pos[vi], pos[vi + 1], pos[vi + 2]);
      }
    }
    return trianglesFromFlatPositions(positions);
  }

  throw new Error('unsupported extension for kiri: ' + ext);
}

// Flat, non-indexed position array (3 floats × 3 verts per triangle) — the
// shape three.js's BufferGeometry wants directly. Exported so
// useQuoteWizard.ts can hand the oriented preview straight to viewer3d.js
// as real geometry (see renderModelPreview's `positions` option) instead of
// round-tripping through binary STL bytes just to have STLLoader parse them
// straight back out again — that encode/decode step is real, avoidable
// work, only actually needed where a real STL buffer is the required input
// (Kiri:Moto's own engine.parse(), see sliceWithKiri below).
export function trianglesToPositions(triangles) {
  const positions = new Float32Array(triangles.length * 9);
  let i = 0;
  for (const t of triangles) {
    for (const p of t.v) {
      positions[i++] = p[0];
      positions[i++] = p[1];
      positions[i++] = p[2];
    }
  }
  return positions;
}

function trianglesToBinaryStl(triangles, geometryToBinaryStl) {
  return geometryToBinaryStl(trianglesToPositions(triangles), null);
}

// Best-effort print-orientation suggestion applied to a raw triangle list —
// factored out of sliceWithKiri so useQuoteWizard.ts can run this exactly
// once per upload (right away, so the preview shows it) instead of once per
// slice/thin-wall-check/manifold-check, each silently re-deriving the same
// answer from scratch. A parse hiccup or unusual mesh just means no
// rotation applied (same fallback as always), never blocks anything.
export async function orientTriangles(rawTriangles) {
  const { suggestOrientation, applyRotation } = await import('/orientationSuggest.js');
  try {
    const suggestion = suggestOrientation(rawTriangles);
    if (suggestion) return applyRotation(rawTriangles, suggestion.rotateXDeg, suggestion.rotateYDeg);
  } catch (e) {
    console.warn('suggestOrientation failed, using as-uploaded', e);
  }
  return rawTriangles;
}

// Real print time in the exported gcode's own trailer comment is the
// authoritative source of truth over anything computed mid-slice — same
// principle as reading PrusaSlicer's own gcode comments server-side
// (src/lib/server/slicer.ts's parseGcodeTime) rather than trusting an
// intermediate estimate.
function parseKiriGcodeStats(gcode) {
  const filamentMatch = gcode.match(/--- filament used: ([\d.]+) mm ---/);
  const timeMatch = gcode.match(/--- print time: (\d+)s ---/);
  if (!filamentMatch || !timeMatch) return null;
  return {
    filamentMm: parseFloat(filamentMatch[1]),
    estimatedTimeMin: parseInt(timeMatch[1], 10) / 60,
  };
}

// deviceJson/processJson: plain objects built by src/lib/kiriProfiles.ts —
// kept as parameters here (not hardcoded) so this file stays a thin,
// framework-agnostic wrapper around the engine, same division of
// responsibility as viewer3d.js vs. its callers.
// `rawTriangles`: optional — pass an already-parsed triangle list (still
// UNORIENTED — this still runs orientTriangles() on it) when the caller has
// one, to avoid parsing the same file twice.
// `orientedTriangles`: optional — pass an ALREADY-ORIENTED triangle list
// (from a prior orientTriangles() call) to skip both parsing and
// reorientation entirely. Takes priority over `rawTriangles` when given.
// `orientedPositions`: optional, and takes priority over both of the above
// — the flat position array useQuoteWizard.ts's geometryWorker.js already
// produces (see that file's own comment for why it hands back this flat
// shape and not Triangle[]). Skips trianglesToBinaryStl's own
// triangles→positions conversion entirely since this is already that exact
// shape.
// Matching the server's own choice matters here — the stored file (and any
// server-side fallback slice) gets this exact same suggestion applied, so
// the client's trusted weight/time has to agree with what actually ends up
// printed, not some other orientation.
export async function sliceWithKiri({ fileBuffer, ext, deviceJson, processJson, rawTriangles: preParsed, orientedTriangles, orientedPositions }) {
  const { geometryToBinaryStl } = await import('/stlExport.js');

  let stlBuffer;
  if (orientedPositions) {
    stlBuffer = geometryToBinaryStl(orientedPositions, null);
  } else {
    const triangles = orientedTriangles || (await orientTriangles(preParsed || (await loadTriangles(fileBuffer, ext))));
    stlBuffer = trianglesToBinaryStl(triangles, geometryToBinaryStl);
  }

  const { newEngine } = await loadKiri();
  // workURL: engine.js's own default worker script path is a hardcoded
  // relative reference ("../lib/kiri/run/worker.js", resolved against
  // grid.space's own directory layout) that 404s under our vendoring —
  // confirmed live: without this, the real Worker fails to load
  // (`onerror` fires, logged as {WORKER_ERROR}), and the slice hangs
  // forever waiting for replies from a worker that was never created,
  // with no rejection ever surfacing. Same root cause and same fix as the
  // manifold.wasm path patch already applied to both engine.js and this
  // worker.js file at vendoring time (see THIRD_PARTY_NOTICES.md) — an
  // absolute path that resolves correctly regardless of which page loads it.
  //
  // poolURL: separate from workURL and easy to miss — worker.js spins up
  // its own pool of "minion" sub-workers (real CPU-core-count parallelism
  // for the heavy per-layer work, support generation especially) via a
  // SECOND hardcoded relative path ("./minion.js", resolved against
  // worker.js's own location this time, not engine.js's) — also 404s
  // without this, silently (logged as {MINION_ERROR}, easy to miss since
  // it fires once per would-be minion, not as a blocking error). Without
  // it the whole slice runs on the single main worker alone: confirmed
  // live this was the actual cause of a real customer file (113k
  // triangles, 15 separate parts) taking 2+ minutes here while grid.space's
  // own site — same engine version, same settings, but a real minion pool
  // — sliced it in well under 30s.
  const engine = newEngine({ workURL: '/vendor/kiri/worker.js', poolURL: '/vendor/kiri/minion.js' });
  try {
    await engine.parse(stlBuffer);
    engine.setDevice(deviceJson);
    engine.setProcess(processJson);
    engine.setMode('FDM');
    await engine.slice();
    await engine.prepare();
    const gcode = await engine.export();
    const stats = parseKiriGcodeStats(gcode);
    if (!stats) throw new Error('kiri gcode missing expected trailer comments');
    return stats;
  } finally {
    // Best-effort cleanup — no confirmed engine.destroy()-equivalent in the
    // API surface checked so far; if slicing repeatedly leaks memory this
    // is the first place to revisit.
  }
}
