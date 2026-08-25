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

function rotatePoint(p: [number, number, number], xDeg: number, yDeg: number): [number, number, number] {
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
