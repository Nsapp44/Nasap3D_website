// Minimal 3MF (ZIP+XML) reader for the browser — parses 3D/3dmodel.model
// directly using native Web APIs (DecompressionStream for the ZIP's DEFLATE
// entries, DOMParser for the XML) rather than vendoring a library, mirroring
// the server-side reader (src/lib/server/threeMfParse.ts) and this project's
// existing convention of hand-writing small, well-defined format readers
// instead of pulling in a dependency for them.

const EOCD_SIGNATURE = 0x06054b50;
const ZIP64_EOCD_LOCATOR_SIGNATURE = 0x07064b50;
const ZIP64_EOCD_SIGNATURE = 0x06064b50;
const ZIP64_EXTRA_TAG = 0x0001;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;
// The classic 32-bit ZIP fields (offsets, sizes, entry counts) use this
// value as a sentinel meaning "see the ZIP64 extra field instead" — never a
// real value on its own (it'd mean a 4GB+ field).
const ZIP64_SENTINEL_32 = 0xffffffff;

function findEndOfCentralDirectory(view) {
  const minOffset = Math.max(0, view.byteLength - 22 - 65535);
  for (let i = view.byteLength - 22; i >= minOffset; i--) {
    if (view.getUint32(i, true) === EOCD_SIGNATURE) return i;
  }
  throw new Error('not a valid zip (3mf) file');
}

// Real customer file: a 3MF only ~120KB, well under any size that actually
// needs ZIP64, but written with ZIP64 extensions throughout regardless (the
// writer's own default, not size-driven) — every central/local directory
// field this reader cares about (entry count, CD offset, compressed size,
// local header offset) was set to ZIP64_SENTINEL_32, with the real 64-bit
// values sitting in a ZIP64 "extra field" instead. Without this, the
// sentinel was read as a literal (4294967295), and any subsequent access
// at that bogus offset failed outright — this file wouldn't load at all.
// Values are read as the low 32 bits of each 8-byte little-endian field
// (i.e. ignoring the always-zero high 4 bytes) — safe for anything under
// 4GB / 4 billion entries, comfortably true for anything this project's
// upload limit allows.
function readZip64EndOfCentralDirectory(view, classicEocdOffset) {
  // The locator is a fixed 20-byte record that must immediately precede
  // the classic EOCD record, per spec — not found by scanning (nothing to
  // search for reliably; this fixed position is the actual guarantee).
  const locatorOffset = classicEocdOffset - 20;
  if (locatorOffset < 0 || view.getUint32(locatorOffset, true) !== ZIP64_EOCD_LOCATOR_SIGNATURE) {
    throw new Error('zip64 sentinel present but no zip64 end-of-central-directory locator found');
  }
  const eocd64Offset = view.getUint32(locatorOffset + 8, true);
  if (view.getUint32(eocd64Offset, true) !== ZIP64_EOCD_SIGNATURE) {
    throw new Error('malformed zip64 end-of-central-directory record');
  }
  return {
    entryCount: view.getUint32(eocd64Offset + 32, true),
    cdOffset: view.getUint32(eocd64Offset + 48, true),
  };
}

