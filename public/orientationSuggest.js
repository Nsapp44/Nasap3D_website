// Browser-native port of src/lib/server/orientation.ts's suggestOrientation()
// — same algorithm, same weights, same candidates, verbatim — so the
// client's own Kiri:Moto slice (public/kiri-slicer.js) picks the exact same
// print orientation the server will end up baking into the stored file
// (src/pages/api/quotes/index.ts). Ported rather than imported because the
// server version parses STL via node:Buffer, which isn't available here;
// this file works on plain ArrayBuffer/DataView and flat Float32Array
// position/index geometry instead, matching what the browser's own
// STL/OBJ/3MF loaders already produce.

// Binary STL: 80-byte header + uint32 triangle count, then 50 bytes/tri (12
// bytes normal + 36 bytes vertices + 2-byte attribute). ASCII STL: text
// "facet normal / outer loop / vertex ×3 / endloop / endfacet" blocks.
// Same detection heuristic as the server parser: check whether the binary
// header's triangle count actually accounts for the rest of the file's
// length.
export function parseStlTriangles(buffer) {
  if (buffer.byteLength >= 84) {
    const view = new DataView(buffer);
    const count = view.getUint32(80, true);
    if (84 + count * 50 === buffer.byteLength) return parseBinaryStl(view, count);
  }
  return parseAsciiStl(new TextDecoder().decode(buffer));
}

function parseBinaryStl(view, count) {
  const triangles = [];
  let offset = 84;
  for (let i = 0; i < count; i++) {
    const v = [
      [view.getFloat32(offset + 12, true), view.getFloat32(offset + 16, true), view.getFloat32(offset + 20, true)],
      [view.getFloat32(offset + 24, true), view.getFloat32(offset + 28, true), view.getFloat32(offset + 32, true)],
      [view.getFloat32(offset + 36, true), view.getFloat32(offset + 40, true), view.getFloat32(offset + 44, true)],
    ];
    triangles.push({ v });
    offset += 50;
  }
  return triangles;
}

function parseAsciiStl(text) {
  const triangles = [];
  const vertexRe = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  const facetRe = /facet normal[\s\S]*?endfacet/g;
  const facets = text.match(facetRe) || [];
  for (const facet of facets) {
    const verts = [];
    let vm;
    vertexRe.lastIndex = 0;
    while ((vm = vertexRe.exec(facet))) verts.push([parseFloat(vm[1]), parseFloat(vm[2]), parseFloat(vm[3])]);
    if (verts.length === 3) triangles.push({ v: verts });
  }
  return triangles;
}

// Same conversion from a flat (non-indexed) position array as the OBJ/3MF
// loaders in kiri-slicer.js already produce — 3 consecutive [x,y,z] triples
// per triangle.
export function trianglesFromFlatPositions(positions) {
  const triangles = [];
  for (let i = 0; i + 8 < positions.length; i += 9) {
    triangles.push({
      v: [
        [positions[i], positions[i + 1], positions[i + 2]],
        [positions[i + 3], positions[i + 4], positions[i + 5]],
        [positions[i + 6], positions[i + 7], positions[i + 8]],
      ],
    });
  }
  return triangles;
}

function triangleArea(v) {
  const [a, b, c] = v;
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
  const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  return Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
}

