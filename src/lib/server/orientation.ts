// Suggests a print orientation (rotation around X/Y only — Z rotation
// doesn't change a part's overhangs/height/bed contact, so it's never
// worth testing) by scoring the 6 axis-aligned candidate orientations of
// the model's own bounding box. Loosely inspired by the general approach
// described by the open-source PrusaMCP project's suggest_orientation tool
// (github.com/Noosbai/PrusaMCP — testing a handful of orientations and
// scoring by overhang/contact/height) — this is our own implementation
// against our own STL parsing, not a dependency on that project or its code.
//
// Deliberately NOT exhaustive (no fine-grained rotation search): this runs
// synchronously in the middle of an instant-quote request the customer is
// waiting on (see routes/quotes.ts), so it has to stay fast — testing 6
// orientations against a parsed triangle list is cheap (no subprocess
// calls, pure JS math), unlike calling PrusaSlicer 6 times.
//
// Positions: a flat Float32Array, 9 numbers per triangle (v0.xyz, v1.xyz,
// v2.xyz), no per-triangle objects/nested arrays. Replaces an earlier
// `Triangle[]` shape (`{normal: [x,y,z], v: [[x,y,z],[x,y,z],[x,y,z]]}`) —
// real, reproduced OOM crash (docker events: genuine `container oom` ->
// `die (exitCode=137)` on the real prod container): that nested-object
// representation cost roughly 400+ bytes/triangle in V8 (object + 4 nested
// arrays' own overhead, on top of the 9 actual numbers), enough that a
// ~1.1M-triangle STL alone could exhaust the container during parsing,
// well before any transform/analysis/slicing ever ran. A flat typed array
// costs exactly 36 bytes/triangle (9 × 4-byte float32) with zero per-
// triangle allocation — roughly a 10x reduction, which is the real fix;
// src/pages/api/quotes/index.ts's MAX_QUOTE_TRIANGLES guard is what's left
// of the old, much more conservative threshold this made unnecessary at
// its old value (kept, lowered, as a last-resort ceiling — see that
// constant's own comment). Normals are never stored: nothing downstream
// actually needs the file's own normal data — serializeBinaryStl always
// re-derives them from winding order (occt-import-js/STEP and hand-rotated
// triangles don't reliably carry a trustworthy one anyway), and
// suggestOrientation computes its own per-candidate normal component from
// the vertices directly.
export type Positions = Float32Array;

// Binary STL: 80-byte header + uint32 triangle count, then 50 bytes/tri
// (12 bytes normal + 36 bytes vertices + 2-byte attribute, all little
// endian). ASCII STL: text "facet normal / outer loop / vertex ×3 /
// endloop / endfacet" blocks. Detected by checking whether the binary
// header's triangle count actually accounts for the rest of the file's
// length — more reliable than sniffing for a leading "solid" string, since
// some binary STL exporters put "solid ..." in the 80-byte header too.
//
// This is a last-resort ceiling now, not the primary defense — see this
// file's own header comment on Positions for why the real fix was the flat-
// array rewrite, not this number. Matches src/pages/api/quotes/index.ts's
// own MAX_QUOTE_TRIANGLES (see that constant's comment for the full
// history/reasoning) so binary STL's cheap pre-parse rejection and every
// other format's necessarily-later post-parse rejection agree on the same
// ceiling — kept in sync rather than imported so each guard stays
// obviously self-contained at its own call site.
const MAX_STL_TRIANGLES = 1_500_000;

export function parseStlTriangles(buffer: Buffer): Positions {
  if (buffer.length >= 84) {
    const count = buffer.readUInt32LE(80);
    if (84 + count * 50 === buffer.length) {
      if (count > MAX_STL_TRIANGLES) {
        throw new Error(`part_too_complex: binary STL has ${count} triangles, exceeds ${MAX_STL_TRIANGLES}`);
      }
      return parseBinaryStl(buffer, count);
    }
  }
  return parseAsciiStl(buffer.toString("utf8"));
}

function parseBinaryStl(buffer: Buffer, count: number): Positions {
  const positions = new Float32Array(count * 9);
  let offset = 84;
  let p = 0;
  for (let i = 0; i < count; i++) {
    // Skip the stored normal (12 bytes) — never trusted, see this file's
    // header comment.
    positions[p++] = buffer.readFloatLE(offset + 12);
    positions[p++] = buffer.readFloatLE(offset + 16);
    positions[p++] = buffer.readFloatLE(offset + 20);
    positions[p++] = buffer.readFloatLE(offset + 24);
    positions[p++] = buffer.readFloatLE(offset + 28);
    positions[p++] = buffer.readFloatLE(offset + 32);
    positions[p++] = buffer.readFloatLE(offset + 36);
    positions[p++] = buffer.readFloatLE(offset + 40);
    positions[p++] = buffer.readFloatLE(offset + 44);
    offset += 50;
  }
  return positions;
}