// The ZIP64 extra field (tag 0x0001) only includes the fields that are
// actually flagged 0xFFFFFFFF in the MAIN record, in this fixed order:
// uncompressed size, compressed size, local header offset, disk number —
// each present only if its own main-record field was flagged, independent
// of whether the caller here actually wants that value. So `hasUncompSize`
// has to reflect the main record's own uncompressed-size field, not
// whether this function's caller cares about it — otherwise the wrong
// number of bytes gets skipped and every later field is misread.
function readZip64Extra(view, extraStart, extraLen, hasUncompSize, needCompSize, needLocalOffset) {
  let pos = extraStart;
  const end = extraStart + extraLen;
  while (pos + 4 <= end) {
    const tag = view.getUint16(pos, true);
    const size = view.getUint16(pos + 2, true);
    if (tag === ZIP64_EXTRA_TAG) {
      let p = pos + 4;
      let compSize, localOffset;
      if (hasUncompSize) p += 8;
      if (needCompSize) { compSize = view.getUint32(p, true); p += 8; }
      if (needLocalOffset) { localOffset = view.getUint32(p, true); p += 8; }
      return { compSize, localOffset };
    }
    pos += 4 + size;
  }
  return null;
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
  let entryCount = view.getUint16(eocdOffset + 10, true);
  let cdOffset = view.getUint32(eocdOffset + 16, true);
  if (entryCount === 0xffff || cdOffset === ZIP64_SENTINEL_32) {
    const real = readZip64EndOfCentralDirectory(view, eocdOffset);
    entryCount = real.entryCount;
    cdOffset = real.cdOffset;
  }

  for (let i = 0; i < entryCount; i++) {
    if (view.getUint32(cdOffset, true) !== CENTRAL_DIR_SIGNATURE) throw new Error('malformed zip central directory');
    const method = view.getUint16(cdOffset + 10, true);
    const uncompSizeRaw = view.getUint32(cdOffset + 24, true);
    let compressedSize = view.getUint32(cdOffset + 20, true);
    const nameLen = view.getUint16(cdOffset + 28, true);
    const extraLen = view.getUint16(cdOffset + 30, true);
    const commentLen = view.getUint16(cdOffset + 32, true);
    let localHeaderOffset = view.getUint32(cdOffset + 42, true);
    const name = decoder.decode(bytes.subarray(cdOffset + 46, cdOffset + 46 + nameLen));

    const needCompSize = compressedSize === ZIP64_SENTINEL_32;
    const needLocalOffset = localHeaderOffset === ZIP64_SENTINEL_32;
    if (needCompSize || needLocalOffset) {
      const real = readZip64Extra(view, cdOffset + 46 + nameLen, extraLen, uncompSizeRaw === ZIP64_SENTINEL_32, needCompSize, needLocalOffset);
      if (!real) throw new Error('zip64 sentinel present but no zip64 extra field found for ' + name);
      if (needCompSize) compressedSize = real.compSize;
      if (needLocalOffset) localHeaderOffset = real.localOffset;
    }

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

// Real customer complaint + measured live: on a 1M-triangle mesh, the old
// DOMParser+querySelectorAll+getAttribute approach took ~5000ms to load a
// 3MF that the equivalent STL loaded in ~190ms (parseStlTriangles, a flat
// binary read) — 58% of that was building a DOM tree of every single
// <vertex>/<triangle> as a real Element node, 35% was walking that tree via
// getAttribute per node. Neither cost is inherent to the FORMAT (the XML
// itself is tiny/regular data — a few numbers per line) — it's specific to
// routing it through the DOM at all. Below reads the XML as plain text
// instead, scoping to each element's own substring by index (`indexOf`, not
// a regex spanning the whole multi-megabyte document — avoids backtracking
// risk on a huge span) for the coarse structure (object/mesh/vertices/
// triangles/components/build, all small in count), then a single
// precompiled global regex per leaf tag (vertex/triangle/component/item —
// the only ones that scale into the hundreds of thousands or millions) —
// this is what actually gets this back down to STL's own order of
// magnitude, confirmed live against the same 1M-triangle file.

// Finds each top-level, non-nested `<tagName ...>...</tagName>` (or
// self-closing `<tagName .../>`) occurrence in `text` starting at
// `fromIndex` — a hand-rolled substitute for `element.children` scoped to
// one tag name, since every container this file cares about (object, mesh,
// vertices, triangles, components, build) never nests a same-named child
// inside itself in the 3MF schema, so "next matching close tag" is
// unambiguous without a real parser. Index-based (indexOf/slice), not a
// regex applied to the whole remaining text, so a container that itself
// holds megabytes of data (an <object>'s <mesh>) costs O(its own length)
// once, not repeated backtracking over it.
function* iterateElements(text, tagName, fromIndex) {
  const openNeedle = '<' + tagName;
  const closeNeedle = '</' + tagName + '>';
  let pos = fromIndex || 0;
  for (;;) {
    const start = text.indexOf(openNeedle, pos);
    if (start === -1) return;
    // Must actually be this tag, not e.g. "<objectid" — the char right
    // after the name has to end the tag name (whitespace, '>', or '/').
    const afterName = text[start + openNeedle.length];
    if (afterName !== ' ' && afterName !== '\t' && afterName !== '\n' && afterName !== '\r' && afterName !== '>' && afterName !== '/') {
      pos = start + openNeedle.length;
      continue;
    }
    const tagClose = text.indexOf('>', start);
    if (tagClose === -1) return;
    const selfClosing = text[tagClose - 1] === '/';
    const attrsText = text.slice(start + openNeedle.length, selfClosing ? tagClose - 1 : tagClose);
    if (selfClosing) {
      yield { attrsText, innerText: '' };
      pos = tagClose + 1;
      continue;
    }
    const closeStart = text.indexOf(closeNeedle, tagClose + 1);
    if (closeStart === -1) return;
    yield { attrsText, innerText: text.slice(tagClose + 1, closeStart) };
    pos = closeStart + closeNeedle.length;
  }
}

// Structural attributes (id, objectid, transform, p:path) — read a handful
// of times per file (once per object/component/item, never per vertex), so
// a small general-purpose regex per call is fine here; not on the hot path
// the comment above is about.
function getAttr(attrsText, name) {
  const m = new RegExp(name.replace(':', '\\:') + '\\s*=\\s*"([^"]*)"').exec(attrsText);
  return m ? m[1] : undefined;
}

// Every real-world 3MF writer (3MF Consortium's own spec examples, Bambu
// Studio, OrcaSlicer, PrusaSlicer, Cura) emits x/y/z and v1/v2/v3 in that
// fixed order — this fast path assumes it, matching (and skipping past) any
// trailing attributes a tool might add. `expectedCount` (a cheap substring
// count, no capturing) confirms this actually matched everything before the
// result is trusted; a real file that somehow uses a different attribute
// order falls back to the slower but order-agnostic per-tag scan below
// instead of silently returning a truncated/wrong mesh.
const VERTEX_FAST_RE = /<vertex\s+x="([^"]*)"\s+y="([^"]*)"\s+z="([^"]*)"[^>]*\/>/g;
const TRIANGLE_FAST_RE = /<triangle\s+v1="([^"]*)"\s+v2="([^"]*)"\s+v3="([^"]*)"[^>]*\/>/g;