// Ported verbatim from src/lib/server/orientation.ts's checkManifoldAndParts
// — a closed 2-manifold mesh has every edge shared by exactly 2 triangles;
// a boundary edge (count 1, a hole) fails printability, judged as a
// tolerance (MAX_BAD_EDGE_FRACTION) rather than an absolute rule, same
// reasoning as that file's own comment: real STL/OBJ exports (even ones
// real slicers accept fine) virtually always carry a handful of boundary
// edges from floating-point precision or minor CAD-tessellation seams —
// confirmed live on two real customer files (0.007% and 0.26% bad-edge
// fraction respectively, both well under this 1% tolerance).
//
// Only an ODD edge count counts as bad — not just "count !== 2". A real
// customer file (a bowl, exported with its shell duplicated — a common CAD
// export artifact, e.g. a revolved surface exported twice) had 21.6% of its
// edges at count 4 or 8, tripping the old "!= 2" rule outright, despite
// being genuinely fine to print (confirmed against the same file: no actual
// gaps, real slicers treat duplicate overlapping surfaces as reinforcing
// the same wall, not a defect). Proven with a direct test before this
// change: a closed cube's edges are all count=2; removing one triangle (a
// real hole) leaves that hole's boundary at count=1 — ODD; duplicating a
// whole closed sub-shell leaves its edges at count=4, 6, 8... — always
// EVEN, never a genuine gap. A single missing triangle always drops its 3
// edges from 2 to 1 (odd) — a real opening can never leave a clean even
// count behind, so this distinction doesn't trade away real-hole detection.
const DEGENERATE_AREA_MM2 = 1e-6;
const MAX_BAD_EDGE_FRACTION = 0.01;