// ASCII STL is already rare among real uploads (verbose text, most CAD/
// slicer tools default to binary) and self-limits its own triangle count
// via file size long before MAX_STL_TRIANGLES matters — a growable plain
// array here, flattened once at the end, is simple and fine.
function parseAsciiStl(text: string): Positions {
  const flat: number[] = [];
  const vertexRe = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  const facetRe = /facet normal\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)([\s\S]*?)endfacet/g;
  let m: RegExpExecArray | null;
  while ((m = facetRe.exec(text))) {
    const verts: number[] = [];
    let vm: RegExpExecArray | null;
    vertexRe.lastIndex = 0;
    while ((vm = vertexRe.exec(m[4]))) verts.push(parseFloat(vm[1]), parseFloat(vm[2]), parseFloat(vm[3]));
    if (verts.length === 9) for (const n of verts) flat.push(n);
  }
  return Float32Array.from(flat);
}

function triangleArea(positions: Positions, i: number): number {
  const o = i * 9;
  const ax = positions[o], ay = positions[o + 1], az = positions[o + 2];
  const bx = positions[o + 3], by = positions[o + 4], bz = positions[o + 5];
  const cx = positions[o + 6], cy = positions[o + 7], cz = positions[o + 8];
  const ux = bx - ax, uy = by - ay, uz = bz - az;
  const vx = cx - ax, vy = cy - ay, vz = cz - az;
  const nx = uy * vz - uz * vy,
    ny = uz * vx - ux * vz,
    nz = ux * vy - uy * vx;
  return Math.sqrt(nx * nx + ny * ny + nz * nz) / 2;
}

// Real mesh volume, independent of any slicing engine — the signed sum of
// tetrahedron volumes from the origin to each triangle (standard divergence-
// theorem trick: for a closed, consistently-wound manifold mesh, this sum
// is exactly the enclosed volume regardless of where the "origin" actually
// is, since the contributions from triangles facing toward vs. away from it
// cancel out everywhere except the real enclosed volume). Used to cheaply
// sanity-check a client-reported weight (see quotes/index.ts) without
// re-slicing: this runs in a few ms even on a 200k-triangle mesh, no
// subprocess, no WASM engine — just the same triangle list already parsed
// for suggestOrientation() above.
export function computeMeshVolumeMm3(positions: Positions): number {
  let volume6 = 0;
  const n = positions.length / 9;
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    const ax = positions[o], ay = positions[o + 1], az = positions[o + 2];
    const bx = positions[o + 3], by = positions[o + 4], bz = positions[o + 5];
    const cx = positions[o + 6], cy = positions[o + 7], cz = positions[o + 8];
    volume6 += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  return Math.abs(volume6) / 6;
}

// "v x y z" + "f i j k [l...]" — the subset of Wavefront OBJ this project's
// uploads actually use (no normals/UVs/materials needed for geometry-only
// checks). Faces are 1-indexed and may be negative (relative to the current
// vertex count) per spec; n-gons beyond a triangle are fan-triangulated.
export function parseObjTriangles(text: string): Positions {
  const vertices: number[] = []; // flat x,y,z triples
  const flat: number[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("v ")) {
      const parts = trimmed.slice(2).trim().split(/\s+/).map(Number);
      if (parts.length >= 3) vertices.push(parts[0], parts[1], parts[2]);
    } else if (trimmed.startsWith("f ")) {
      const vertexCount = vertices.length / 3;
      const idx = trimmed
        .slice(2)
        .trim()
        .split(/\s+/)
        .map((tok) => {
          const i = parseInt(tok.split("/")[0], 10);
          return i < 0 ? vertexCount + i : i - 1;
        });
      for (let i = 1; i + 1 < idx.length; i++) {
        const ai = idx[0] * 3,
          bi = idx[i] * 3,
          ci = idx[i + 1] * 3;
        if (vertices[ai] === undefined || vertices[bi] === undefined || vertices[ci] === undefined) continue;
        flat.push(
          vertices[ai], vertices[ai + 1], vertices[ai + 2],
          vertices[bi], vertices[bi + 1], vertices[bi + 2],
          vertices[ci], vertices[ci + 1], vertices[ci + 2],
        );
      }
    }
  }
  return Float32Array.from(flat);
}

