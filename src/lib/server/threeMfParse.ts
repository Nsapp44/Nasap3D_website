// 3MF → triangle mesh. A .3mf file is a plain ZIP archive containing an XML
// mesh description at 3D/3dmodel.model (the 3MF Core spec) — no external
// library needed: Node's built-in zlib handles the DEFLATE decompression
// ZIP uses, and fast-xml-parser (already a project dependency, see
// package.json) handles the XML. Hand-rolling the ZIP reader instead of
// adding a dependency for it mirrors this project's own pattern elsewhere
// (vendoring/hand-writing small, well-defined format readers rather than
// pulling in a library) — a minimal central-directory walk is a well-known,
// bounded format, unlike the actual mesh/geometry math this project avoids
// reimplementing.
import { inflateRawSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";
import type { Triangle } from "./orientation";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_DIR_SIGNATURE = 0x02014b50;
const LOCAL_FILE_SIGNATURE = 0x04034b50;

function findEndOfCentralDirectory(buffer: Buffer): number {
  // EOCD is a fixed 22-byte record optionally followed by a comment (up to
  // 65535 bytes) — scan backward from EOF for its signature, same approach
  // every real ZIP reader uses since there's no forward pointer to it.
  const minOffset = Math.max(0, buffer.length - 22 - 65535);
  for (let i = buffer.length - 22; i >= minOffset; i--) {
    if (buffer.readUInt32LE(i) === EOCD_SIGNATURE) return i;
  }
  throw new Error("not a valid zip file (no end-of-central-directory record)");
}

function extractZipEntry(buffer: Buffer, entryName: string): Buffer {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(eocdOffset + 10);
  let cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  for (let i = 0; i < entryCount; i++) {
    if (buffer.readUInt32LE(cdOffset) !== CENTRAL_DIR_SIGNATURE) {
      throw new Error("malformed zip central directory");
    }
    const method = buffer.readUInt16LE(cdOffset + 10);
    const compressedSize = buffer.readUInt32LE(cdOffset + 20);
    const nameLen = buffer.readUInt16LE(cdOffset + 28);
    const extraLen = buffer.readUInt16LE(cdOffset + 30);
    const commentLen = buffer.readUInt16LE(cdOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(cdOffset + 42);
    const name = buffer.toString("utf8", cdOffset + 46, cdOffset + 46 + nameLen);

    if (name === entryName) {
      const lh = localHeaderOffset;
      if (buffer.readUInt32LE(lh) !== LOCAL_FILE_SIGNATURE) {
        throw new Error("malformed zip local file header");
      }
      const lhNameLen = buffer.readUInt16LE(lh + 26);
      const lhExtraLen = buffer.readUInt16LE(lh + 28);
      const dataStart = lh + 30 + lhNameLen + lhExtraLen;
      const compressed = buffer.subarray(dataStart, dataStart + compressedSize);
      if (method === 0) return Buffer.from(compressed);
      if (method === 8) return inflateRawSync(compressed);
      throw new Error(`unsupported zip compression method: ${method}`);
    }

    cdOffset += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${entryName} not found in 3mf archive`);
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => name === "object" || name === "vertex" || name === "triangle" || name === "component",
});

// 12-number "1 0 0 0 1 0 0 0 1 0 0 0"-style 3MF transform: column-major 3x3
// linear part (m[0..2], m[3..5], m[6..8]) plus a translation (m[9..11]) —
// the same convention Three.js's own 3MFLoader uses for <component>/<item>
// transform attributes.
function applyThreeMfTransform(p: [number, number, number], transform?: string): [number, number, number] {
  if (!transform) return p;
  const m = transform.trim().split(/\s+/).map(Number);
  if (m.length !== 12) return p;
  const [x, y, z] = p;
  return [x * m[0] + y * m[3] + z * m[6] + m[9], x * m[1] + y * m[4] + z * m[7] + m[10], x * m[2] + y * m[5] + z * m[8] + m[11]];
}

// `transforms` are applied in order (component's own local transform, if
// any, then the <build><item> placement transform) — chaining two point
// transforms sequentially is equivalent to composing them into one matrix
// first, so no real matrix multiplication is needed here.
function meshTriangles(mesh: Record<string, unknown>, transforms: (string | undefined)[]): Triangle[] {
  const vertexList = (mesh?.vertices as Record<string, unknown> | undefined)?.vertex as Record<string, string>[] | undefined;
  const triangleList = (mesh?.triangles as Record<string, unknown> | undefined)?.triangle as Record<string, string>[] | undefined;
  if (!vertexList || !triangleList) return [];
  const vertices: [number, number, number][] = vertexList.map((v) => {
    let p: [number, number, number] = [parseFloat(v["@_x"]), parseFloat(v["@_y"]), parseFloat(v["@_z"])];
    for (const t of transforms) p = applyThreeMfTransform(p, t);
    return p;
  });
  const triangles: Triangle[] = [];
  for (const t of triangleList) {
    const a = vertices[parseInt(t["@_v1"], 10)];
    const b = vertices[parseInt(t["@_v2"], 10)];
    const c = vertices[parseInt(t["@_v3"], 10)];
    if (!a || !b || !c) continue;
    triangles.push({ normal: [0, 0, 0], v: [a, b, c] });
  }
  return triangles;
}

// Collects every mesh actually placed on the build plate, driven by
// <build><item objectid=".." transform=".."> (the 3MF spec's authoritative
// "what's really printed" list — <resources> alone is just a definition
// library, some of which may be dead/unused) rather than blindly walking
// every <resources><object>. Each item's object is resolved either as an
// inline <object><mesh> (the common case for a single part exported
// directly from CAD software) or via a <component p:path=".." objectid="">
// reference to another OPC part (the structure Bambu Studio/OrcaSlicer/
// Creality Print's own 3MF exports use even for a single object, and always
// for a multi-plate "project" 3MF) — resolved one level deep. Both the
// component's own transform AND the item's build-plate placement transform
// are applied: skipping the item transform was tried first and confirmed
// live to corrupt multi-object files — every object's local mesh coordinates
// start near its own origin, so without the placement offset, unrelated
// objects' vertices land on top of each other and get wrongly merged by the
// vertex-quantization in checkManifoldAndParts (539 bogus "parts" on a real
// 13-object test file, instead of 13).
export function parse3mfTriangles(buffer: Buffer): Triangle[] {
  const modelXml = extractZipEntry(buffer, "3D/3dmodel.model").toString("utf8");
  const doc = xmlParser.parse(modelXml);
  const objects = doc?.model?.resources?.object;
  const items = doc?.model?.build?.item;
  if (!objects || !Array.isArray(objects)) throw new Error("3mf file has no mesh objects");

  const objectsById = new Map<string, Record<string, unknown>>();
  for (const obj of objects) objectsById.set((obj as Record<string, string>)["@_id"], obj as Record<string, unknown>);

  const externalModelCache = new Map<string, Record<string, unknown>>();
  function loadExternalObjects(zipPath: string): Record<string, unknown>[] {
    let cached = externalModelCache.get(zipPath);
    if (!cached) {
      const xml = extractZipEntry(buffer, zipPath.replace(/^\//, "")).toString("utf8");
      cached = xmlParser.parse(xml) as Record<string, unknown>;
      externalModelCache.set(zipPath, cached);
    }
    const list = (cached as Record<string, Record<string, Record<string, unknown>>>)?.model?.resources
      ?.object as unknown as Record<string, unknown>[];
    return Array.isArray(list) ? list : [];
  }

  // Appended in a plain loop, not `push(...bigArray)` — spread blows the
  // call stack on a real multi-hundred-thousand-triangle mesh (confirmed
  // live against a real customer-style export).
  const triangles: Triangle[] = [];
  function appendAll(more: Triangle[]) {
    for (const t of more) triangles.push(t);
  }

  function processObject(obj: Record<string, unknown> | undefined, itemTransform?: string) {
    if (!obj) return;
    if (obj.mesh) {
      appendAll(meshTriangles(obj.mesh as Record<string, unknown>, [itemTransform]));
      return;
    }
    const components = (obj.components as Record<string, unknown> | undefined)?.component;
    if (Array.isArray(components)) {
      for (const comp of components as Record<string, string>[]) {
        const zipPath = comp["@_p:path"];
        const objectId = comp["@_objectid"];
        if (!zipPath || !objectId) continue;
        const externalObjects = loadExternalObjects(zipPath);
        const target = externalObjects.find((o) => (o as Record<string, string>)["@_id"] === objectId);
        if (target?.mesh) appendAll(meshTriangles(target.mesh as Record<string, unknown>, [comp["@_transform"], itemTransform]));
      }
    }
  }

  if (items) {
    for (const item of Array.isArray(items) ? items : [items]) {
      const rec = item as Record<string, string>;
      processObject(objectsById.get(rec["@_objectid"]), rec["@_transform"]);
    }
  } else {
    // No <build> at all (malformed, but be lenient) — fall back to every
    // top-level resource object with no placement transform.
    for (const obj of objects) processObject(obj as Record<string, unknown>);
  }

  if (triangles.length === 0) throw new Error("3mf file produced no triangles");
  return triangles;
}
