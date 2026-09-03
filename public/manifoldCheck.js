// Real manifold/watertightness check via Manifold (elalish/manifold,
// Apache-2.0) — replaces the hand-rolled edge-pairing heuristic
// (src/lib/server/orientation.ts's checkManifoldAndParts) with the same
// battle-tested geometry kernel Kiri:Moto itself uses internally for CSG.
// Vendored separately from Kiri:Moto's own bundled copy of manifold.wasm
// (public/vendor/kiri/manifold.wasm) rather than reusing it: that copy was
// fetched from grid.space's own build (unknown exact version/ABI), while
// this one is manifold-3d@3.5.1's own matching js+wasm pair straight from
// the package registry — mixing a wrapper with a WASM binary from a
// different build is a real risk of a hard-to-debug ABI mismatch, so this
// trades a second small WASM file on disk for guaranteed compatibility.
//
// Runs client-side first (this file) — the server has its own independent
// copy for the cases that need it (see src/lib/server/manifoldCheck.ts):
// the rare full-slice fallback, and as a cross-check the client can't be
// trusted to self-report honestly for. Both use the exact same library and
// the same vertex-quantization/indexing logic, so they agree on the same
// input.

let manifoldLoadPromise = null;
function loadManifold() {
  if (manifoldLoadPromise) return manifoldLoadPromise;
  manifoldLoadPromise = import('/vendor/manifold/manifold.js').then(async (mod) => {
    const factory = mod.default;
    const wasm = await factory({ locateFile: () => '/vendor/manifold/manifold.wasm' });
    wasm.setup();
    return wasm;
  });
  return manifoldLoadPromise;
}

// Manifold's Mesh needs an INDEXED mesh (deduplicated vertProperties +
// triVerts indices), not the flat triangle-soup shape the rest of this
// project's client-side code uses (kiri-slicer.js, orientationSuggest.js).
// Same quantization tolerance as the server's own vertexKey() (1e-4mm) —
// merges vertices that coincide up to normal STL/OBJ export round-tripping
// noise, without merging genuinely distinct nearby points.
function trianglesToIndexedMesh(triangles) {
  const vertexId = new Map();
  const vertProperties = [];
  const triVerts = [];
  function idOf(p) {
    const key = `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(p[2] * 1e4)}`;
    let id = vertexId.get(key);
    if (id === undefined) {
      id = vertexId.size;
      vertexId.set(key, id);
      vertProperties.push(p[0], p[1], p[2]);
    }
    return id;
  }
  for (const t of triangles) {
    for (const p of t.v) triVerts.push(idOf(p));
  }
  return { vertProperties: new Float32Array(vertProperties), triVerts: new Uint32Array(triVerts) };
}

// Same degenerate-facet filter as the server (src/lib/server/orientation.ts)
// — a handful of near-zero-area slivers from a real CAD/STL export
// shouldn't fail a mesh that a real slicer would happily print. Manifold's
// own constructor doesn't tolerate these the way a fuzzy heuristic can, so
// filtering them out first matters more here than it did server-side.
const DEGENERATE_AREA_MM2 = 1e-6;
function triangleArea(v) {
  const [a, b, c] = v;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  return Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
}

// Returns { manifold: boolean, status: string } — status is Manifold's own
// ErrorStatus string ('NoError' when manifold, 'NotManifold'/
// 'NonFiniteVertex'/etc. otherwise) — confirmed live: the constructor
// actually *throws* a ManifoldError with `.code` set to this same string on
// invalid input, it does NOT just return an empty Manifold with a status()
// to read afterward the way the C++ docs describe — both paths are handled
// here.
export async function checkManifold(triangles) {
  const wasm = await loadManifold();
  const clean = triangles.filter((t) => triangleArea(t.v) > DEGENERATE_AREA_MM2);
  if (clean.length === 0) return { manifold: false, status: 'Empty' };

  const { vertProperties, triVerts } = trianglesToIndexedMesh(clean);
  const mesh = new wasm.Mesh({ numProp: 3, vertProperties, triVerts });
  try {
    const manifold = new wasm.Manifold(mesh);
    const status = manifold.status();
    manifold.delete();
    return { manifold: status === 'NoError', status };
  } catch (e) {
    return { manifold: false, status: (e && e.code) || 'NotManifold' };
  }
}
