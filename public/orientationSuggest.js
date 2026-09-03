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

const OVERHANG_NORMAL_Z = -Math.sin(Math.PI / 4);
const BED_CONTACT_EPSILON_MM = 0.05;
const W_OVERHANG = 3;
const W_HEIGHT = 0.05;
const W_CONTACT = 0.3;

// Verbatim port of orientation.ts's suggestOrientation() — same 6
// axis-aligned candidates, same overhang/height/contact-area scoring, same
// weights. See that file for the reasoning behind each weight and the
// bed-contact/overhang mutual-exclusivity fix.
export function suggestOrientation(triangles) {
  if (triangles.length === 0) return null;

  const candidates = CANDIDATES.map(({ rotateXDeg, rotateYDeg }) => {
    let minZ = Infinity, maxZ = -Infinity;
    const rotated = triangles.map((t) => {
      const v = t.v.map((p) => rotatePoint(p, rotateXDeg, rotateYDeg));
      for (const p of v) {
        if (p[2] < minZ) minZ = p[2];
        if (p[2] > maxZ) maxZ = p[2];
      }
      return v;
    });

    let overhangAreaMm2 = 0;
    let contactAreaMm2 = 0;
    for (const v of rotated) {
      const area = triangleArea(v);
      const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2];
      const vx = v[2][0] - v[0][0], vy = v[2][1] - v[0][1], vz = v[2][2] - v[0][2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
      const normalZ = nz / len;
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

// Bakes a rotation directly into a triangle list — mirrors
// orientation.ts's applyTransform (rotation only, no scale: the client
// slice doesn't need to re-derive the user's Unité/Échelle scale factor,
// Kiri:Moto's own weight/time output already reflects the file as-uploaded
// at 1:1, and scale is applied server-side for the final stored file).
export function applyRotation(triangles, rotateXDeg, rotateYDeg) {
  if (!rotateXDeg && !rotateYDeg) return triangles;
  return triangles.map((t) => ({ v: t.v.map((p) => rotatePoint(p, rotateXDeg, rotateYDeg)) }));
}
