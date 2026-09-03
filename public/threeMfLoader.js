// Minimal 3MF (ZIP+XML) reader for the browser — parses 3D/3dmodel.model
// directly using native Web APIs (DecompressionStream for the ZIP's DEFLATE
// entries, DOMParser for the XML) rather than vendoring a library, mirroring
// the server-side reader (src/lib/server/threeMfParse.ts) and this project's
// existing convention of hand-writing small, well-defined format readers
// instead of pulling in a dependency for them.

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectory(view) {
  const minOffset = Math.max(0, view.byteLength - 22 - 65535);
  for (let i = view.byteLength - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) return i;
  }
  throw new Error('not a valid zip (3mf) file');
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function extractZipEntry(buffer, entryName) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const decoder = new TextDecoder();
  const eocdOffset = findEndOfCentralDirectory(view);
  const entryCount = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(cdOffset, true) !== CENTRAL_DIR_SIGNATURE) throw new Error('malformed zip central directory');
    const method = view.getUint16(cdOffset + 10, true);
    const compressedSize = view.getUint32(cdOffset + 20, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    const localHeaderOffset = view.getUint32(cdOffset + 42, true);
    const name = decoder.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));

    if (name === entryName) {
      const lh = localHeaderOffset;
      if (view.getUint32(lh, true) !== LOCAL_FILE_SIGNATURE) throw new Error('malformed zip local file header');
      const lhNameLen = view.getUint16(lh + 26, true);
      const lhExtraLen = view.getUint16(lh + 28, true);
      const dataStart = lh + 30 + lhNameLen + lhExtraLen;
      const compressed = bytes.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return compressed;
      if (method === 8) return inflateRaw(compressed);
      throw new Error('unsupported zip compression method: ' + method);
    }
    cdOffset += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(entryName + ' not found in 3mf archive');
}

// 12-number "1 0 0 0 1 0 0 0 1 0 0 0"-style 3MF transform: column-major 3x3
// linear part (m[0..2], m[3..5], m[6..8]) plus a translation (m[9..11]).
// `transforms` applied in sequence — chaining two point transforms is
// equivalent to composing them into one matrix first.
function applyTransforms(x, y, z, transforms) {
  for (const t of transforms) {
    if (!t) continue;
    const m = t.trim().split(/\s+/).map(Number);
    if (m.length !== 12) continue;
    const nx = x * m[0] + y * m[3] + z * m[6] + m[9];
    const ny = x * m[1] + y * m[4] + z * m[7] + m[10];
    const nz = x * m[2] + y * m[5] + z * m[8] + m[11];
    x = nx; y = ny; z = nz;
  }
  return [x, y, z];
}

function meshFromEl(meshEl, transforms) {
  const vertexEls = meshEl.querySelectorAll(':scope > vertices > vertex');
  const triangleEls = meshEl.querySelectorAll(':scope > triangles > triangle');
  if (!vertexEls.length || !triangleEls.length) return null;
  const position = new Float32Array(vertexEls.length * 3);
  vertexEls.forEach((v, i) => {
    const [x, y, z] = applyTransforms(parseFloat(v.getAttribute('x')), parseFloat(v.getAttribute('y')), parseFloat(v.getAttribute('z')), transforms);
    position[i * 3] = x; position[i * 3 + 1] = y; position[i * 3 + 2] = z;
  });
  const index = new Uint32Array(triangleEls.length * 3);
  triangleEls.forEach((t, i) => {
    index[i * 3] = parseInt(t.getAttribute('v1'), 10);
    index[i * 3 + 1] = parseInt(t.getAttribute('v2'), 10);
    index[i * 3 + 2] = parseInt(t.getAttribute('v3'), 10);
  });
  return { attributes: { position: { array: position } }, index: { array: index } };
}

// Returns the same shape occt-import-js's ReadStepFile does
// ({success, meshes:[{attributes:{position:{array}}, index:{array}}]}) so
// viewer3d.js's STEP-consuming code path can be reused as-is for 3mf too.
// Driven by <build><item> (the 3MF spec's authoritative "what's really
// placed" list, not just every <resources><object>), resolving <component
// p:path=".."> references to other OPC parts one level deep (the structure
// Bambu Studio/OrcaSlicer/Creality Print use even for a single object) and
// composing both the component's own transform and the item's placement
// transform — same approach and same reasoning as
// src/lib/server/threeMfParse.ts (skipping the item transform was tried
// first and confirmed to corrupt multi-object files: every object's local
// mesh sits near its own origin, so without the placement offset, unrelated
// objects visually overlap at the same spot).
export async function read3mfFile(buffer) {
  const modelBytes = await extractZipEntry(buffer, '3D/3dmodel.model');
  const xmlText = new TextDecoder('utf-8').decode(modelBytes);
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  const objectsById = new Map();
  doc.querySelectorAll('resources > object').forEach((o) => objectsById.set(o.getAttribute('id'), o));

  const externalDocCache = new Map();
  async function loadExternalDoc(zipPath) {
    let cached = externalDocCache.get(zipPath);
    if (!cached) {
      const bytes = await extractZipEntry(buffer, zipPath.replace(/^\//, ''));
      cached = new DOMParser().parseFromString(new TextDecoder('utf-8').decode(bytes), 'application/xml');
      externalDocCache.set(zipPath, cached);
    }
    return cached;
  }

  const meshes = [];
  async function processObject(obj, itemTransform) {
    if (!obj) return;
    const meshEl = obj.querySelector(':scope > mesh');
    if (meshEl) {
      const mesh = meshFromEl(meshEl, [itemTransform]);
      if (mesh) meshes.push(mesh);
      return;
    }
    const components = obj.querySelectorAll(':scope > components > component');
    for (const comp of components) {
      const zipPath = comp.getAttribute('p:path');
      const objectId = comp.getAttribute('objectid');
      if (!zipPath || !objectId) continue;
      const externalDoc = await loadExternalDoc(zipPath);
      const target = externalDoc.querySelector(`resources > object[id="${objectId}"]`);
      const targetMeshEl = target && target.querySelector(':scope > mesh');
      if (targetMeshEl) {
        const mesh = meshFromEl(targetMeshEl, [comp.getAttribute('transform'), itemTransform]);
        if (mesh) meshes.push(mesh);
      }
    }
  }

  const items = doc.querySelectorAll('build > item');
  if (items.length) {
    for (const item of items) {
      await processObject(objectsById.get(item.getAttribute('objectid')), item.getAttribute('transform'));
    }
  } else {
    for (const obj of objectsById.values()) await processObject(obj);
  }

  if (!meshes.length) throw new Error('3mf file has no mesh objects');
  return { success: true, meshes };
}
