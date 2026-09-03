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
export interface Triangle {
  normal: [number, number, number];
  v: [[number, number, number], [number, number, number], [number, number, number]];
}

// Binary STL: 80-byte header + uint32 triangle count, then 50 bytes/tri
// (12 bytes normal + 36 bytes vertices + 2-byte attribute, all little
// endian). ASCII STL: text "facet normal / outer loop / vertex ×3 /
// endloop / endfacet" blocks. Detected by checking whether the binary
// header's triangle count actually accounts for the rest of the file's
// length — more reliable than sniffing for a leading "solid" string, since
// some binary STL exporters put "solid ..." in the 80-byte header too.
export function parseStlTriangles(buffer: Buffer): Triangle[] {
  if (buffer.length >= 84) {
    const count = buffer.readUInt32LE(80);
    if (84 + count * 50 === buffer.length) return parseBinaryStl(buffer, count);
  }
  return parseAsciiStl(buffer.toString("utf8"));
}

function parseBinaryStl(buffer: Buffer, count: number): Triangle[] {
  const triangles: Triangle[] = [];
  let offset = 84;
  for (let i = 0; i < count; i++) {
    const normal: [number, number, number] = [
      buffer.readFloatLE(offset),
      buffer.readFloatLE(offset + 4),
      buffer.readFloatLE(offset + 8),
    ];
    const v: Triangle["v"] = [
      [buffer.readFloatLE(offset + 12), buffer.readFloatLE(offset + 16), buffer.readFloatLE(offset + 20)],
      [buffer.readFloatLE(offset + 24), buffer.readFloatLE(offset + 28), buffer.readFloatLE(offset + 32)],
      [buffer.readFloatLE(offset + 36), buffer.readFloatLE(offset + 40), buffer.readFloatLE(offset + 44)],
    ];
    triangles.push({ normal, v });
    offset += 50;
  }
  return triangles;
}

function parseAsciiStl(text: string): Triangle[] {
  const triangles: Triangle[] = [];
  const vertexRe = /vertex\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)/g;
  const facetRe = /facet normal\s+([-\d.eE+]+)\s+([-\d.eE+]+)\s+([-\d.eE+]+)([\s\S]*?)endfacet/g;
  let m: RegExpExecArray | null;
  while ((m = facetRe.exec(text))) {
    const normal: [number, number, number] = [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])];
    const verts: [number, number, number][] = [];
    let vm: RegExpExecArray | null;
    vertexRe.lastIndex = 0;
    while ((vm = vertexRe.exec(m[4]))) verts.push([parseFloat(vm[1]), parseFloat(vm[2]), parseFloat(vm[3])]);
    if (verts.length === 3) triangles.push({ normal, v: [verts[0], verts[1], verts[2]] });
  }
  return triangles;
}

function triangleArea(v: Triangle["v"]): number {
  const [a, b, c] = v;
  const ux = b[0] - a[0],
    uy = b[1] - a[1],
    uz = b[2] - a[2];
  const vx = c[0] - a[0],
    vy = c[1] - a[1],
    vz = c[2] - a[2];
  const cx = uy * vz - uz * vy,
    cy = uz * vx - ux * vz,
    cz = ux * vy - uy * vx;
  return Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
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
export function computeMeshVolumeMm3(triangles: Triangle[]): number {
  let volume6 = 0;
  for (const t of triangles) {
    const [a, b, c] = t.v;
    volume6 += a[0] * (b[1] * c[2] - b[2] * c[1]) - a[1] * (b[0] * c[2] - b[2] * c[0]) + a[2] * (b[0] * c[1] - b[1] * c[0]);
  }
  return Math.abs(volume6) / 6;
}

// "v x y z" + "f i j k [l...]" — the subset of Wavefront OBJ this project's
// uploads actually use (no normals/UVs/materials needed for geometry-only
// checks). Faces are 1-indexed and may be negative (relative to the current
// vertex count) per spec; n-gons beyond a triangle are fan-triangulated.
export function parseObjTriangles(text: string): Triangle[] {
  const vertices: [number, number, number][] = [];
  const triangles: Triangle[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("v ")) {
      const parts = trimmed.slice(2).trim().split(/\s+/).map(Number);
      if (parts.length >= 3) vertices.push([parts[0], parts[1], parts[2]]);
    } else if (trimmed.startsWith("f ")) {
      const idx = trimmed
        .slice(2)
        .trim()
        .split(/\s+/)
        .map((tok) => {
          const i = parseInt(tok.split("/")[0], 10);
          return i < 0 ? vertices.length + i : i - 1;
        });
      for (let i = 1; i + 1 < idx.length; i++) {
        const a = vertices[idx[0]],
          b = vertices[idx[i]],
          c = vertices[idx[i + 1]];
        if (!a || !b || !c) continue;
        triangles.push({ normal: [0, 0, 0], v: [a, b, c] });
      }
    }
  }
  return triangles;
}