export function checkManifoldAndParts(triangles) {
  const clean = triangles.filter((t) => triangleArea(t.v) > DEGENERATE_AREA_MM2);
  if (clean.length === 0) return { manifold: false, parts: 0 };

  const vertexId = new Map();
  const parent = [];
  function idOf(p) {
    const key = `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(p[2] * 1e4)}`;
    let id = vertexId.get(key);
    if (id === undefined) {
      id = parent.length;
      vertexId.set(key, id);
      parent.push(id);
    }
    return id;
  }
  function find(x) {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a, b) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  const edgeCount = new Map();
  for (const t of clean) {
    const ids = t.v.map(idOf);
    for (let i = 0; i < 3; i++) {
      const a = ids[i], b = ids[(i + 1) % 3];
      union(a, b);
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  }

  let badEdges = 0;
  for (const count of edgeCount.values()) {
    if (count % 2 !== 0) badEdges++;
  }
  const manifold = badEdges / edgeCount.size <= MAX_BAD_EDGE_FRACTION;

  const roots = new Set();
  for (let i = 0; i < parent.length; i++) roots.add(find(i));

  return { manifold, parts: roots.size };
}

const CANDIDATES = [
  { rotateXDeg: 0, rotateYDeg: 0 },
  { rotateXDeg: 180, rotateYDeg: 0 },
  { rotateXDeg: 90, rotateYDeg: 0 },
  { rotateXDeg: -90, rotateYDeg: 0 },
  { rotateXDeg: 0, rotateYDeg: 90 },
  { rotateXDeg: 0, rotateYDeg: -90 },
];

export function rotatePoint(p, xDeg, yDeg) {
  const xr = (xDeg * Math.PI) / 180, yr = (yDeg * Math.PI) / 180;
  let [x, y, z] = p;
  const y2 = y * Math.cos(xr) - z * Math.sin(xr);
  let z2 = y * Math.sin(xr) + z * Math.cos(xr);
  y = y2; z = z2;
  const x2 = x * Math.cos(yr) + z * Math.sin(yr);
  z2 = -x * Math.sin(yr) + z * Math.cos(yr);
  x = x2; z = z2;
  return [x, y, z];
}

// 50°, not 45° — matches the real engine's own overhang test exactly
// (confirmed by reading vendor/grid-apps/src/kiri-mode/fdm/slice.js's
// FDM.supports live: `thresh = -Math.sin(process.sliceSupportAngle * PI/180)`,
// and this project's own sliceSupportAngle is 50, see kiriProfiles.ts).
const OVERHANG_NORMAL_Z = -Math.sin((50 * Math.PI) / 180);
const BED_CONTACT_EPSILON_MM = 0.05;
// Overhang is weighted by AREA × HEIGHT ABOVE THE BED, not raw area alone —
// found by direct empirical testing (real Kiri:Moto slices, all 6
// candidates, on real customer files): raw overhang area picked the true
// lightest orientation only 2 of 6 times, and on one file (a real, detailed
// mesh) it picked the single WORST candidate outright. Root cause, found by
// reading the real engine's own support code: material cost isn't
// proportional to overhang area, it's proportional to area × the vertical
// gap a support pillar has to bridge (FDM.supports raycasts straight down
// from each overhang point and builds a pillar to whatever it hits) — a
// wide overhang sitting low, close to the bed or another part of the print,
// costs little; a small overhang stranded high in the air costs a lot. This
// height-above-bed weighting (cheap: no raycasting, no occlusion grid, just
// the Z already computed for the bed-contact test below) is a rougher proxy
// than a real per-triangle gap-to-nearest-surface test — occlusion by other
// parts of the mesh is ignored — but it was tested both ways: adding a full
// 2D occlusion grid on top of this weighting did NOT measurably improve the
// real-file match rate any further, so the extra complexity wasn't kept.
// This simpler version matched the real lightest orientation on 4 of the
// same 6 files (vs 2 of 6 for plain area, and it never again picked the
// outright worst candidate) — a real, verified improvement, not a
// theoretical one, though still not a perfect predictor (a real slice is
// the only way to know for certain — see the analysis-step slice this
// orientation feeds into).
//
// BASE_GAP_MM: a real support pillar costs SOMETHING even when the gap it
// bridges is tiny (a base/interface layer, not a zero-height point) — a
// pure height-above-bed weight treats a large, low-lying overhang as
// almost free, which real-file testing showed is wrong (one real file's
// real-lightest orientation was mis-ranked by 15% for exactly this case:
// a wide, near-bed overhang scored as "cheap" that in the real slice
// wasn't). Adding this flat floor to every overhang triangle's height term
// fixed it — swept 0-50mm against the same real measurements, matches
// stayed flat from 6mm up, average real-material regret dropped from 2.8%
// to 0.4% and worst-case regret from 14.7% to 2.3% (the remaining miss is
// a tiny/near-symmetric synthetic test cube, not a real part). Not tied to
// any specific engine setting (sliceSupportGap etc.) — picked from the
// middle of the plateau where the real numbers stopped improving.
const BASE_GAP_MM = 6;
const W_OVERHANG = 3;
const W_HEIGHT = 0.05;
const W_CONTACT = 0.3;

// All 6 CANDIDATES are 90°-multiple axis rotations — for those (unlike an
// arbitrary angle), a rotated point's Z coordinate is always exactly one of
// the ORIGINAL x/y/z components, sign possibly flipped, never an actual
// trig computation. Confirmed live against rotatePoint() itself (same
// vector, all 6 candidates): (0,0)->z, (180,0)->-z, (90,0)->y, (-90,0)->-y,
// (0,90)->-x, (0,-90)->x — this array is that lookup table, in the exact
// same order as CANDIDATES above. Since a normal vector rotates by exactly
// the same transform as any other vector under a pure rotation (no
// scale/shear involved), the same picks apply to (nx,ny,nz) too — one
// function serves both roles below.
const CANDIDATE_Z_PICKS = [
  (x, y, z) => z,
  (x, y, z) => -z,
  (x, y, z) => y,
  (x, y, z) => -y,
  (x, y, z) => -x,
  (x, y, z) => x,
];

// Port of orientation.ts's suggestOrientation() — same 6 axis-aligned
// candidates, same overhang/height/contact-area scoring, same weights. See
// that file for the reasoning behind each weight and the
// bed-contact/overhang mutual-exclusivity fix.
//
// Two stacked optimizations, both confirmed live on the same real
// 1.15M-triangle file (baseline: a naive "rotate every point, re-derive
// area+normal via cross product from scratch, redo all of that for each of
// the 6 candidates" implementation took 4.2s, the dominant cost of the
// whole upload step by a huge margin — everything else, parse+normals+etc
// combined, was ~300ms):
//  1. Area and normal direction are properties of the ORIGINAL geometry — a
//     rigid rotation doesn't change a triangle's area at all, and (per
//     CANDIDATE_Z_PICKS above) its rotated normal-Z is just a component
//     pick, not a new cross product — so both are computed exactly ONCE per
//     triangle below, not re-derived per candidate. Tried alone first:
//     measured 575ms — real, but far short of what the reduced FLOP count
//     alone predicts, because allocating a precomputed {a,b,c,nx,ny,nz,area}
//     object for all 1.15M triangles has its own real JS engine cost.
//  2. Deterministic subsampling on top (MAX_SAMPLE_TRIANGLES, evenly
//     strided — not Math.random(): client and server must land on the exact
//     same sample, or they could disagree on which of the 6 candidates wins
//     for the same file) shrinks that allocation too, not just the math —
//     both together measured ~40ms warm (~64ms on a cold/first call, still
//     JIT-warming up) on the same file — a real ~14x improvement over
//     optimization 1 alone, not just the ~23x its triangle-count reduction
//     alone would suggest (fewer, but not proportionally cheaper, function
//     calls). Overhang/height/contact-area are statistical properties of
//     the mesh, not exact ones, so a representative sample is enough — a
//     real hole doesn't hide from a 50,000-triangle sample.
const MAX_SAMPLE_TRIANGLES = 50000;

export function suggestOrientation(triangles) {
  if (triangles.length === 0) return null;

  const stride = triangles.length > MAX_SAMPLE_TRIANGLES ? Math.ceil(triangles.length / MAX_SAMPLE_TRIANGLES) : 1;
  const sample = stride === 1 ? triangles : triangles.filter((_, i) => i % stride === 0);

  const precomputed = sample.map((t) => {
    const [a, b, c] = t.v;
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    return { a, b, c, nx: nx / len, ny: ny / len, nz: nz / len, area: len / 2 };
  });

  const candidates = CANDIDATES.map(({ rotateXDeg, rotateYDeg }, idx) => {
    const zOf = CANDIDATE_Z_PICKS[idx];
    let minZ = Infinity, maxZ = -Infinity;
    for (const { a, b, c } of precomputed) {
      const za = zOf(a[0], a[1], a[2]), zb = zOf(b[0], b[1], b[2]), zc = zOf(c[0], c[1], c[2]);
      if (za < minZ) minZ = za;
      if (za > maxZ) maxZ = za;
      if (zb < minZ) minZ = zb;
      if (zb > maxZ) maxZ = zb;
      if (zc < minZ) minZ = zc;
      if (zc > maxZ) maxZ = zc;
    }

    let overhangVolumeMm3 = 0;
    let contactAreaMm2 = 0;
    for (const { a, b, c, nx, ny, nz, area } of precomputed) {
      const za = zOf(a[0], a[1], a[2]), zb = zOf(b[0], b[1], b[2]), zc = zOf(c[0], c[1], c[2]);
      const normalZ = zOf(nx, ny, nz);
      const isBedContact =
        za - minZ < BED_CONTACT_EPSILON_MM && zb - minZ < BED_CONTACT_EPSILON_MM && zc - minZ < BED_CONTACT_EPSILON_MM;
      if (isBedContact) {
        contactAreaMm2 += area;
      } else if (normalZ < OVERHANG_NORMAL_Z) {
        const heightAboveBedMm = (za + zb + zc) / 3 - minZ;
        overhangVolumeMm3 += area * (heightAboveBedMm + BASE_GAP_MM);
      }
    }

    const heightMm = maxZ - minZ;
    const score = -W_OVERHANG * overhangVolumeMm3 - W_HEIGHT * heightMm + W_CONTACT * contactAreaMm2;
    return { rotateXDeg, rotateYDeg, heightMm, overhangVolumeMm3, contactAreaMm2, score };
  });

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return { rotateXDeg: best.rotateXDeg, rotateYDeg: best.rotateYDeg, score: best.score, alternatives: candidates };
}

// Bakes a rotation directly into a triangle list — mirrors
// orientation.ts's applyTransform (rotation only, no scale: the client
// slice doesn't need to re-derive the user's Unité/Échelle scale factor,
// Kiri:Moto's own weight/time output already reflects the file as-uploaded
// at 1:1, and scale is applied server-side for the final stored file).
export function applyRotation(triangles, rotateXDeg, rotateYDeg) {
  if (!rotateXDeg && !rotateYDeg) return triangles;
  return triangles.map((t) => ({ v: t.v.map((p) => rotatePoint(p, rotateXDeg, rotateYDeg)) }));
}