function countOccurrences(text, needle) {
  let count = 0, pos = 0;
  for (;;) {
    pos = text.indexOf(needle, pos);
    if (pos === -1) return count;
    count++;
    pos += needle.length;
  }
}

function parseVertices(verticesInner, transforms) {
  const expected = countOccurrences(verticesInner, '<vertex');
  if (expected === 0) return new Float32Array(0);
  const position = new Float32Array(expected * 3);
  let i = 0;
  VERTEX_FAST_RE.lastIndex = 0;
  let m;
  while ((m = VERTEX_FAST_RE.exec(verticesInner))) {
    const [x, y, z] = applyTransforms(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), transforms);
    position[i * 3] = x; position[i * 3 + 1] = y; position[i * 3 + 2] = z;
    i++;
  }
  if (i === expected) return position;
  // Fallback: non-standard attribute order (or extra whitespace the fast
  // regex didn't anticipate) — same result, order-agnostic, just slower.
  const fallback = new Float32Array(expected * 3);
  i = 0;
  for (const { attrsText } of iterateElements(verticesInner, 'vertex')) {
    const [x, y, z] = applyTransforms(parseFloat(getAttr(attrsText, 'x')), parseFloat(getAttr(attrsText, 'y')), parseFloat(getAttr(attrsText, 'z')), transforms);
    fallback[i * 3] = x; fallback[i * 3 + 1] = y; fallback[i * 3 + 2] = z;
    i++;
  }
  return fallback;
}