export interface BoundingBox {
  sizeXMm: number;
  sizeYMm: number;
  sizeZMm: number;
}

export function computeBoundingBox(positions: Positions): BoundingBox {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return { sizeXMm: maxX - minX, sizeYMm: maxY - minY, sizeZMm: maxZ - minZ };
}

// Quantized coordinate key — merges vertices that coincide up to 1e-4mm, the
// same tolerance floating-point STL/OBJ export round-tripping typically
// introduces between two triangles that share a "real" edge.
function vertexKey(x: number, y: number, z: number): string {
  return `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
}

export interface ManifoldCheck {
  manifold: boolean;
  parts: number;
}

// Below this area (mm²), a triangle is numerical noise, not real geometry —
// same idea as PrusaSlicer's own "degenerate_facets" removal, confirmed by
// comparing against a real PrusaSlicer --info run on the same file (a real
// 3DBenchy STL): it reports "manifold = yes" but also "degenerate_facets =
// 552, facets_removed = 552" — it silently strips near-zero-area facets
// *before* judging manifold-ness, not after. Skipping this step was
// confirmed live to cause a false "non_manifold_model" rejection on that
// exact, genuinely printable file (576 zero-area slivers, mostly around the
// chimney/rings, turned into ~500 over-counted edges).
const DEGENERATE_AREA_MM2 = 1e-6;

// Real-world STL/OBJ exports (even from PrusaSlicer's own accepted files)
// virtually always carry a handful of boundary edges from floating-point
// precision or minor CAD-tessellation seams — confirmed live on the same
// reference Benchy file: 60 boundary edges out of 337,725 (0.018%) after
// degenerate-facet removal, on a file PrusaSlicer itself calls manifold. A
// strict "zero bad edges" rule would reject files real slicers accept fine;
// this tolerates that same kind of noise while still catching genuinely
// broken meshes (a real hole/missing wall pushes this fraction far higher,
// easily into the tens of percent).
const MAX_BAD_EDGE_FRACTION = 0.01;

// Replaces PrusaSlicer's `--info` manifold/number_of_parts fields: a closed
// 2-manifold mesh has every edge shared by exactly 2 triangles (one on each
// side). "parts" = connected components over the shared-edge adjacency
// graph, via union-find.
//
// Only an ODD edge count counts as bad, not just "count !== 2" — a real
// customer file (a bowl, exported with its shell duplicated, a common CAD
// export artifact — e.g. a revolved surface written out twice) had 21.6% of
// its edges at count 4 or 8, tripping the old "!= 2" rule outright despite
// being genuinely fine to print (confirmed on that same file: no actual
// gaps; real slicers treat duplicate overlapping surfaces as reinforcing
// the same wall, not a defect). Verified with a direct test before this
// change: a closed cube's edges are all count=2; removing one triangle (a
// real hole) leaves that hole's boundary at count=1 — ODD; duplicating a
// whole closed sub-shell leaves its edges at count=4, 6, 8... — always
// EVEN, never a genuine gap. A single missing triangle always drops its 3
// edges from 2 to 1 (odd) — a real opening can never leave a clean even
// count behind, so this distinction doesn't trade away real-hole detection.
export function checkManifoldAndParts(positions: Positions): ManifoldCheck {
  const n = positions.length / 9;

  const vertexId = new Map<string, number>();
  const parent: number[] = [];
  function idOf(x: number, y: number, z: number): number {
    const key = vertexKey(x, y, z);
    let id = vertexId.get(key);
    if (id === undefined) {
      id = parent.length;
      vertexId.set(key, id);
      parent.push(id);
    }
    return id;
  }
  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  }
  function union(a: number, b: number) {
    const ra = find(a),
      rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  const edgeCount = new Map<string, number>();
  let cleanCount = 0;
  const ids = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    if (triangleArea(positions, i) <= DEGENERATE_AREA_MM2) continue;
    cleanCount++;
    const o = i * 9;
    ids[0] = idOf(positions[o], positions[o + 1], positions[o + 2]);
    ids[1] = idOf(positions[o + 3], positions[o + 4], positions[o + 5]);
    ids[2] = idOf(positions[o + 6], positions[o + 7], positions[o + 8]);
    for (let k = 0; k < 3; k++) {
      const a = ids[k],
        b = ids[(k + 1) % 3];
      union(a, b);
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  }
  if (cleanCount === 0) return { manifold: false, parts: 0 };

  let badEdges = 0;
  for (const count of edgeCount.values()) {
    if (count % 2 !== 0) badEdges++;
  }
  const manifold = badEdges / edgeCount.size <= MAX_BAD_EDGE_FRACTION;

  const roots = new Set<number>();
  for (let i = 0; i < parent.length; i++) roots.add(find(i));

  return { manifold, parts: roots.size };
}

export interface MeshTransform {
  scale?: number;
  rotateXDeg?: number;
  rotateYDeg?: number;
}

// Replaces PrusaSlicer's --rotate-x/--rotate-y/--scale flags — bakes the
// same transform directly into the position array, in the same order
// (rotate then scale; order doesn't affect the result since scale is
// uniform and rotations are axis-aligned multiples of 90°, see rotatePoint
// above). Used both for the pre-slice bounding-box/volume check (so it
// matches what the customer will actually receive) and for producing the
// final stored STL with the transform baked in. Always returns a fresh
// array (even for the identity transform) so callers can rely on getting
// their own copy — cheap relative to the parse itself, and avoids aliasing
// bugs between "the uploaded mesh" and "the transformed mesh" sharing a
// buffer.
export function applyTransform(positions: Positions, t: MeshTransform): Positions {
  const rx = t.rotateXDeg ?? 0,
    ry = t.rotateYDeg ?? 0,
    s = t.scale ?? 1;
  const out = new Float32Array(positions.length);
  if (rx === 0 && ry === 0 && s === 1) {
    out.set(positions);
    return out;
  }
  const xr = (rx * Math.PI) / 180,
    yr = (ry * Math.PI) / 180;
  const cosX = Math.cos(xr), sinX = Math.sin(xr), cosY = Math.cos(yr), sinY = Math.sin(yr);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i], y = positions[i + 1], z = positions[i + 2];
    const y2 = y * cosX - z * sinX;
    const z2 = y * sinX + z * cosX;
    const x3 = x * cosY + z2 * sinY;
    const z3 = -x * sinY + z2 * cosY;
    out[i] = x3 * s;
    out[i + 1] = y2 * s;
    out[i + 2] = z3 * s;
  }
  return out;
}

// Binary STL: 80-byte header + uint32 count, then 50 bytes/triangle (12
// normal + 36 vertex + 2 attribute byte count, all little-endian) — the
// mirror of parseBinaryStl above. Normals are re-derived from the triangle's
// own winding rather than trusted from the input, since occt-import-js
// (STEP) and hand-rotated triangles don't reliably carry one.
export function serializeBinaryStl(positions: Positions): Buffer {
  const n = positions.length / 9;
  const buffer = Buffer.alloc(84 + n * 50);
  buffer.writeUInt32LE(n, 80);
  let offset = 84;
  for (let i = 0; i < n; i++) {
    const o = i * 9;
    const ax = positions[o], ay = positions[o + 1], az = positions[o + 2];
    const bx = positions[o + 3], by = positions[o + 4], bz = positions[o + 5];
    const cx = positions[o + 6], cy = positions[o + 7], cz = positions[o + 8];
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    buffer.writeFloatLE(nx / len, offset);
    buffer.writeFloatLE(ny / len, offset + 4);
    buffer.writeFloatLE(nz / len, offset + 8);
    buffer.writeFloatLE(ax, offset + 12);
    buffer.writeFloatLE(ay, offset + 16);
    buffer.writeFloatLE(az, offset + 20);
    buffer.writeFloatLE(bx, offset + 24);
    buffer.writeFloatLE(by, offset + 28);
    buffer.writeFloatLE(bz, offset + 32);
    buffer.writeFloatLE(cx, offset + 36);
    buffer.writeFloatLE(cy, offset + 40);
    buffer.writeFloatLE(cz, offset + 44);
    buffer.writeUInt16LE(0, offset + 48);
    offset += 50;
  }
  return buffer;
}

// Only the 6 axis-aligned "rest on a face" orientations — every
// PrusaSlicer --rotate-x/--rotate-y pair needed to reach them.
const CANDIDATES: { rotateXDeg: number; rotateYDeg: number }[] = [
  { rotateXDeg: 0, rotateYDeg: 0 },
  { rotateXDeg: 180, rotateYDeg: 0 },
  { rotateXDeg: 90, rotateYDeg: 0 },
  { rotateXDeg: -90, rotateYDeg: 0 },
  { rotateXDeg: 0, rotateYDeg: 90 },
  { rotateXDeg: 0, rotateYDeg: -90 },
];

export function rotatePoint(p: [number, number, number], xDeg: number, yDeg: number): [number, number, number] {
  const xr = (xDeg * Math.PI) / 180,
    yr = (yDeg * Math.PI) / 180;
  let [x, y, z] = p;
  // Rotate around X, then around Y — matches PrusaSlicer applying
  // --rotate-x before --rotate-y (see transformArgs in lib/slicer.ts).
  const y2 = y * Math.cos(xr) - z * Math.sin(xr);
  let z2 = y * Math.sin(xr) + z * Math.cos(xr);
  y = y2;
  z = z2;
  const x2 = x * Math.cos(yr) + z * Math.sin(yr);
  z2 = -x * Math.sin(yr) + z * Math.cos(yr);
  x = x2;
  z = z2;
  return [x, y, z];
}

// 50°, not 45° — matches the real engine's own overhang test exactly
// (confirmed by reading vendor/grid-apps/src/kiri-mode/fdm/slice.js's
// FDM.supports live: `thresh = -Math.sin(process.sliceSupportAngle * PI/180)`,
// and this project's own sliceSupportAngle is 50, see kiriProfiles.ts).
const OVERHANG_NORMAL_Z = -Math.sin((50 * Math.PI) / 180);
// Anything within this many mm of the lowest point counts as "resting on
// the bed" for the contact-area score.
const BED_CONTACT_EPSILON_MM = 0.05;

export interface OrientationCandidate {
  rotateXDeg: number;
  rotateYDeg: number;
  heightMm: number;
  overhangVolumeMm3: number;
  contactAreaMm2: number;
  score: number;
}

export interface OrientationSuggestion {
  rotateXDeg: number;
  rotateYDeg: number;
  score: number;
  alternatives: OrientationCandidate[];
}

// Weights: overhang dominates (the single biggest driver of support
// material, print failure risk and post-processing work), height is a
// mild tie-breaker (print time/wobble), contact area rewards stability —
// adjust here if real-world results don't match expectations, see
// server/SHIPPING.md-style docs note below.
//
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
// same order as CANDIDATES above. A normal vector rotates by exactly the
// same transform as any other vector under a pure rotation (no scale/shear
// involved), so the same picks apply to (nx,ny,nz) too — one function
// serves both roles below.
const CANDIDATE_Z_PICKS: Array<(x: number, y: number, z: number) => number> = [
  (x, y, z) => z,
  (x, y, z) => -z,
  (x, y, z) => y,
  (x, y, z) => -y,
  (x, y, z) => -x,
  (x, y, z) => x,
];

// Two stacked optimizations, both confirmed live client-side on the same
// real 1.15M-triangle file (baseline: a naive "rotate every point,
// re-derive area+normal via cross product from scratch, redo all of that
// for each of the 6 candidates" implementation took 4.2s, the dominant cost
// of the whole upload step by a huge margin — everything else, parse+
// normals+etc combined, was ~300ms):
//  1. Area and normal direction are properties of the ORIGINAL geometry — a
//     rigid rotation doesn't change a triangle's area at all, and (per
//     CANDIDATE_Z_PICKS above) its rotated normal-Z is just a component
//     pick, not a new cross product — so both are computed exactly ONCE per
//     triangle below, not re-derived per candidate.
//  2. Deterministic subsampling on top (MAX_SAMPLE_TRIANGLES, evenly
//     strided — not Math.random(): client and server must land on the exact
//     same sample, or they could disagree on which of the 6 candidates wins
//     for the same file, see orientationSuggest.js's identical port) shrinks
//     that allocation too, not just the math. Overhang/height/contact-area
//     are statistical properties of the mesh, not exact ones, so a
//     representative sample is enough — a real hole doesn't hide from a
//     50,000-triangle sample.
// Precomputed values are now stored in flat parallel Float32Arrays (one
// slot per sampled triangle), not an array of small objects — the same
// per-triangle-object cost this whole file's rewrite was about avoiding
// applies just as much to a temporary "precomputed" array as to the
// primary mesh representation.
const MAX_SAMPLE_TRIANGLES = 50000;

export function suggestOrientation(positions: Positions): OrientationSuggestion | null {
  const total = positions.length / 9;
  if (total === 0) return null;

  const stride = total > MAX_SAMPLE_TRIANGLES ? Math.ceil(total / MAX_SAMPLE_TRIANGLES) : 1;
  const sampleCount = Math.ceil(total / stride);

  const ax = new Float32Array(sampleCount), ay = new Float32Array(sampleCount), az = new Float32Array(sampleCount);
  const bx = new Float32Array(sampleCount), by = new Float32Array(sampleCount), bz = new Float32Array(sampleCount);
  const cx = new Float32Array(sampleCount), cy = new Float32Array(sampleCount), cz = new Float32Array(sampleCount);
  const nx = new Float32Array(sampleCount), ny = new Float32Array(sampleCount), nz = new Float32Array(sampleCount);
  const area = new Float32Array(sampleCount);

  let s = 0;
  for (let i = 0; i < total; i += stride, s++) {
    const o = i * 9;
    const ax_ = positions[o], ay_ = positions[o + 1], az_ = positions[o + 2];
    const bx_ = positions[o + 3], by_ = positions[o + 4], bz_ = positions[o + 5];
    const cx_ = positions[o + 6], cy_ = positions[o + 7], cz_ = positions[o + 8];
    const ux = bx_ - ax_, uy = by_ - ay_, uz = bz_ - az_;
    const vx = cx_ - ax_, vy = cy_ - ay_, vz = cz_ - az_;
    const nx_ = uy * vz - uz * vy,
      ny_ = uz * vx - ux * vz,
      nz_ = ux * vy - uy * vx;
    const len = Math.sqrt(nx_ * nx_ + ny_ * ny_ + nz_ * nz_) || 1;
    ax[s] = ax_; ay[s] = ay_; az[s] = az_;
    bx[s] = bx_; by[s] = by_; bz[s] = bz_;
    cx[s] = cx_; cy[s] = cy_; cz[s] = cz_;
    nx[s] = nx_ / len; ny[s] = ny_ / len; nz[s] = nz_ / len;
    area[s] = len / 2;
  }

  const candidates: OrientationCandidate[] = CANDIDATES.map(({ rotateXDeg, rotateYDeg }, idx) => {
    const zOf = CANDIDATE_Z_PICKS[idx];
    let minZ = Infinity,
      maxZ = -Infinity;
    for (let i = 0; i < sampleCount; i++) {
      const za = zOf(ax[i], ay[i], az[i]),
        zb = zOf(bx[i], by[i], bz[i]),
        zc = zOf(cx[i], cy[i], cz[i]);
      if (za < minZ) minZ = za;
      if (za > maxZ) maxZ = za;
      if (zb < minZ) minZ = zb;
      if (zb > maxZ) maxZ = zb;
      if (zc < minZ) minZ = zc;
      if (zc > maxZ) maxZ = zc;
    }

    let overhangVolumeMm3 = 0;
    let contactAreaMm2 = 0;
    for (let i = 0; i < sampleCount; i++) {
      const za = zOf(ax[i], ay[i], az[i]),
        zb = zOf(bx[i], by[i], bz[i]),
        zc = zOf(cx[i], cy[i], cz[i]);
      const normalZ = zOf(nx[i], ny[i], nz[i]);
      // A triangle resting on the bed is ALWAYS downward-facing by
      // definition (normalZ close to -1), so it always also satisfied the
      // overhang test below — these two checks must be mutually exclusive,
      // not independent, or every candidate's own bed-contact face gets
      // double-counted as "overhang" too. That bug perversely penalized
      // exactly the orientations with a large, genuinely good flat resting
      // face (a bigger bottom face meant a bigger bogus overhang penalty)
      // and favored small, awkward footprints instead — confirmed live: a
      // 30x40x8mm test box, which should obviously rest on its 30x40 face,
      // was instead being flipped onto its 30x8 edge (height 40mm) by the
      // old scoring. A real overhang is only a downward face that ISN'T
      // resting on the bed (a bridge/ledge mid-air needing support).
      const isBedContact = za - minZ < BED_CONTACT_EPSILON_MM && zb - minZ < BED_CONTACT_EPSILON_MM && zc - minZ < BED_CONTACT_EPSILON_MM;
      if (isBedContact) {
        contactAreaMm2 += area[i];
      } else if (normalZ < OVERHANG_NORMAL_Z) {
        // See the W_OVERHANG comment above — weighted by height above the
        // bed, not just area, as a cheap proxy for the real pillar-material
        // cost a support structure would actually need here.
        const heightAboveBedMm = (za + zb + zc) / 3 - minZ;
        overhangVolumeMm3 += area[i] * (heightAboveBedMm + BASE_GAP_MM);
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