export interface BoundingBox {
  sizeXMm: number;
  sizeYMm: number;
  sizeZMm: number;
}

export function computeBoundingBox(triangles: Triangle[]): BoundingBox {
  let minX = Infinity,
    minY = Infinity,
    minZ = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    maxZ = -Infinity;
  for (const t of triangles) {
    for (const p of t.v) {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
      if (p[2] < minZ) minZ = p[2];
      if (p[2] > maxZ) maxZ = p[2];
    }
  }
  return { sizeXMm: maxX - minX, sizeYMm: maxY - minY, sizeZMm: maxZ - minZ };
}

// Quantized coordinate key — merges vertices that coincide up to 1e-4mm, the
// same tolerance floating-point STL/OBJ export round-tripping typically
// introduces between two triangles that share a "real" edge.
function vertexKey(p: readonly [number, number, number]): string {
  return `${Math.round(p[0] * 1e4)},${Math.round(p[1] * 1e4)},${Math.round(p[2] * 1e4)}`;
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
// virtually always carry a handful of boundary/non-manifold edges from
// floating-point precision or minor CAD-tessellation seams — confirmed live
// on the same reference Benchy file: 60 boundary edges out of 337,725
// (0.018%) after degenerate-facet removal, on a file PrusaSlicer itself
// calls manifold. A strict "zero bad edges" rule would reject files real
// slicers accept fine; this tolerates that same kind of noise while still
// catching genuinely broken meshes (a real hole/missing wall pushes this
// fraction far higher, easily into the tens of percent).
const MAX_BAD_EDGE_FRACTION = 0.01;

// Replaces PrusaSlicer's `--info` manifold/number_of_parts fields: a closed
// 2-manifold mesh has every edge shared by exactly 2 triangles (one on each
// side) — a boundary edge (count 1, a hole) or a non-manifold edge (count
// >2) both fail printability, judged as a tolerance (see
// MAX_BAD_EDGE_FRACTION) rather than an absolute rule. "parts" = connected
// components over the shared-edge adjacency graph, via union-find.
export function checkManifoldAndParts(triangles: Triangle[]): ManifoldCheck {
  const clean = triangles.filter((t) => triangleArea(t.v) > DEGENERATE_AREA_MM2);
  if (clean.length === 0) return { manifold: false, parts: 0 };

  const vertexId = new Map<string, number>();
  const parent: number[] = [];
  function idOf(p: readonly [number, number, number]): number {
    const key = vertexKey(p);
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
  for (const t of clean) {
    const ids = t.v.map(idOf);
    for (let i = 0; i < 3; i++) {
      const a = ids[i],
        b = ids[(i + 1) % 3];
      union(a, b);
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      edgeCount.set(key, (edgeCount.get(key) ?? 0) + 1);
    }
  }

  let badEdges = 0;
  for (const count of edgeCount.values()) {
    if (count !== 2) badEdges++;
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
// same transform directly into the triangle list, in the same order
// (rotate then scale; order doesn't affect the result since scale is
// uniform and rotations are axis-aligned multiples of 90°, see rotatePoint
// above). Used both for the pre-slice bounding-box/volume check (so it
// matches what the customer will actually receive) and for producing the
// final stored STL with the transform baked in.
export function applyTransform(triangles: Triangle[], t: MeshTransform): Triangle[] {
  const rx = t.rotateXDeg ?? 0,
    ry = t.rotateYDeg ?? 0,
    s = t.scale ?? 1;
  if (rx === 0 && ry === 0 && s === 1) return triangles;
  return triangles.map((tri) => ({
    normal: tri.normal,
    v: tri.v.map((p) => {
      const [x, y, z] = rotatePoint(p, rx, ry);
      return [x * s, y * s, z * s] as [number, number, number];
    }) as Triangle["v"],
  }));
}

// Binary STL: 80-byte header + uint32 count, then 50 bytes/triangle (12
// normal + 36 vertex + 2 attribute byte count, all little-endian) — the
// mirror of parseBinaryStl above. Normals are re-derived from the triangle's
// own winding rather than trusted from the input, since occt-import-js
// (STEP) and hand-rotated triangles don't reliably carry one.
export function serializeBinaryStl(triangles: Triangle[]): Buffer {
  const buffer = Buffer.alloc(84 + triangles.length * 50);
  buffer.writeUInt32LE(triangles.length, 80);
  let offset = 84;
  for (const t of triangles) {
    const [a, b, c] = t.v;
    const ux = b[0] - a[0],
      uy = b[1] - a[1],
      uz = b[2] - a[2];
    const vx = c[0] - a[0],
      vy = c[1] - a[1],
      vz = c[2] - a[2];
    const nx = uy * vz - uz * vy,
      ny = uz * vx - ux * vz,
      nz = ux * vy - uy * vx;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    buffer.writeFloatLE(nx / len, offset);
    buffer.writeFloatLE(ny / len, offset + 4);
    buffer.writeFloatLE(nz / len, offset + 8);
    buffer.writeFloatLE(a[0], offset + 12);
    buffer.writeFloatLE(a[1], offset + 16);
    buffer.writeFloatLE(a[2], offset + 20);
    buffer.writeFloatLE(b[0], offset + 24);
    buffer.writeFloatLE(b[1], offset + 28);
    buffer.writeFloatLE(b[2], offset + 32);
    buffer.writeFloatLE(c[0], offset + 36);
    buffer.writeFloatLE(c[1], offset + 40);
    buffer.writeFloatLE(c[2], offset + 44);
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

// Downward-facing beyond ~45° from horizontal is the same rule of thumb
// slicers use to flag overhangs needing support.
const OVERHANG_NORMAL_Z = -Math.sin(Math.PI / 4);
// Anything within this many mm of the lowest point counts as "resting on
// the bed" for the contact-area score.
const BED_CONTACT_EPSILON_MM = 0.05;

export interface OrientationCandidate {
  rotateXDeg: number;
  rotateYDeg: number;
  heightMm: number;
  overhangAreaMm2: number;
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
const W_OVERHANG = 3;
const W_HEIGHT = 0.05;
const W_CONTACT = 0.3;

export function suggestOrientation(triangles: Triangle[]): OrientationSuggestion | null {
  if (triangles.length === 0) return null;

  const candidates: OrientationCandidate[] = CANDIDATES.map(({ rotateXDeg, rotateYDeg }) => {
    let minZ = Infinity,
      maxZ = -Infinity;
    const rotated = triangles.map((t) => {
      const v = t.v.map((p) => rotatePoint(p, rotateXDeg, rotateYDeg)) as Triangle["v"];
      for (const p of v) {
        if (p[2] < minZ) minZ = p[2];
        if (p[2] > maxZ) maxZ = p[2];
      }
      // Re-derive the normal's Z from the rotated triangle rather than
      // rotating the stored normal separately — avoids any mismatch if a
      // source file's normals aren't perfectly unit/consistent.
      return v;
    });

    let overhangAreaMm2 = 0;
    let contactAreaMm2 = 0;
    for (const v of rotated) {
      const area = triangleArea(v);
      const ux = v[1][0] - v[0][0],
        uy = v[1][1] - v[0][1],
        uz = v[1][2] - v[0][2];
      const vx = v[2][0] - v[0][0],
        vy = v[2][1] - v[0][1],
        vz = v[2][2] - v[0][2];
      const nx = uy * vz - uz * vy,
        ny = uz * vx - ux * vz,
        nz = ux * vy - uy * vx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      const normalZ = nz / len;
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
      const isBedContact =
        v[0][2] - minZ < BED_CONTACT_EPSILON_MM &&
        v[1][2] - minZ < BED_CONTACT_EPSILON_MM &&
        v[2][2] - minZ < BED_CONTACT_EPSILON_MM;
      if (isBedContact) {
        contactAreaMm2 += area;
      } else if (normalZ < OVERHANG_NORMAL_Z) {
        overhangAreaMm2 += area;
      }
    }

    const heightMm = maxZ - minZ;
    const score = -W_OVERHANG * overhangAreaMm2 - W_HEIGHT * heightMm + W_CONTACT * contactAreaMm2;
    return { rotateXDeg, rotateYDeg, heightMm, overhangAreaMm2, contactAreaMm2, score };
  });

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  return { rotateXDeg: best.rotateXDeg, rotateYDeg: best.rotateYDeg, score: best.score, alternatives: candidates };
}