function parseTriangles(trianglesInner) {
  const expected = countOccurrences(trianglesInner, '<triangle');
  if (expected === 0) return new Uint32Array(0);
  const index = new Uint32Array(expected * 3);
  let i = 0;
  TRIANGLE_FAST_RE.lastIndex = 0;
  let m;
  while ((m = TRIANGLE_FAST_RE.exec(trianglesInner))) {
    index[i * 3] = parseInt(m[1], 10);
    index[i * 3 + 1] = parseInt(m[2], 10);
    index[i * 3 + 2] = parseInt(m[3], 10);
    i++;
  }
  if (i === expected) return index;
  const fallback = new Uint32Array(expected * 3);
  i = 0;
  for (const { attrsText } of iterateElements(trianglesInner, 'triangle')) {
    fallback[i * 3] = parseInt(getAttr(attrsText, 'v1'), 10);
    fallback[i * 3 + 1] = parseInt(getAttr(attrsText, 'v2'), 10);
    fallback[i * 3 + 2] = parseInt(getAttr(attrsText, 'v3'), 10);
    i++;
  }
  return fallback;
}

function meshFromXml(meshInner, transforms) {
  const verticesEl = iterateElements(meshInner, 'vertices').next().value;
  const trianglesEl = iterateElements(meshInner, 'triangles').next().value;
  if (!verticesEl || !trianglesEl) return null;
  const position = parseVertices(verticesEl.innerText, transforms);
  const index = parseTriangles(trianglesEl.innerText);
  if (!position.length || !index.length) return null;
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

  const resourcesStart = xmlText.indexOf('<resources');
  const resourcesInner = resourcesStart === -1 ? '' : iterateElements(xmlText, 'resources', resourcesStart).next().value?.innerText || '';
  const objectsById = new Map();
  for (const { attrsText, innerText } of iterateElements(resourcesInner, 'object')) {
    const id = getAttr(attrsText, 'id');
    if (id !== undefined) objectsById.set(id, innerText);
  }

  const externalObjectsCache = new Map();
  async function loadExternalObjects(zipPath) {
    let cached = externalObjectsCache.get(zipPath);
    if (!cached) {
      const bytes = await extractZipEntry(buffer, zipPath.replace(/^\//, ''));
      const text = new TextDecoder('utf-8').decode(bytes);
      const rStart = text.indexOf('<resources');
      const rInner = rStart === -1 ? '' : iterateElements(text, 'resources', rStart).next().value?.innerText || '';
      cached = new Map();
      for (const { attrsText, innerText } of iterateElements(rInner, 'object')) {
        const id = getAttr(attrsText, 'id');
        if (id !== undefined) cached.set(id, innerText);
      }
      externalObjectsCache.set(zipPath, cached);
    }
    return cached;
  }

  const meshes = [];
  async function processObject(objectInner, itemTransform) {
    if (objectInner === undefined) return;
    const meshEl = iterateElements(objectInner, 'mesh').next().value;
    if (meshEl) {
      const mesh = meshFromXml(meshEl.innerText, [itemTransform]);
      if (mesh) meshes.push(mesh);
      return;
    }
    const componentsEl = iterateElements(objectInner, 'components').next().value;
    if (!componentsEl) return;
    for (const { attrsText } of iterateElements(componentsEl.innerText, 'component')) {
      const zipPath = getAttr(attrsText, 'p:path');
      const objectId = getAttr(attrsText, 'objectid');
      if (!zipPath || !objectId) continue;
      const externalObjects = await loadExternalObjects(zipPath);
      const targetInner = externalObjects.get(objectId);
      const targetMeshEl = targetInner !== undefined ? iterateElements(targetInner, 'mesh').next().value : undefined;
      if (targetMeshEl) {
        const mesh = meshFromXml(targetMeshEl.innerText, [getAttr(attrsText, 'transform'), itemTransform]);
        if (mesh) meshes.push(mesh);
      }
    }
  }

  const buildStart = xmlText.indexOf('<build');
  const buildInner = buildStart === -1 ? '' : iterateElements(xmlText, 'build', buildStart).next().value?.innerText || '';
  const items = [...iterateElements(buildInner, 'item')];
  if (items.length) {
    for (const { attrsText } of items) {
      await processObject(objectsById.get(getAttr(attrsText, 'objectid')), getAttr(attrsText, 'transform'));
    }
  } else {
    for (const objectInner of objectsById.values()) await processObject(objectInner);
  }

  if (!meshes.length) throw new Error('3mf file has no mesh objects');
  return { success: true, meshes };
}
