// Serializes a flat position array (+ optional index array) into a binary
// STL ArrayBuffer. Needed because Kiri:Moto's own engine.parse() only
// understands STL — confirmed by reading grid-apps' source directly
// (src/kiri-run/engine.js's parse() hardcodes `new load.STL().parse(...)`,
// true even in the full production browser build, not just the Node CLI) —
// so any non-STL upload (.obj, .3mf) has to be converted client-side before
// slicing, even though it can be *previewed* directly via viewer3d.js's own
// per-format loaders. Mirrors src/lib/server/orientation.ts's
// serializeBinaryStl (same format, same normal-recompute-from-winding
// approach), kept separate since that one uses node:buffer.
export function geometryToBinaryStl(positions, indices) {
  const triCount = indices ? indices.length / 3 : positions.length / 9;
  const buffer = new ArrayBuffer(84 + triCount * 50);
  const view = new DataView(buffer);
  view.setUint32(80, triCount, true);

  function vertexAt(i) {
    const vi = indices ? indices[i] : i;
    return [positions[vi * 3], positions[vi * 3 + 1], positions[vi * 3 + 2]];
  }

  let offset = 84;
  for (let t = 0; t < triCount; t++) {
    const a = vertexAt(t * 3),
      b = vertexAt(t * 3 + 1),
      c = vertexAt(t * 3 + 2);
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
    view.setFloat32(offset, nx / len, true);
    view.setFloat32(offset + 4, ny / len, true);
    view.setFloat32(offset + 8, nz / len, true);
    view.setFloat32(offset + 12, a[0], true);
    view.setFloat32(offset + 16, a[1], true);
    view.setFloat32(offset + 20, a[2], true);
    view.setFloat32(offset + 24, b[0], true);
    view.setFloat32(offset + 28, b[1], true);
    view.setFloat32(offset + 32, b[2], true);
    view.setFloat32(offset + 36, c[0], true);
    view.setFloat32(offset + 40, c[1], true);
    view.setFloat32(offset + 44, c[2], true);
    view.setUint16(offset + 48, 0, true);
    offset += 50;
  }
  return buffer;
}
